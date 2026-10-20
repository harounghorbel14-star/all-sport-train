import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../server/db";
import { featureEnabled } from "../server/features";
import { badRequest, conflict, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { addDays, todayKey, weekday, weekStart } from "../domain/dates";
import { exerciseKcal } from "../domain/energy";
import { readinessBand, READINESS_ADVICE } from "../domain/readiness";
import { XP } from "../domain/levels";
import { generateWorkout, substitutesFor } from "../engine/generator";
import { roadmapState } from "../engine/roadmap";
import { workoutSchema, type Block, type ExerciseHistory, type GeneratedWorkout } from "../engine/types";
import { SKILL_BY_SLUG } from "../content/skills";
import { engineExercises, exerciseMap } from "./exercises";
import { getProfile, toEngineProfile, type ProfileView } from "./profile";
import { awardXp, evaluateAchievements } from "./gamification";

const parseWorkout = (raw: string) => {
  const parsed = workoutSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw badRequest("Stored workout is invalid");
  return parsed.data;
};

// ── History ────────────────────────────────────────────────────────────
export async function buildHistory(userId: string, since?: Date): Promise<Record<string, ExerciseHistory>> {
  const sessions = await db.workoutSession.findMany({
    where: { userId, status: "completed", startedAt: { gte: since ?? new Date(Date.now() - 90 * 86_400_000) } },
    orderBy: { startedAt: "desc" },
    take: 60,
    include: { sets: { include: { exercise: { select: { slug: true } } } } },
  });
  const history: Record<string, ExerciseHistory & { _seen: number }> = {};
  for (const s of sessions) {
    let content: GeneratedWorkout;
    try {
      content = parseWorkout(s.content);
    } catch {
      continue;
    }
    const byBlock = new Map<number, typeof s.sets>();
    for (const set of s.sets) byBlock.set(set.blockIndex, [...(byBlock.get(set.blockIndex) ?? []), set]);
    for (const [blockIndex, sets] of byBlock) {
      const block = content.main[blockIndex];
      const done = sets.filter((x) => !x.skipped);
      if (!block || !done.length) continue;
      const slug = done[0].exercise.slug;
      const h = (history[slug] ??= { sessions: 0, recentTopHits: 0, recentMisses: 0, _seen: 0 });
      h.sessions += 1;
      if (h._seen === 0) {
        h.lastReps = Math.max(...done.map((x) => x.reps ?? 0)) || null;
        h.lastSeconds = Math.max(...done.map((x) => x.seconds ?? 0)) || null;
        h.lastRpe = Math.max(...done.map((x) => x.rpe ?? 0)) || s.rpe || null;
        h.lastDate = s.dateKey ?? undefined;
      }
      if (h._seen < 3) {
        const allSetsDone = done.length >= block.sets;
        const top = block.seconds
          ? done.every((x) => (x.seconds ?? 0) >= block.seconds!)
          : done.every((x) => (x.reps ?? 0) >= (block.repMax ?? Infinity));
        const miss = block.seconds
          ? done.some((x) => (x.seconds ?? 0) < block.seconds! * 0.6)
          : done.some((x) => (x.reps ?? 0) < (block.repMin ?? 0));
        if (top && allSetsDone) h.recentTopHits += 1;
        if (miss) h.recentMisses += 1;
      }
      h._seen += 1;
    }
  }
  return Object.fromEntries(Object.entries(history).map(([k, v]) => [k, { sessions: v.sessions, recentTopHits: v.recentTopHits, recentMisses: v.recentMisses, lastReps: v.lastReps, lastSeconds: v.lastSeconds, lastRpe: v.lastRpe, lastDate: v.lastDate }]));
}

async function activeSkillExercise(userId: string) {
  const progress = await db.skillProgress.findFirst({ where: { userId, unlockedAt: null }, orderBy: { updatedAt: "desc" } });
  if (!progress) return null;
  const skill = SKILL_BY_SLUG.get(progress.skillSlug);
  return skill?.steps[progress.stepIndex]?.exercise ?? null;
}

export async function readinessFor(userId: string, dateKey: string) {
  const c = await db.checkIn.findUnique({ where: { userId_dateKey: { userId, dateKey } } });
  if (!c) return { band: undefined, volume: 1, checkIn: null };
  const band = readinessBand(c.readiness, c.pain);
  return { band, volume: READINESS_ADVICE[band].volume, checkIn: c };
}

export async function roadmapFor(p: ProfileView, today: string) {
  const startKey = p.programStartDate ? p.programStartDate.toISOString().slice(0, 10) : today;
  const repeats = await db.weeklyReview.findMany({ where: { userId: p.userId }, select: { adjustment: true } });
  const offset = repeats.reduce((s, r) => s + (parseJson(r.adjustment, workoutAdjustSchema, { repeatWeeks: 0 }).repeatWeeks ?? 0), 0);
  return roadmapState(startKey, today, offset);
}
const workoutAdjustSchema = z.object({ repeatWeeks: z.number().optional() }).passthrough();

/** Index of today's session within the training week. */
async function dayIndexFor(userId: string, p: ProfileView, today: string) {
  const start = weekStart(today);
  const done = await db.workoutSession.count({ where: { userId, status: "completed", dateKey: { gte: start, lt: today } } });
  const planned = [...p.trainingDays].sort();
  const pos = planned.indexOf(weekday(today));
  return pos >= 0 ? pos : done;
}

export interface GenerateOverrides {
  minutes?: number;
  focus?: string;
  avoidMuscles?: string[];
  ignoreReadiness?: boolean;
  /** Below 1 makes the session easier (fewer sets), e.g. after very hard sessions or a long break. */
  volumeScale?: number;
}

export async function generateForUser(userId: string, overrides: GenerateOverrides = {}, dateKey?: string) {
  const p = await getProfile(userId);
  const today = dateKey ?? todayKey(p.timezone);
  const [exercises, history, readiness, skillExercise, dayIndex, roadmap] = await Promise.all([
    engineExercises(),
    buildHistory(userId),
    readinessFor(userId, today),
    activeSkillExercise(userId),
    dayIndexFor(userId, p, today),
    roadmapFor(p, today),
  ]);
  // Travel: equipment and place for that day come from the trip; sessions are never longer than usual.
  const travel = !featureEnabled("travel") ? null : await db.travelPeriod.findFirst({ where: { userId, status: "active", startDate: { lte: today }, endDate: { gte: today } }, orderBy: { createdAt: "desc" } });
  const engineProfile = toEngineProfile(p);
  if (travel) {
    engineProfile.equipment = parseJson(travel.equipment, z.array(z.string()), []);
    engineProfile.location = travel.location;
    engineProfile.sessionMinutes = Math.min(travel.sessionMinutes ?? p.sessionMinutes, p.sessionMinutes);
  }
  const band = overrides.ignoreReadiness ? undefined : readiness.band;
  const volume = (overrides.ignoreReadiness ? 1 : readiness.volume) * roadmap.volume * Math.min(1, Math.max(0.5, overrides.volumeScale ?? 1));
  const workout = generateWorkout(exercises, engineProfile, {
    date: today,
    dayIndex,
    history,
    readinessVolume: band === "rest" ? 0 : Math.max(0.5, volume),
    readinessBand: band,
    phase: roadmap.phase.index,
    deload: roadmap.deload,
    minutesOverride: overrides.minutes,
    focusOverride: overrides.focus,
    skillExercise: roadmap.phase.index >= 3 || p.experience !== "zero" ? skillExercise : null,
    avoidMuscles: overrides.avoidMuscles,
    seed: `${userId}:${today}:${overrides.focus ?? ""}:${overrides.minutes ?? ""}:${overrides.volumeScale ?? ""}${travel ? `:travel:${travel.id}` : ""}`,
  });
  // Keep the planned volume ≥1 set even after the phase multiplier.
  return { workout, readiness: band, roadmap, travel: travel ? { id: travel.id, startDate: travel.startDate, endDate: travel.endDate } : null };
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// ── Plans ──────────────────────────────────────────────────────────────
export async function getOrCreateTodayPlan(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const existing = await db.workoutPlan.findFirst({
    where: { userId, scheduledOn: today, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { plan: existing, workout: parseWorkout(existing.content) };
  const { workout } = await generateForUser(userId, {}, today);
  // dailyKey is unique: if another request (a second tab) created today's plan first, use that one.
  try {
    const plan = await db.workoutPlan.create({
      data: { userId, title: workout.title, focus: workout.focus, scheduledOn: today, source: "engine", content: JSON.stringify(workout), dailyKey: `${userId}:${today}` },
    });
    return { plan, workout };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const first = await db.workoutPlan.findUniqueOrThrow({ where: { dailyKey: `${userId}:${today}` } });
    return { plan: first, workout: parseWorkout(first.content) };
  }
}

export async function createPlan(userId: string, workout: GeneratedWorkout, source: "engine" | "coach" | "custom", scheduledOn?: string) {
  const valid = await validateWorkout(workout);
  return db.workoutPlan.create({
    data: { userId, title: valid.title, focus: valid.focus, scheduledOn: scheduledOn ?? null, source, content: JSON.stringify(valid) },
  });
}

export async function regenerateToday(userId: string, overrides: GenerateOverrides & { keepEdited?: boolean }) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  if (overrides.keepEdited) {
    const current = await db.workoutPlan.findFirst({ where: { userId, scheduledOn: today, status: { not: "archived" } }, orderBy: { createdAt: "desc" } });
    // Never silently replace a workout the user changed, or one already under way.
    if (current && (current.source !== "engine" || current.status !== "planned")) return { plan: current, workout: parseWorkout(current.content), kept: true };
  }
  // Archived plans release the day's key so a later automatic plan can be created if needed.
  await db.workoutPlan.updateMany({ where: { userId, scheduledOn: today, status: "planned" }, data: { status: "archived", dailyKey: null } });
  const { workout } = await generateForUser(userId, overrides, today);
  const plan = await db.workoutPlan.create({
    data: { userId, title: workout.title, focus: workout.focus, scheduledOn: today, source: "engine", content: JSON.stringify(workout) },
  });
  return { plan, workout, kept: false };
}

/** Validates an edited workout: schema + every exercise must exist. */
export async function validateWorkout(input: unknown): Promise<GeneratedWorkout> {
  const parsed = workoutSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Invalid workout", parsed.error.issues.slice(0, 5));
  const map = await exerciseMap();
  for (const b of [...parsed.data.warmup, ...parsed.data.main, ...parsed.data.cooldown]) {
    if (!map.has(b.exercise)) throw badRequest(`Unknown exercise: ${b.exercise}`);
    if (b.seconds == null && (b.repMin == null || b.repMax == null)) throw badRequest("Each exercise needs reps or a duration");
    if (b.repMin != null && b.repMax != null && b.repMin > b.repMax) throw badRequest("Minimum reps cannot exceed maximum reps");
  }
  return parsed.data;
}

export async function getPlan(userId: string, planId: string) {
  const plan = await db.workoutPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) throw notFound("Workout plan not found");
  return { plan, workout: parseWorkout(plan.content) };
}

export async function updatePlan(userId: string, planId: string, content: unknown) {
  const { plan } = await getPlan(userId, planId);
  if (plan.status === "completed") throw conflict("Completed workouts can't be edited");
  const workout = await validateWorkout(content);
  const updated = await db.workoutPlan.update({
    where: { id: plan.id },
    data: { content: JSON.stringify(workout), title: workout.title, source: plan.source === "engine" ? "custom" : plan.source },
  });
  return { plan: updated, workout };
}

export async function listPlans(userId: string, limit = 20) {
  const plans = await db.workoutPlan.findMany({ where: { userId, status: { not: "archived" } }, orderBy: { createdAt: "desc" }, take: Math.min(limit, 50) });
  return plans.map((p) => ({ ...p, content: undefined, workout: parseJson(p.content, workoutSchema, null as unknown as GeneratedWorkout) }));
}

export async function substitutionOptions(userId: string, slug: string) {
  const [p, exercises] = await Promise.all([getProfile(userId), engineExercises()]);
  return substitutesFor(slug, exercises, toEngineProfile(p)).map((e) => ({ slug: e.slug, name: e.name, difficulty: e.difficulty, equipment: e.equipment }));
}

/** Seven-day preview of the training week (planned sessions vs rest days). */
export async function weekPreview(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const start = weekStart(today);
  const sessions = await db.workoutSession.findMany({
    where: { userId, status: "completed", dateKey: { gte: start, lte: addDays(start, 6) } },
    select: { dateKey: true, title: true },
  });
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const done = sessions.filter((s) => s.dateKey === d);
    return {
      dateKey: d,
      planned: p.trainingDays.includes(weekday(d)),
      sports: p.sportSchedule[String(weekday(d))] ?? [],
      completed: done.map((s) => s.title),
      isToday: d === today,
    };
  });
}

// ── Live sessions ──────────────────────────────────────────────────────
export async function activeSession(userId: string) {
  return db.workoutSession.findFirst({ where: { userId, status: { in: ["active", "paused"] } }, orderBy: { startedAt: "desc" } });
}

export async function startSession(userId: string, planId: string) {
  const current = await activeSession(userId);
  if (current) {
    if (current.planId === planId) return current;
    throw conflict("You already have a workout in progress. Finish or end it first.");
  }
  const { plan, workout } = await getPlan(userId, planId);
  if (plan.status === "completed") throw conflict("This workout is already completed");
  if (plan.status === "cancelled") throw conflict("This workout was cancelled — restore it first.");
  // activeKey is unique per user while a session is live, so a double tap or a second tab can't start two.
  let session;
  try {
    session = await db.workoutSession.create({
      data: { userId, planId: plan.id, title: workout.title, content: JSON.stringify(workout), activeKey: userId },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const winner = await db.workoutSession.findUnique({ where: { activeKey: userId } });
    if (winner && winner.planId === planId) return winner;
    throw conflict("You already have a workout in progress. Finish or end it first.");
  }
  await db.workoutPlan.update({ where: { id: plan.id }, data: { status: "started" } });
  return session;
}

export async function getSession(userId: string, sessionId: string) {
  const session = await db.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: { sets: { orderBy: [{ blockIndex: "asc" }, { setNumber: "asc" }] } },
  });
  if (!session) throw notFound("Workout session not found");
  return { session, workout: parseWorkout(session.content) };
}

export interface SetInput {
  blockIndex: number;
  setNumber: number;
  reps?: number | null;
  seconds?: number | null;
  loadKg?: number | null;
  rpe?: number | null;
  skipped?: boolean;
}

async function previousBest(userId: string, sessionId: string, exerciseId: string, metric: "reps" | "seconds" | "loadKg", excludeSetId?: string) {
  const [setMax, pr] = await Promise.all([
    db.setLog.aggregate({
      where: { exerciseId, skipped: false, session: { userId, status: { not: "abandoned" } }, ...(excludeSetId ? { id: { not: excludeSetId } } : {}) },
      _max: { [metric]: true } as never,
    }) as Promise<{ _max: Record<string, number | null> }>,
    // This session's own records are backed by its sets (counted above), which may since have been corrected.
    db.personalRecord.aggregate({ where: { userId, exerciseId, metric, OR: [{ sessionId: null }, { sessionId: { not: sessionId } }] }, _max: { value: true } }),
  ]);
  const a = setMax._max[metric];
  const b = pr._max.value;
  if (a == null && b == null) return null;
  return Math.max(a ?? 0, b ?? 0);
}

/**
 * Drops personal records from this session that its sets no longer support
 * (a set was corrected downwards, or its block was substituted away).
 */
async function reconcileSessionPrs(userId: string, sessionId: string) {
  const [prs, sets] = await Promise.all([
    db.personalRecord.findMany({ where: { userId, sessionId } }),
    db.setLog.findMany({ where: { sessionId, skipped: false } }),
  ]);
  const stale = prs.filter((pr) => !sets.some((s) => s.exerciseId === pr.exerciseId && (s[pr.metric as "reps" | "seconds" | "loadKg"] ?? 0) >= pr.value));
  if (stale.length) await db.personalRecord.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
}

export async function logSet(userId: string, sessionId: string, input: SetInput) {
  const { session, workout } = await getSession(userId, sessionId);
  if (session.status === "completed" || session.status === "abandoned") throw conflict("This workout has ended");
  const block = workout.main[input.blockIndex];
  if (!block) throw badRequest("Unknown exercise block");
  if (input.setNumber < 1 || input.setNumber > Math.max(block.sets, 10)) throw badRequest("Invalid set number");
  const exercise = await db.exercise.findUnique({ where: { slug: block.exercise }, select: { id: true, isTimed: true } });
  if (!exercise) throw badRequest("Unknown exercise");
  if (!input.skipped && input.reps == null && input.seconds == null) throw badRequest("Enter reps or seconds");

  const data = {
    reps: input.skipped ? null : (input.reps ?? null),
    seconds: input.skipped ? null : (input.seconds ?? null),
    loadKg: input.skipped ? null : (input.loadKg ?? null),
    rpe: input.rpe ?? null,
    skipped: !!input.skipped,
    exerciseId: exercise.id,
    completedAt: new Date(),
  };
  const existing = await db.setLog.findUnique({ where: { sessionId_blockIndex_setNumber: { sessionId, blockIndex: input.blockIndex, setNumber: input.setNumber } } });

  // Personal record check before saving (compare against everything else logged).
  const prs: { metric: string; value: number; previous: number }[] = [];
  if (!data.skipped) {
    for (const metric of ["reps", "seconds", "loadKg"] as const) {
      const value = data[metric];
      if (value == null || value <= 0) continue;
      const prev = await previousBest(userId, sessionId, exercise.id, metric, existing?.id);
      if (prev != null && value > prev) prs.push({ metric, value, previous: prev });
    }
  }

  const set = await db.setLog.upsert({
    where: { sessionId_blockIndex_setNumber: { sessionId, blockIndex: input.blockIndex, setNumber: input.setNumber } },
    create: { sessionId, blockIndex: input.blockIndex, setNumber: input.setNumber, ...data },
    update: data,
  });
  if (existing) await reconcileSessionPrs(userId, sessionId);
  for (const pr of prs) {
    // One record per exercise and metric per session: the new best replaces a lower one from earlier in the workout.
    await db.personalRecord.deleteMany({ where: { userId, sessionId, exerciseId: exercise.id, metric: pr.metric } });
    await db.personalRecord.create({ data: { userId, exerciseId: exercise.id, metric: pr.metric, value: pr.value, sessionId } });
  }
  return { set, prs };
}

export type SessionAction =
  | { action: "pause" }
  | { action: "resume" }
  | { action: "goto"; index: number }
  | { action: "substitute"; blockIndex: number; exercise: string }
  | { action: "notes"; notes: string };

export async function updateSessionState(userId: string, sessionId: string, a: SessionAction) {
  const { session, workout } = await getSession(userId, sessionId);
  if (session.status === "completed" || session.status === "abandoned") throw conflict("This workout has ended");
  switch (a.action) {
    case "pause":
      if (session.status === "paused") return session;
      return db.workoutSession.update({ where: { id: session.id }, data: { status: "paused", pausedAt: new Date() } });
    case "resume": {
      if (session.status !== "paused" || !session.pausedAt) return session;
      const add = Math.round((Date.now() - session.pausedAt.getTime()) / 1000);
      return db.workoutSession.update({ where: { id: session.id }, data: { status: "active", pausedAt: null, pausedSeconds: session.pausedSeconds + add } });
    }
    case "goto":
      if (a.index < 0 || a.index >= workout.main.length) throw badRequest("Invalid exercise index");
      return db.workoutSession.update({ where: { id: session.id }, data: { currentIndex: a.index } });
    case "substitute": {
      const block = workout.main[a.blockIndex];
      if (!block) throw badRequest("Unknown exercise block");
      const options = await substitutionOptions(userId, block.exercise);
      if (!options.some((o) => o.slug === a.exercise)) throw badRequest("That substitution isn't suitable for your equipment or limitations");
      const map = await exerciseMap();
      const ex = map.get(a.exercise)!;
      const replaced: Block = {
        ...block,
        exercise: a.exercise,
        seconds: ex.isTimed ? (block.seconds ?? ex.holdSeconds ?? 30) : null,
        repMin: ex.isTimed ? null : (block.repMin ?? ex.repMin),
        repMax: ex.isTimed ? null : (block.repMax ?? ex.repMax),
        progression: "new",
        note: `Substituted for ${map.get(block.exercise)?.name ?? block.exercise}.`,
        easier: ex.easier[0] ?? null,
        harder: ex.harder[0] ?? null,
      };
      workout.main[a.blockIndex] = replaced;
      // Sets already logged for the old exercise in this block are discarded.
      await db.setLog.deleteMany({ where: { sessionId: session.id, blockIndex: a.blockIndex } });
      await reconcileSessionPrs(userId, session.id);
      return db.workoutSession.update({ where: { id: session.id }, data: { content: JSON.stringify(workout) } });
    }
    case "notes":
      return db.workoutSession.update({ where: { id: session.id }, data: { notes: a.notes.slice(0, 1000) } });
  }
}

type LoadedSession = Awaited<ReturnType<typeof getSession>>["session"];

/** Energy estimate from the exercises actually performed (weighted MET). */
async function sessionKcal(done: LoadedSession["sets"], durationMin: number, weightKg: number | null) {
  const map = await exerciseMap();
  const exerciseById = new Map([...map.values()].map((e) => [e.id, e]));
  const mets = done.map((s) => exerciseById.get(s.exerciseId)?.met ?? 4);
  const met = mets.reduce((a, b) => a + b, 0) / mets.length;
  // Rest periods lower the average intensity of a strength session.
  return exerciseKcal(Math.max(2.5, met * 0.85), durationMin, weightKg);
}

async function sessionSummary(userId: string, session: LoadedSession, weightKg: number | null, achievements: Awaited<ReturnType<typeof evaluateAchievements>>) {
  const done = session.sets.filter((s) => !s.skipped);
  const durationSeconds = session.durationSeconds ?? 0;
  const kcal = await sessionKcal(done, durationSeconds / 60, weightKg);
  const prs = await db.personalRecord.findMany({ where: { userId, sessionId: session.id }, include: { exercise: { select: { name: true } } } });
  return {
    durationSeconds,
    setsCompleted: done.length,
    setsSkipped: session.sets.length - done.length,
    totalReps: done.reduce((s, x) => s + (x.reps ?? 0), 0),
    totalSeconds: done.reduce((s, x) => s + (x.seconds ?? 0), 0),
    volumeKg: done.reduce((s, x) => s + (x.reps ?? 0) * (x.loadKg ?? 0), 0),
    kcal: { ...kcal, low: session.kcalLow ?? kcal.low, high: session.kcalHigh ?? kcal.high },
    prs: prs.map((r) => ({ exercise: r.exercise.name, metric: r.metric, value: r.value })),
    achievements,
  };
}

/** Summary of an already completed workout (for a retried completion or reopening the page). */
export async function completedSummary(userId: string, sessionId: string) {
  const { session } = await getSession(userId, sessionId);
  if (session.status !== "completed") throw conflict("This workout isn't finished yet");
  const p = await getProfile(userId);
  return sessionSummary(userId, session, p.weightKg, []);
}

export async function completeSession(userId: string, sessionId: string, input: { rpe?: number; notes?: string }) {
  const { session, workout } = await getSession(userId, sessionId);
  // A retry (lost response, double tap) gets the same summary instead of an error.
  if (session.status === "completed") return completedSummary(userId, sessionId);
  if (session.status === "abandoned") throw conflict("This workout was ended");
  const done = session.sets.filter((s) => !s.skipped);
  if (!done.length) throw badRequest("Log at least one set before completing the workout");

  const p = await getProfile(userId);
  const now = new Date();
  const pausedExtra = session.status === "paused" && session.pausedAt ? Math.round((now.getTime() - session.pausedAt.getTime()) / 1000) : 0;
  const durationSeconds = Math.max(60, Math.round((now.getTime() - session.startedAt.getTime()) / 1000) - session.pausedSeconds - pausedExtra);
  const durationMin = durationSeconds / 60;
  const kcal = await sessionKcal(done, durationMin, p.weightKg);
  const dateKey = todayKey(p.timezone);
  const rpe = input.rpe ?? null;

  // Claim the session atomically: of two concurrent completions only one records anything.
  const claimed = await db.workoutSession.updateMany({
    where: { id: session.id, status: { in: ["active", "paused"] } },
    data: { status: "completed", activeKey: null, endedAt: now, pausedAt: null, durationSeconds, rpe, notes: input.notes?.slice(0, 1000) ?? session.notes, kcalLow: kcal.low, kcalHigh: kcal.high, dateKey },
  });
  if (!claimed.count) return completedSummary(userId, sessionId);
  try {
    await db.$transaction([
      // One activity entry per workout (unique on workoutSessionId) prevents double counting.
      db.activityEntry.create({
        data: {
          userId,
          sport: p.sports.includes("gym") && !p.sports.includes("calisthenics") ? "gym" : "calisthenics",
          title: workout.title,
          dateKey,
          startedAt: session.startedAt,
          durationMin: Math.round(durationMin * 10) / 10,
          intensity: !rpe ? "moderate" : rpe <= 4 ? "light" : rpe <= 7 ? "moderate" : "vigorous",
          rpe,
          kcalLow: kcal.low,
          kcalHigh: kcal.high,
          source: "workout",
          workoutSessionId: session.id,
        },
      }),
      ...(session.planId ? [db.workoutPlan.update({ where: { id: session.planId }, data: { status: "completed" } })] : []),
    ]);
  } catch (e) {
    // Put the session back so the user can finish it again.
    await db.workoutSession.update({ where: { id: session.id }, data: { status: session.status, activeKey: userId, endedAt: null, pausedAt: session.pausedAt, durationSeconds: null, dateKey: null } }).catch(() => undefined);
    throw e;
  }

  await awardXp(userId, "workout", session.id, XP.workout + Math.min(60, Math.round(durationMin)) * XP.workoutPerMinute);
  const achievements = await evaluateAchievements(userId);
  const { session: completed } = await getSession(userId, sessionId);
  return sessionSummary(userId, completed, p.weightKg, achievements);
}

export async function abandonSession(userId: string, sessionId: string) {
  const { session } = await getSession(userId, sessionId);
  if (session.status === "completed") throw conflict("Completed workouts can't be ended");
  // Discarded workouts leave no trace in bests: their sets are ignored and their records removed.
  await db.$transaction([
    db.workoutSession.update({ where: { id: session.id }, data: { status: "abandoned", activeKey: null, endedAt: new Date() } }),
    db.personalRecord.deleteMany({ where: { userId, sessionId: session.id } }),
  ]);
  if (session.planId) await db.workoutPlan.update({ where: { id: session.planId }, data: { status: "planned" } });
  return { ok: true };
}

export async function recentSessions(userId: string, limit = 20) {
  return db.workoutSession.findMany({
    where: { userId, status: "completed" },
    orderBy: { endedAt: "desc" },
    take: Math.min(limit, 100),
    select: { id: true, title: true, dateKey: true, durationSeconds: true, rpe: true, kcalLow: true, kcalHigh: true, _count: { select: { sets: true } } },
  });
}
