import { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { addDays, dateKey, todayKey, weekStart } from "../domain/dates";
import { dateKeySchema } from "../validation";
import { pbEligible } from "../engine/practice";
import { evaluateConsistency, evaluateLesson, evaluateMeasured, type GoalEvaluation, type GoalPoint, type GoalSpec } from "../domain/goals";
import { getProfile } from "./profile";
import { metricView } from "./sports";

const MAX_ACTIVE = 20;
const title = z.string().trim().min(1).max(80);
const common = { title: title.optional(), targetDate: dateKeySchema.nullish(), note: z.string().trim().max(300).nullish() };
const baselineInput = z.number().finite().nonnegative().optional();

export const goalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exercise"), exerciseSlug: z.string().max(80), metric: z.enum(["reps", "seconds", "loadKg"]), target: z.number().finite().positive().max(10_000), baseline: baselineInput, ...common }),
  z.object({ kind: z.literal("sport_metric"), sportSlug: z.string().max(80), metricKey: z.string().max(40), target: z.number().finite().max(1_000_000), baseline: baselineInput, ...common }),
  z.object({ kind: z.literal("consistency"), target: z.number().int().min(1).max(14), periodWeeks: z.number().int().min(1).max(26).default(4), ...common }),
  z.object({ kind: z.literal("lesson"), sportSlug: z.string().max(80), lessonSlug: z.string().max(80), ...common }),
]);
export type GoalInput = z.input<typeof goalSchema>;

export const goalPatchSchema = z
  .object({ title: title.optional(), target: z.number().finite().max(1_000_000).optional(), targetDate: dateKeySchema.nullish(), note: z.string().trim().max(300).nullish(), status: z.enum(["active", "abandoned"]).optional(), reason: z.string().trim().max(300).optional() })
  .refine((v) => Object.keys(v).some((k) => k !== "reason"), "Nothing to change");

const METRIC_LABEL = { reps: "reps", seconds: "seconds", loadKg: "kg" } as const;

/** Creates a goal. The starting point is the user's best logged result so far, a value they report (labelled), or none yet. */
export async function createGoal(userId: string, raw: GoalInput) {
  const input = goalSchema.parse(raw);
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  if (input.targetDate && input.targetDate < today) throw badRequest("Choose a target date from today on, or leave it empty");
  if ((await db.goal.count({ where: { userId, status: "active" } })) >= MAX_ACTIVE) throw conflict(`You can track up to ${MAX_ACTIVE} active goals. Abandon or finish one first.`);
  const base = { userId, kind: input.kind, targetDate: input.targetDate ?? null, note: input.note ?? null };

  if (input.kind === "exercise") {
    const ex = await db.exercise.findUnique({ where: { slug: input.exerciseSlug }, select: { slug: true, name: true } });
    if (!ex) throw badRequest("Unknown exercise");
    const points = await exercisePoints(userId, ex.slug, input.metric, p.timezone);
    const logged = bestOf("higher", points);
    const baseline = input.baseline ?? logged?.value ?? null;
    return db.goal.create({
      data: { ...base, title: input.title ?? `${ex.name}: ${input.target} ${METRIC_LABEL[input.metric]}`, exerciseSlug: ex.slug, metric: input.metric, direction: "higher", target: input.target, baseline, baselineSource: input.baseline != null ? "self_reported" : logged ? "logged" : null, baselineDate: input.baseline != null ? today : logged?.dateKey ?? null },
    });
  }
  if (input.kind === "sport_metric") {
    const sport = await db.sport.findFirst({ where: { slug: input.sportSlug, contentStatus: "published" }, include: { metrics: true } });
    if (!sport) throw badRequest("Unknown sport");
    const metric = sport.metrics.map(metricView).find((m) => m.key === input.metricKey);
    if (!metric || !["number", "time", "ratio"].includes(metric.kind) || !["higher", "lower"].includes(metric.direction)) throw badRequest("That result can't be tracked as a goal");
    if ((metric.min != null && input.target < metric.min) || (metric.max != null && input.target > metric.max)) throw badRequest(`Target must be between ${metric.min ?? "…"} and ${metric.max ?? "…"}`);
    const dir = metric.direction as "higher" | "lower";
    const points = await sportPoints(userId, sport.id, metric);
    const logged = bestOf(dir, points);
    const baseline = input.baseline ?? logged?.value ?? null;
    return db.goal.create({
      data: { ...base, title: input.title ?? `${sport.name} — ${metric.label}: ${input.target}${metric.unit ? ` ${metric.unit}` : ""}`, sportSlug: sport.slug, metricKey: metric.key, direction: dir, target: input.target, baseline, baselineSource: input.baseline != null ? "self_reported" : logged ? "logged" : null, baselineDate: input.baseline != null ? today : logged?.dateKey ?? null },
    });
  }
  if (input.kind === "consistency") {
    return db.goal.create({ data: { ...base, title: input.title ?? `${input.target}× a week for ${input.periodWeeks} weeks`, direction: "higher", target: input.target, periodWeeks: input.periodWeeks } });
  }
  const lesson = await db.lesson.findFirst({ where: { slug: input.lessonSlug, contentStatus: "published", sport: { slug: input.sportSlug, contentStatus: "published" } }, include: { sport: { select: { slug: true, name: true } } } });
  if (!lesson) throw badRequest("Unknown lesson");
  return db.goal.create({ data: { ...base, title: input.title ?? `Complete "${lesson.title}" (${lesson.sport.name})`, sportSlug: lesson.sport.slug, lessonSlug: lesson.slug, direction: "higher", target: 1 } });
}

/** Goals with progress computed from current records (so corrections and deletions are reflected immediately). */
export async function listGoals(userId: string, opts: { includeAbandoned?: boolean } = {}) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const goals = await db.goal.findMany({ where: { userId, ...(opts.includeAbandoned ? {} : { status: "active" }) }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const out = [];
  for (const g of goals) {
    const evaluation = await evaluate(userId, g, p.timezone, today);
    // Keep the stored achievement date in step with the records (a corrected result can undo it).
    const achievedAt = evaluation.achieved ? g.achievedAt ?? new Date() : null;
    if ((achievedAt === null) !== (g.achievedAt === null)) await db.goal.update({ where: { id: g.id }, data: { achievedAt } });
    out.push({ ...g, achievedAt, evaluation });
  }
  return out;
}

export async function getGoal(userId: string, id: string) {
  const g = await db.goal.findFirst({ where: { id, userId } });
  if (!g) throw notFound("Goal not found");
  const p = await getProfile(userId);
  return { ...g, evaluation: await evaluate(userId, g, p.timezone, todayKey(p.timezone)) };
}

/** Changes a goal (title, target, date, note, abandon/restore). The previous values are kept in the correction log. */
export async function updateGoal(userId: string, id: string, raw: z.input<typeof goalPatchSchema>) {
  const { reason, ...changes } = goalPatchSchema.parse(raw);
  const g = await db.goal.findFirst({ where: { id, userId } });
  if (!g) throw notFound("Goal not found");
  if (changes.target !== undefined) {
    if (g.kind === "lesson") throw badRequest("A lesson goal's target is completing the lesson");
    if (g.kind === "consistency" && (!Number.isInteger(changes.target) || changes.target < 1 || changes.target > 14)) throw badRequest("Sessions per week must be 1–14");
    if (g.kind === "exercise" && changes.target <= 0) throw badRequest("Target must be above zero");
  }
  if (changes.targetDate) {
    const p = await getProfile(userId);
    if (changes.targetDate < todayKey(p.timezone) && changes.targetDate !== g.targetDate) throw badRequest("Choose a target date from today on, or leave it empty");
  }
  if (changes.status === "active" && g.status !== "active" && (await db.goal.count({ where: { userId, status: "active" } })) >= MAX_ACTIVE) throw conflict(`You can track up to ${MAX_ACTIVE} active goals.`);
  const keys = Object.keys(changes) as (keyof typeof changes)[];
  const before = Object.fromEntries(keys.map((k) => [k, g[k as keyof typeof g] ?? null]));
  return db.$transaction(async (tx) => {
    const u = await tx.goal.update({ where: { id: g.id }, data: changes });
    await tx.recordCorrection.create({ data: { userId, recordType: "goal", recordId: g.id, before: JSON.stringify(before), after: JSON.stringify(changes), reason: reason ?? null } });
    return u;
  });
}

type GoalRow = Awaited<ReturnType<typeof db.goal.findFirstOrThrow>>;

async function evaluate(userId: string, g: GoalRow, timeZone: string, today: string): Promise<GoalEvaluation> {
  const spec: GoalSpec = {
    kind: g.kind as GoalSpec["kind"],
    direction: g.direction === "lower" ? "lower" : "higher",
    baseline: g.baseline,
    baselineSource: g.baselineSource,
    baselineDate: g.baselineDate,
    target: g.target,
    periodWeeks: g.periodWeeks,
    targetDate: g.targetDate,
    createdOn: dateKey(g.createdAt, timeZone),
  };
  if (g.kind === "exercise" && g.exerciseSlug && g.metric) return evaluateMeasured(spec, await exercisePoints(userId, g.exerciseSlug, g.metric, timeZone), today);
  if (g.kind === "sport_metric" && g.sportSlug && g.metricKey) {
    const sport = await db.sport.findUnique({ where: { slug: g.sportSlug }, include: { metrics: true } });
    const metric = sport?.metrics.map(metricView).find((m) => m.key === g.metricKey);
    return evaluateMeasured(spec, sport && metric ? await sportPoints(userId, sport.id, metric) : [], today);
  }
  if (g.kind === "consistency") return evaluateConsistency(spec, await weeklySessions(userId, spec.createdOn, today), weekStart(today), today);
  const lesson = g.lessonSlug ? await db.lesson.findFirst({ where: { slug: g.lessonSlug, sport: { slug: g.sportSlug ?? "" } }, select: { id: true } }) : null;
  const lp = lesson ? await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } }) : null;
  return evaluateLesson((lp?.status as "in_progress" | "awaiting_assessment" | "completed") ?? "not_started", lp?.evidence ?? null, lp?.completedAt ? dateKey(lp.completedAt, timeZone) : null);
}

/** Best value per day from completed workouts (skipped sets and abandoned workouts never count). */
async function exercisePoints(userId: string, slug: string, metric: string, timeZone: string): Promise<GoalPoint[]> {
  const field = metric === "seconds" ? "seconds" : metric === "loadKg" ? "loadKg" : "reps";
  const sets = await db.setLog.findMany({
    where: { skipped: false, exercise: { slug }, session: { userId, status: "completed" }, [field]: { not: null } },
    select: { reps: true, seconds: true, loadKg: true, completedAt: true, session: { select: { dateKey: true } } },
  });
  const byDay = new Map<string, number>();
  for (const s of sets) {
    const v = s[field];
    if (v == null || v <= 0) continue;
    const k = s.session.dateKey ?? dateKey(s.completedAt, timeZone);
    byDay.set(k, Math.max(byDay.get(k) ?? 0, v));
  }
  return [...byDay.entries()].map(([k, value]) => ({ dateKey: k, value, source: "logged" as const }));
}

async function sportPoints(userId: string, sportId: string, metric: ReturnType<typeof metricView>): Promise<GoalPoint[]> {
  const entries = await db.sportMetricEntry.findMany({ where: { userId, sportId, metricKey: metric.key }, select: { metricKey: true, value: true, attempts: true, made: true, dateKey: true } });
  // Results are entered by the user: labelled self-reported. Ratios count only with enough attempts.
  return entries.filter((e) => pbEligible(metric, e)).map((e) => ({ dateKey: e.dateKey, value: e.value, source: "self_reported" as const }));
}

/** Sessions per week since the goal's week: completed workouts plus other logged activities. */
async function weeklySessions(userId: string, createdOn: string, today: string) {
  const from = weekStart(createdOn);
  const [workouts, activities] = await Promise.all([
    db.workoutSession.findMany({ where: { userId, status: "completed", dateKey: { gte: from, lte: today } }, select: { dateKey: true } }),
    db.activityEntry.findMany({ where: { userId, source: { not: "workout" }, dateKey: { gte: from, lte: today } }, select: { dateKey: true } }),
  ]);
  const weeks: { weekStart: string; sessions: number }[] = [];
  for (let w = from; w <= today; w = addDays(w, 7)) weeks.push({ weekStart: w, sessions: 0 });
  for (const r of [...workouts, ...activities]) {
    if (!r.dateKey) continue;
    const wk = weeks.find((x) => x.weekStart === weekStart(r.dateKey!));
    if (wk) wk.sessions += 1;
  }
  return weeks;
}

function bestOf(dir: "higher" | "lower", points: GoalPoint[]) {
  return points.reduce<GoalPoint | null>((b, p) => (!b || (dir === "lower" ? p.value < b.value : p.value > b.value) ? p : b), null);
}

/** What a goal can be set on: every exercise, plus results and lessons of the sports the user has joined. */
export async function goalOptions(userId: string) {
  const [exercises, enrolled] = await Promise.all([
    db.exercise.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.userSport.findMany({
      where: { userId, sport: { contentStatus: "published" } },
      select: { sport: { select: { slug: true, name: true, metrics: { orderBy: { order: "asc" } }, lessons: { where: { contentStatus: "published" }, select: { slug: true, title: true, level: true, order: true }, orderBy: [{ order: "asc" }] } } } },
    }),
  ]);
  return {
    exercises,
    sports: enrolled.map(({ sport }) => ({
      slug: sport.slug,
      name: sport.name,
      metrics: sport.metrics
        .map(metricView)
        .filter((m) => m.scope === "performance" && ["number", "time", "ratio"].includes(m.kind) && ["higher", "lower"].includes(m.direction))
        .map((m) => ({ key: m.key, label: m.label, unit: m.unit, kind: m.kind, direction: m.direction, min: m.min, max: m.max })),
      lessons: sport.lessons.map((l) => ({ slug: l.slug, title: l.title, level: l.level })),
    })),
  };
}
