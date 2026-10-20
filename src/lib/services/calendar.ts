import { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { addDays, dateKey, isDateKey, todayKey, weekStart, weekday } from "../domain/dates";
import { readinessBand } from "../domain/readiness";
import { getProfile } from "./profile";
import { generateForUser } from "./workouts";
import { templateWorkout } from "./templates";

/**
 * Training calendar built from existing records — no separate event table, so nothing can drift:
 * - workout plans with a date (scheduled / started / completed / cancelled; "skipped" when a past
 *   plan was neither completed nor cancelled — derived, never stored);
 * - recurring sports from the profile's weekly sport schedule, matched against logged activities;
 * - planned training days that have no plan yet (the day's plan is generated on that day);
 * - logged rest days.
 * Dates are the user's local calendar days (YYYY-MM-DD in their time zone), so DST never shifts them.
 */
export type PlanStatus = "scheduled" | "started" | "completed" | "cancelled" | "skipped";

export async function calendar(userId: string, opts: { from?: string; days?: number } = {}) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const from = opts.from && isDateKey(opts.from) ? opts.from : addDays(today, -7);
  const days = Math.min(Math.max(opts.days ?? 21, 1), 62);
  const to = addDays(from, days - 1);
  const [plans, activities, rest, sessions] = await Promise.all([
    db.workoutPlan.findMany({ where: { userId, scheduledOn: { gte: from, lte: to }, status: { not: "archived" } }, orderBy: { createdAt: "asc" } }),
    db.activityEntry.findMany({ where: { userId, dateKey: { gte: from, lte: to } }, select: { id: true, sport: true, dateKey: true, title: true, durationMin: true, source: true } }),
    db.checkIn.findMany({ where: { userId, dateKey: { gte: from, lte: to } }, select: { dateKey: true, isRestDay: true, readiness: true, pain: true } }),
    db.workoutSession.findMany({ where: { userId, status: "completed", dateKey: { gte: from, lte: to } }, select: { id: true, planId: true, dateKey: true, title: true } }),
  ]);
  return {
    today,
    from,
    to,
    days: Array.from({ length: days }, (_, i) => {
      const d = addDays(from, i);
      const past = d < today;
      const dayPlans = plans
        .filter((x) => x.scheduledOn === d)
        .map((x) => {
          const done = x.status === "completed" || sessions.some((s) => s.planId === x.id);
          const status: PlanStatus = done ? "completed" : x.status === "cancelled" ? "cancelled" : x.status === "started" ? "started" : past ? "skipped" : "scheduled";
          return { id: x.id, title: x.title, focus: x.focus, source: x.source, status };
        });
      const recurring = (p.sportSchedule[String(weekday(d))] ?? []).map((sport) => {
        const logged = activities.find((a) => a.dateKey === d && a.sport === sport);
        return { sport, status: logged ? ("done" as const) : past ? ("missed" as const) : ("scheduled" as const) };
      });
      const check = rest.find((c) => c.dateKey === d);
      return {
        dateKey: d,
        isToday: d === today,
        isTrainingDay: p.trainingDays.includes(weekday(d)),
        restDay: !!check?.isRestDay,
        plans: dayPlans,
        recurring,
        // Workouts completed without a plan date, and other logged activities, so the calendar reflects what really happened.
        completed: [
          ...sessions.filter((s) => s.dateKey === d && !dayPlans.some((x) => x.id === s.planId)).map((s) => ({ kind: "workout" as const, title: s.title })),
          ...activities.filter((a) => a.dateKey === d && a.source !== "workout" && !recurring.some((r) => r.sport === a.sport)).map((a) => ({ kind: "activity" as const, title: a.title ?? a.sport })),
        ],
      };
    }),
  };
}

/** Cautious load check: warnings only (the user decides), never a block. */
async function loadWarnings(userId: string, dateKey: string, excludePlanId?: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const start = weekStart(dateKey);
  const inWeek = await db.workoutPlan.count({
    where: { userId, scheduledOn: { gte: start, lte: addDays(start, 6) }, status: { notIn: ["archived", "cancelled"] }, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) },
  });
  const warnings: string[] = [];
  if (inWeek + 1 > p.daysPerWeek + 1) warnings.push(`That week would have ${inWeek + 1} workouts — more than your usual ${p.daysPerWeek}. Increase training load gradually and keep rest days.`);
  const prevDay = await db.workoutPlan.count({ where: { userId, scheduledOn: addDays(dateKey, -1), status: { notIn: ["archived", "cancelled"] }, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) } });
  const nextDay = await db.workoutPlan.count({ where: { userId, scheduledOn: addDays(dateKey, 1), status: { notIn: ["archived", "cancelled"] }, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) } });
  if (prevDay && nextDay) warnings.push("This makes three training days in a row. That's fine for light sessions; keep at least one easy day if you feel sore.");
  if (dateKey === today) {
    const c = await db.checkIn.findUnique({ where: { userId_dateKey: { userId, dateKey } } });
    if (c && readinessBand(c.readiness, c.pain) === "rest") warnings.push(c.pain ? "Your check-in today reported pain — consider recovery instead. This isn't a medical assessment." : "Your check-in today suggests recovery — consider a lighter day.");
  }
  return warnings;
}

async function ownPlan(userId: string, id: string) {
  const plan = await db.workoutPlan.findFirst({ where: { id, userId } });
  if (!plan) throw notFound("Workout not found");
  return plan;
}

async function assertFutureOrToday(userId: string, dateKey: string) {
  if (!isDateKey(dateKey)) throw badRequest("Invalid date");
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  if (dateKey < today) throw badRequest("Choose today or a future date");
  if (dateKey > addDays(today, 90)) throw badRequest("Schedule at most 90 days ahead");
}

export const scheduleSchema = z.object({ dateKey: z.string(), minutes: z.number().int().min(10).max(120).optional(), focus: z.string().max(30).optional() });

/** Schedules an engine-generated workout on a future day (one per day: reschedule or edit the existing one instead). */
export async function scheduleWorkout(userId: string, input: z.infer<typeof scheduleSchema>) {
  await assertFutureOrToday(userId, input.dateKey);
  const existing = await db.workoutPlan.findFirst({ where: { userId, scheduledOn: input.dateKey, status: { notIn: ["archived", "cancelled"] } } });
  if (existing) throw conflict("A workout is already scheduled that day — open it to edit or reschedule it.");
  const warnings = await loadWarnings(userId, input.dateKey);
  const { workout } = await generateForUser(userId, { minutes: input.minutes, focus: input.focus }, input.dateKey);
  const plan = await db.workoutPlan.create({
    data: { userId, title: workout.title, focus: workout.focus, scheduledOn: input.dateKey, source: "engine", content: JSON.stringify(workout) },
  });
  return { plan, warnings };
}

/** Moves a scheduled workout to another day. Completed or in-progress workouts stay where they happened. */
export async function reschedulePlan(userId: string, id: string, dateKey: string) {
  const plan = await ownPlan(userId, id);
  if (plan.status === "completed") throw conflict("Completed workouts stay on the day you did them.");
  if (plan.status === "started") throw conflict("Finish or end this workout before moving it.");
  if (plan.status === "archived") throw conflict("This plan was replaced; schedule a new workout instead.");
  await assertFutureOrToday(userId, dateKey);
  const clash = await db.workoutPlan.findFirst({ where: { userId, scheduledOn: dateKey, status: { notIn: ["archived", "cancelled"] }, id: { not: plan.id } } });
  if (clash) throw conflict("Another workout is already scheduled that day.");
  const warnings = await loadWarnings(userId, dateKey, plan.id);
  // Moving the day's automatic plan releases that day's key; the new day gets its plan from here on.
  const updated = await db.workoutPlan.update({ where: { id: plan.id }, data: { scheduledOn: dateKey, status: plan.status === "cancelled" ? "planned" : plan.status, dailyKey: null } });
  return { plan: updated, warnings };
}

/** Cancels a scheduled workout. Nothing is deleted; it can be restored. */
export async function cancelPlan(userId: string, id: string) {
  const plan = await ownPlan(userId, id);
  if (plan.status === "completed") throw conflict("Completed workouts can't be cancelled.");
  if (plan.status === "started") throw conflict("End the workout in progress first.");
  return db.workoutPlan.update({ where: { id: plan.id }, data: { status: "cancelled" } });
}

export async function restorePlan(userId: string, id: string) {
  const plan = await ownPlan(userId, id);
  if (plan.status !== "cancelled") throw conflict("Only cancelled workouts can be restored.");
  const clash = await db.workoutPlan.findFirst({ where: { userId, scheduledOn: plan.scheduledOn, status: { notIn: ["archived", "cancelled"] }, id: { not: plan.id } } });
  if (clash) throw conflict("Another workout is already scheduled that day.");
  return db.workoutPlan.update({ where: { id: plan.id }, data: { status: "planned" } });
}

/**
 * Schedules a template's workout on a day (today or up to 90 days ahead). Today's untouched automatic
 * plan is replaced (archived, not deleted); a workout the user edited, started or scheduled is never replaced.
 */
export async function scheduleTemplate(userId: string, templateId: string, dateKey: string) {
  await assertFutureOrToday(userId, dateKey);
  const { template, workout } = await templateWorkout(userId, templateId);
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const existing = await db.workoutPlan.findFirst({ where: { userId, scheduledOn: dateKey, status: { notIn: ["archived", "cancelled"] } }, orderBy: { createdAt: "desc" } });
  const replaceable = existing && dateKey === today && existing.source === "engine" && existing.status === "planned" && !!existing.dailyKey;
  if (existing && !replaceable) throw conflict("A workout is already scheduled that day — move or cancel it first.");
  const warnings = await loadWarnings(userId, dateKey, replaceable ? existing!.id : undefined);
  const plan = await db.$transaction(async (tx) => {
    if (replaceable) await tx.workoutPlan.update({ where: { id: existing!.id }, data: { status: "archived", dailyKey: null } });
    await tx.workoutTemplate.update({ where: { id: template.id }, data: { lastUsedAt: new Date() } });
    return tx.workoutPlan.create({ data: { userId, title: workout.title, focus: workout.focus, scheduledOn: dateKey, source: "custom", content: JSON.stringify(workout) } });
  });
  return { plan, warnings, replacedAutomatic: !!replaceable };
}

// ── Missed workouts ────────────────────────────────────────────────────
export type CatchUpNote =
  | { code: "none_missed" }
  | { code: "week_full"; planned: number; target: number }
  | { code: "no_free_day" }
  | { code: "check_in_rest" }
  | { code: "after_break" }
  | { code: "lighter_after_misses"; count: number };

/**
 * Looks at the last 7 days for missed training (a scheduled workout not done, or a planned training day
 * with nothing logged) and proposes — never applies — at most two catch-up sessions this week:
 * only while the week is below the usual number of sessions, only on free days, never two on one day,
 * never a third day in a row, and lighter after several misses or a long break. Missing a session
 * never has to be made up, and nothing is proposed when the latest check-in suggests recovery.
 */
export async function catchUpPreview(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
  const joined = dateKey(user.createdAt, p.timezone);
  const from = addDays(today, -7);
  const ws = weekStart(today);
  const we = addDays(ws, 6);
  const [plans, sessions, activities, checks, lastSession] = await Promise.all([
    db.workoutPlan.findMany({ where: { userId, scheduledOn: { gte: from < ws ? from : ws, lte: we }, status: { notIn: ["archived", "cancelled"] } } }),
    db.workoutSession.findMany({ where: { userId, status: "completed", dateKey: { gte: from < ws ? from : ws, lte: we } }, select: { planId: true, dateKey: true } }),
    db.activityEntry.findMany({ where: { userId, source: { not: "workout" }, dateKey: { gte: from, lte: today } }, select: { dateKey: true } }),
    db.checkIn.findMany({ where: { userId, dateKey: { gte: from, lte: today } }, select: { dateKey: true, isRestDay: true, readiness: true, pain: true } }),
    db.workoutSession.findFirst({ where: { userId, status: "completed" }, orderBy: { startedAt: "desc" }, select: { dateKey: true } }),
  ]);
  const doneOn = (d: string) => sessions.some((s) => s.dateKey === d) || activities.some((a) => a.dateKey === d);
  const missed: { dateKey: string; kind: "plan" | "training_day"; title: string | null }[] = [];
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (d < joined) continue; // days before the account existed are never "missed"
    const dayPlans = plans.filter((x) => x.scheduledOn === d);
    const rest = checks.some((c) => c.dateKey === d && c.isRestDay);
    if (dayPlans.length) {
      for (const x of dayPlans) if (x.status !== "completed" && !sessions.some((s) => s.planId === x.id) && !doneOn(d)) missed.push({ dateKey: d, kind: "plan", title: x.title });
    } else if (p.trainingDays.includes(weekday(d)) && !doneOn(d) && !rest) missed.push({ dateKey: d, kind: "training_day", title: null });
  }
  const notes: CatchUpNote[] = [];
  const target = p.daysPerWeek;
  let doneThisWeek = 0; // days this week with a workout or another logged activity
  for (let d = ws; d <= today; d = addDays(d, 1)) if (doneOn(d)) doneThisWeek++;
  // Days from today on that will (or may) hold a workout: scheduled plans, and training days (their plan is made on the day).
  // Past days count only if something was actually done (a missed workout isn't load); today and later count what's planned.
  const busy = (d: string) => (d < today ? doneOn(d) : plans.some((x) => x.scheduledOn === d && x.status !== "completed") || p.trainingDays.includes(weekday(d)) || sessions.some((s) => s.dateKey === d));
  let upcoming = 0;
  for (let d = today; d <= we; d = addDays(d, 1)) if (!doneOn(d) && (plans.some((x) => x.scheduledOn === d && x.status !== "completed") || p.trainingDays.includes(weekday(d)))) upcoming++;
  const base = { today, missed, week: { target, done: doneThisWeek, upcoming }, proposal: [] as { dateKey: string; lighter: boolean }[], notes };
  if (!missed.length) {
    notes.push({ code: "none_missed" });
    return base;
  }
  const latest = checks.filter((c) => c.dateKey === today)[0];
  if (latest && readinessBand(latest.readiness, latest.pain) === "rest") {
    notes.push({ code: "check_in_rest" });
    return base;
  }
  const capacity = target - doneThisWeek - upcoming;
  if (capacity <= 0) {
    notes.push({ code: "week_full", planned: doneThisWeek + upcoming, target });
    return base;
  }
  const restLogged = (d: string) => checks.some((c) => c.dateKey === d && c.isRestDay);
  const chosen: string[] = [];
  const isBusy = (d: string) => busy(d) || chosen.includes(d);
  for (let d = today; d <= we && chosen.length < Math.min(2, capacity, missed.length); d = addDays(d, 1)) {
    if (busy(d) || restLogged(d) || doneOn(d)) continue;
    if (chosen.length && chosen[chosen.length - 1] === addDays(d, -1)) continue; // never two catch-ups back to back
    const before = isBusy(addDays(d, -1)) || doneOn(addDays(d, -1));
    const before2 = isBusy(addDays(d, -2)) || doneOn(addDays(d, -2));
    const after = isBusy(addDays(d, 1));
    const after2 = isBusy(addDays(d, 2));
    if ((before && after) || (before && before2) || (after && after2)) continue; // would make three days in a row
    chosen.push(d);
  }
  if (!chosen.length) {
    notes.push({ code: "no_free_day" });
    return base;
  }
  const longBreak = !lastSession?.dateKey || lastSession.dateKey < addDays(today, -14);
  const lighter = longBreak || missed.length >= 2;
  if (longBreak) notes.push({ code: "after_break" });
  else if (missed.length >= 2) notes.push({ code: "lighter_after_misses", count: missed.length });
  return { ...base, proposal: chosen.map((d) => ({ dateKey: d, lighter })) };
}

/** Adds the chosen catch-up sessions — only days the current preview still proposes. */
export async function applyCatchUp(userId: string, dateKeys: string[]) {
  const preview = await catchUpPreview(userId);
  const allowed = new Map(preview.proposal.map((x) => [x.dateKey, x]));
  const picked = [...new Set(dateKeys)].filter((d) => allowed.has(d));
  if (!picked.length) throw conflict("Those days aren't proposed anymore. Refresh to see the current suggestion.");
  const created = [];
  for (const d of picked) {
    if (await db.workoutPlan.findFirst({ where: { userId, scheduledOn: d, status: { notIn: ["archived", "cancelled"] } }, select: { id: true } })) continue; // filled meanwhile
    const { workout } = await generateForUser(userId, allowed.get(d)!.lighter ? { volumeScale: 0.8 } : {}, d);
    created.push(await db.workoutPlan.create({ data: { userId, title: workout.title, focus: workout.focus, scheduledOn: d, source: "engine", content: JSON.stringify(workout) } }));
  }
  return { created: created.map((c) => ({ id: c.id, dateKey: c.scheduledOn, title: c.title })) };
}
