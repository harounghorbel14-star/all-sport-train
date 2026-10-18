import type { Drill, Lesson, Ruleset, Sport, SportMetric } from "@prisma/client";
import { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { addDays, todayKey } from "../domain/dates";
import { exerciseKcal } from "../domain/energy";
import { XP } from "../domain/levels";
import {
  drillContentSchema,
  lessonContentSchema,
  LEVELS,
  levelRank,
  rulePointSchema,
  sportProfileSchema,
  type Level,
} from "../content/sports/types";
import {
  generatePractice,
  isImprovement,
  milestoneMet,
  nextLesson,
  personalBests,
  practiceContentSchema,
  ratioValue,
  weeklyPlan,
  type PracticeFocus,
  type PracticeSetting,
} from "../engine/practice";
import { getProfile } from "./profile";
import { awardXp, evaluateAchievements } from "./gamification";

const strArr = z.array(z.string());

// ── Views ──────────────────────────────────────────────────────────────
export function metricView(m: SportMetric) {
  return { ...m, options: parseJson(m.options, strArr, []) };
}
export type MetricView = ReturnType<typeof metricView>;

export function sportSummaryView(s: Sport) {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    categorySlug: s.categorySlug,
    parentSlug: s.parentSlug,
    summary: s.summary,
    aliases: parseJson(s.aliases, strArr, []),
    availability: s.availability as "full" | "basic" | "external",
    contentStatus: s.contentStatus,
    met: [s.metLight, s.metModerate, s.metVigorous] as [number, number, number],
    distanceUnit: s.distanceUnit as "km" | "m" | null,
    workoutBased: s.workoutBased,
  };
}
export type SportSummary = ReturnType<typeof sportSummaryView>;

const lessonView = (l: Lesson) => ({
  ...l,
  content: parseJson(l.content, lessonContentSchema, { objectives: [], keyPoints: [] }),
  prerequisites: parseJson(l.prerequisites, strArr, []),
  drillSlugs: parseJson(l.drillSlugs, strArr, []),
  sources: parseJson(l.sources, strArr, []),
});
export type LessonView = ReturnType<typeof lessonView>;

const drillView = (d: Drill) => ({
  ...d,
  equipment: parseJson(d.equipment, strArr, []),
  content: parseJson(d.content, drillContentSchema, { setup: [], instructions: [], coachingPoints: [] }),
});
export type DrillView = ReturnType<typeof drillView>;

const rulesetView = (r: Ruleset) => ({ ...r, points: parseJson(r.points, z.array(rulePointSchema), []), sources: parseJson(r.sources, strArr, []) });
export type RulesetView = ReturnType<typeof rulesetView>;

// ── Catalog (cached) ───────────────────────────────────────────────────
let cache: { at: number; sports: (SportSummary & { metrics: MetricView[] })[] } | null = null;
export const invalidateSportsCache = () => {
  cache = null;
};

/** Published sports with their metric definitions, cached briefly. */
export async function publishedSports() {
  if (cache && Date.now() - cache.at < 60_000) return cache.sports;
  const rows = await db.sport.findMany({ where: { contentStatus: "published" }, include: { metrics: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } });
  cache = { at: Date.now(), sports: rows.map((s) => ({ ...sportSummaryView(s), metrics: s.metrics.map(metricView) })) };
  return cache.sports;
}

export async function sportBySlug(slug: string) {
  return (await publishedSports()).find((s) => s.slug === slug) ?? null;
}

export async function sportOptions() {
  return (await publishedSports()).map((s) => ({ slug: s.slug, name: s.name, categorySlug: s.categorySlug }));
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function searchSports(filters: { q?: string; category?: string; availability?: string }) {
  let list = await publishedSports();
  const q = filters.q?.trim() ? norm(filters.q.trim()) : "";
  if (q) {
    list = list
      .map((s) => {
        const name = norm(s.name);
        const score = name === q ? 4 : name.startsWith(q) ? 3 : name.includes(q) ? 2 : s.aliases.some((a) => norm(a).includes(q)) ? 1.5 : norm(s.summary).includes(q) ? 1 : 0;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
      .map((x) => x.s);
  }
  if (filters.category) list = list.filter((s) => s.categorySlug === filters.category);
  if (filters.availability) list = list.filter((s) => s.availability === filters.availability);
  const categories = await db.sportCategory.findMany({ orderBy: { order: "asc" } });
  return { sports: list.map(({ metrics: _m, ...s }) => ({ ...s, metricCount: _m.length })), categories };
}

// ── Sport hub ──────────────────────────────────────────────────────────
async function loadSport(slug: string, includeUnpublished = false) {
  const sport = await db.sport.findUnique({
    where: { slug },
    include: {
      metrics: { orderBy: { order: "asc" } },
      lessons: { where: includeUnpublished ? {} : { contentStatus: "published" }, orderBy: [{ order: "asc" }] },
      drills: { where: includeUnpublished ? {} : { contentStatus: "published" }, orderBy: { title: "asc" } },
      rulesets: { where: includeUnpublished ? {} : { contentStatus: "published" } },
    },
  });
  if (!sport || (!includeUnpublished && sport.contentStatus !== "published")) throw notFound("Sport not found");
  return sport;
}

export async function getSportHub(slug: string, userId?: string, opts: { includeUnpublished?: boolean } = {}) {
  const sport = await loadSport(slug, opts.includeUnpublished);
  const profile = parseJson(sport.profile, sportProfileSchema, {});
  const rulesets = sport.rulesets.map(rulesetView);
  const lessons = sport.lessons.map(lessonView);
  const sourceSlugs = [...new Set([...rulesets.flatMap((r) => r.sources), ...lessons.flatMap((l) => l.sources)])];
  const [sources, children, parent] = await Promise.all([
    db.contentSource.findMany({ where: { slug: { in: sourceSlugs } } }),
    db.sport.findMany({ where: { parentSlug: slug, contentStatus: "published" }, select: { slug: true, name: true, availability: true } }),
    sport.parentSlug ? db.sport.findUnique({ where: { slug: sport.parentSlug }, select: { slug: true, name: true } }) : null,
  ]);
  const base = {
    sport: sportSummaryView(sport),
    profile,
    metrics: sport.metrics.map(metricView),
    lessons,
    drills: sport.drills.map(drillView),
    rulesets,
    sources,
    children,
    parent,
    reviewedAt: sport.reviewedAt,
  };
  if (!userId) return { ...base, user: null };
  return { ...base, user: await userSportState(userId, sport.id, lessons, sport.metrics.map(metricView), profile) };
}
export type SportHub = Awaited<ReturnType<typeof getSportHub>>;

async function userSportState(userId: string, sportId: string, lessons: LessonView[], metrics: MetricView[], profile: z.infer<typeof sportProfileSchema>) {
  const [enrollment, progress, entries, practices] = await Promise.all([
    db.userSport.findUnique({ where: { userId_sportId: { userId, sportId } } }),
    db.lessonProgress.findMany({ where: { userId, lessonId: { in: lessons.map((l) => l.id) } } }),
    db.sportMetricEntry.findMany({ where: { userId, sportId }, orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }], take: 2000 }),
    db.practicePlan.findMany({ where: { userId, sportId, status: { not: "archived" } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const completed = new Set(progress.filter((p) => p.status === "completed").map((p) => lessons.find((l) => l.id === p.lessonId)?.slug).filter(Boolean) as string[]);
  const level = (enrollment?.level ?? "beginner") as Level;
  const pbs = personalBests(metrics, entries);
  const milestones = (profile.milestones ?? []).map((m) => {
    const metric = metrics.find((x) => x.key === m.metricKey);
    const best = m.metricKey ? pbs[m.metricKey]?.value : undefined;
    return { ...m, best: best ?? null, achieved: metric ? milestoneMet(metric.direction, best, m.target) : false };
  });
  return {
    enrollment: enrollment ? { ...enrollment, goals: parseJson(enrollment.goals, strArr, []) } : null,
    completedLessons: [...completed],
    nextLesson: nextLesson(lessons, completed, level)?.slug ?? null,
    entries: entries.map((e) => ({ id: e.id, metricKey: e.metricKey, value: e.value, made: e.made, attempts: e.attempts, dateKey: e.dateKey, context: e.context, notes: e.notes })),
    personalBests: Object.fromEntries(Object.entries(pbs).map(([k, v]) => [k, v ? { value: v.value, dateKey: v.dateKey } : null])),
    milestones,
    practices: practices.map((p) => ({ id: p.id, title: p.title, minutes: p.minutes, status: p.status, createdAt: p.createdAt, focus: p.focus })),
  };
}

// ── Enrollment ─────────────────────────────────────────────────────────
export const enrollSchema = z.object({
  level: z.enum(LEVELS),
  goals: z.array(z.string().max(80)).max(6).default([]),
  position: z.string().max(60).nullable().optional(),
  supervised: z.boolean().default(false),
});

export async function enroll(userId: string, slug: string, input: z.infer<typeof enrollSchema>) {
  const sport = await loadSport(slug);
  const data = { level: input.level, goals: JSON.stringify(input.goals), position: input.position ?? null, supervised: input.supervised };
  const row = await db.userSport.upsert({ where: { userId_sportId: { userId, sportId: sport.id } }, create: { userId, sportId: sport.id, ...data }, update: data });
  // Keep the profile's sport list in sync for onboarding/activity defaults.
  const p = await getProfile(userId);
  if (!p.sports.includes(slug)) await db.profile.update({ where: { userId }, data: { sports: JSON.stringify([...p.sports, slug]) } });
  return row;
}

export async function leaveSport(userId: string, slug: string) {
  const sport = await loadSport(slug);
  await db.userSport.deleteMany({ where: { userId, sportId: sport.id } });
}

export async function mySports(userId: string) {
  const rows = await db.userSport.findMany({ where: { userId }, include: { sport: true }, orderBy: { startedAt: "desc" } });
  return rows.filter((r) => r.sport.contentStatus === "published").map((r) => ({ ...sportSummaryView(r.sport), level: r.level, supervised: r.supervised }));
}

// ── Lessons ────────────────────────────────────────────────────────────
export async function getLesson(userId: string, sportSlug: string, lessonSlug: string) {
  const hub = await getSportHub(sportSlug, userId);
  const lesson = hub.lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) throw notFound("Lesson not found");
  const drills = hub.drills.filter((d) => lesson.drillSlugs.includes(d.slug));
  const idx = hub.lessons.indexOf(lesson);
  const prereqsMet = lesson.prerequisites.every((p) => hub.user?.completedLessons.includes(p));
  return { hub, lesson, drills, prereqsMet, previous: hub.lessons[idx - 1] ?? null, next: hub.lessons[idx + 1] ?? null };
}

export async function setLessonProgress(userId: string, sportSlug: string, lessonSlug: string, status: "in_progress" | "completed" | "reset") {
  const sport = await loadSport(sportSlug);
  const lesson = sport.lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) throw notFound("Lesson not found");
  if (status === "reset") {
    await db.lessonProgress.deleteMany({ where: { userId, lessonId: lesson.id } });
    return { status: "reset" };
  }
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    create: { userId, lessonId: lesson.id, status, completedAt: status === "completed" ? new Date() : null },
    update: { status, completedAt: status === "completed" ? new Date() : null },
  });
  // Learning a sport implies enrolment.
  const enrolled = await db.userSport.findUnique({ where: { userId_sportId: { userId, sportId: sport.id } } });
  if (!enrolled) await db.userSport.create({ data: { userId, sportId: sport.id } });
  if (status === "completed") await awardXp(userId, "lesson", lesson.id, 15);
  const lessons = sport.lessons.map(lessonView);
  const done = await db.lessonProgress.findMany({ where: { userId, status: "completed", lessonId: { in: lessons.map((l) => l.id) } } });
  const completed = new Set(done.map((d) => lessons.find((l) => l.id === d.lessonId)!.slug));
  return { status, next: nextLesson(lessons, completed, enrolled?.level ?? "beginner")?.slug ?? null };
}

// ── Practice plans ─────────────────────────────────────────────────────
export const practiceRequestSchema = z.object({
  minutes: z.number().int().min(10).max(180),
  focus: z.enum(["balanced", "technique", "tactical", "conditioning", "game"]).default("balanced"),
  setting: z.enum(["solo", "partner", "team"]).default("solo"),
  players: z.number().int().min(1).max(40).default(1),
});

export async function createPractice(userId: string, slug: string, req: z.infer<typeof practiceRequestSchema>, source: "engine" | "coach" = "engine") {
  const hub = await getSportHub(slug, userId);
  if (!hub.drills.length) throw badRequest(`${hub.sport.name} doesn't have a drill library yet — use the activity log and the session templates instead.`);
  const p = await getProfile(userId);
  const enrollment = hub.user?.enrollment;
  const next = hub.lessons.find((l) => l.slug === hub.user?.nextLesson);
  const content = generatePractice({
    sportName: hub.sport.name,
    drills: hub.drills.map((d) => ({ slug: d.slug, title: d.title, level: d.level, focus: d.focus, durationMin: d.durationMin, setting: d.setting, minPlayers: d.minPlayers, contact: d.contact, requiresSupervision: d.requiresSupervision, metricKey: d.metricKey, equipment: d.equipment })),
    conditioningExercises: hub.profile.conditioning?.exercises ?? [],
    level: (enrollment?.level ?? "beginner") as Level,
    minutes: req.minutes,
    focus: req.focus as PracticeFocus,
    setting: req.setting as PracticeSetting,
    players: req.setting === "solo" ? 1 : Math.max(req.players, req.setting === "partner" ? 2 : 3),
    supervised: !!enrollment?.supervised,
    under18: p.ageRange === "under18",
    preferredDrills: next?.drillSlugs,
    seed: `${userId}:${slug}:${todayKey(p.timezone)}:${req.focus}:${req.minutes}:${req.setting}`,
  });
  return db.practicePlan.create({
    data: { userId, sportId: (await loadSport(slug)).id, title: content.title, focus: content.focus, minutes: content.minutes, content: JSON.stringify(content), source },
  });
}

export async function getPractice(userId: string, id: string) {
  const plan = await db.practicePlan.findFirst({ where: { id, userId }, include: { sport: true } });
  if (!plan) throw notFound("Practice plan not found");
  const content = parseJson(plan.content, practiceContentSchema, null as never);
  if (!content) throw badRequest("Stored practice plan is invalid");
  return { plan, content, sport: sportSummaryView(plan.sport) };
}

export const metricEntrySchema = z.object({
  metricKey: z.string().max(40),
  value: z.number().optional(),
  made: z.number().int().min(0).max(10000).optional(),
  attempts: z.number().int().min(1).max(10000).optional(),
  context: z.enum(["practice", "test", "match", "drill"]).default("practice"),
  notes: z.string().max(300).optional(),
});
export type MetricEntryInput = z.infer<typeof metricEntrySchema>;

/** Validates a metric value against its definition (kind, range, ratio rules). */
function resolveMetricValue(metric: MetricView, input: MetricEntryInput) {
  if (metric.scope !== "performance") throw badRequest(`${metric.label} is logged with an activity, not as a performance entry`);
  if (metric.kind === "ratio") {
    if (input.made == null || input.attempts == null) throw badRequest(`${metric.label}: enter made and attempts`);
    try {
      return { value: ratioValue(input.made, input.attempts), made: input.made, attempts: input.attempts };
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : "Invalid ratio");
    }
  }
  if (metric.kind === "select") {
    const idx = Number(input.value);
    if (!Number.isInteger(idx) || idx < 1 || idx > metric.options.length) throw badRequest(`${metric.label}: choose an option`);
    return { value: idx, made: null, attempts: null };
  }
  if (metric.kind === "text") throw badRequest("Text metrics are logged with activities");
  const v = Number(input.value);
  if (!Number.isFinite(v)) throw badRequest(`${metric.label}: enter a number`);
  if ((metric.min != null && v < metric.min) || (metric.max != null && v > metric.max)) throw badRequest(`${metric.label} must be between ${metric.min ?? "–"} and ${metric.max ?? "–"}`);
  return { value: v, made: null, attempts: null };
}

export async function logMetric(userId: string, slug: string, input: MetricEntryInput & { dateKey: string; practicePlanId?: string | null }) {
  const sport = await loadSport(slug);
  const metric = sport.metrics.map(metricView).find((m) => m.key === input.metricKey);
  if (!metric) throw badRequest("Unknown metric for this sport");
  const resolved = resolveMetricValue(metric, input);
  const previous = await db.sportMetricEntry.findMany({ where: { userId, sportId: sport.id, metricKey: metric.key }, select: { value: true, attempts: true, metricKey: true, dateKey: true } });
  const prevBest = personalBests([metric], previous)[metric.key]?.value;
  const entry = await db.sportMetricEntry.create({
    data: { userId, sportId: sport.id, metricKey: metric.key, ...resolved, dateKey: input.dateKey, context: input.context, notes: input.notes ?? null, practicePlanId: input.practicePlanId ?? null },
  });
  const eligible = metric.kind !== "ratio" || (resolved.attempts ?? 0) >= (metric.minAttempts ?? 1);
  return { entry, personalBest: eligible && isImprovement(metric.direction, prevBest, resolved.value), previousBest: prevBest ?? null, needsMoreAttempts: !eligible ? metric.minAttempts : null };
}

export async function deleteMetricEntry(userId: string, id: string) {
  const { count } = await db.sportMetricEntry.deleteMany({ where: { id, userId } });
  if (!count) throw notFound("Entry not found");
}

export const completePracticeSchema = z.object({
  durationMin: z.number().min(1).max(600),
  intensity: z.enum(["light", "moderate", "vigorous"]).default("moderate"),
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
  results: z.array(metricEntrySchema).max(20).default([]),
});

export async function completePractice(userId: string, id: string, input: z.infer<typeof completePracticeSchema>) {
  const { plan, sport } = await getPractice(userId, id);
  if (plan.status === "completed") throw conflict("Practice already completed");
  const p = await getProfile(userId);
  const dateKey = todayKey(p.timezone);
  const met = input.intensity === "light" ? sport.met[0] : input.intensity === "vigorous" ? sport.met[2] : sport.met[1];
  const kcal = exerciseKcal(met, input.durationMin, p.weightKg);
  // Validate all results before writing anything.
  const full = await loadSport(sport.slug);
  const metrics = full.metrics.map(metricView);
  for (const r of input.results) {
    const m = metrics.find((x) => x.key === r.metricKey);
    if (!m) throw badRequest(`Unknown metric: ${r.metricKey}`);
    resolveMetricValue(m, r);
  }
  // Claim the plan atomically so a double tap or a retry can't log the practice twice.
  const claimed = await db.practicePlan.updateMany({ where: { id: plan.id, status: { not: "completed" } }, data: { status: "completed", completedAt: new Date() } });
  if (!claimed.count) throw conflict("Practice already completed");
  let activity;
  try {
    activity = await db.activityEntry.create({
      data: { userId, sport: sport.slug, title: plan.title, dateKey, durationMin: input.durationMin, intensity: input.intensity, rpe: input.rpe ?? null, kcalLow: kcal.low, kcalHigh: kcal.high, source: "practice", notes: input.notes ?? null, metrics: "{}" },
    });
    await db.practicePlan.update({ where: { id: plan.id }, data: { activityId: activity.id, rpe: input.rpe ?? null, notes: input.notes ?? null } });
  } catch (e) {
    // Release the claim so the user can try again.
    await db.practicePlan.update({ where: { id: plan.id }, data: { status: plan.status, completedAt: null } }).catch(() => undefined);
    throw e;
  }
  const results = [];
  for (const r of input.results) results.push(await logMetric(userId, sport.slug, { ...r, dateKey, practicePlanId: plan.id }));
  await awardXp(userId, "practice", plan.id, XP.activity + 10);
  const achievements = await evaluateAchievements(userId);
  return { activityId: activity.id, kcal, results: results.map((r) => ({ metricKey: r.entry.metricKey, value: r.entry.value, personalBest: r.personalBest })), achievements };
}

// ── Review & weekly plan ───────────────────────────────────────────────
export async function sportReview(userId: string, slug: string) {
  const hub = await getSportHub(slug, userId);
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const from = addDays(today, -27);
  const activities = await db.activityEntry.findMany({ where: { userId, sport: slug, dateKey: { gte: from } }, orderBy: { dateKey: "asc" } });
  const entries = (hub.user?.entries ?? []).filter((e) => e.dateKey >= from);
  const trends = hub.metrics
    .filter((m) => m.scope === "performance" && m.direction !== "none")
    .map((m) => {
      const list = entries.filter((e) => e.metricKey === m.key);
      if (!list.length) return null;
      const first = list[0].value;
      const last = list[list.length - 1].value;
      const improved = isImprovement(m.direction, first, last);
      return { key: m.key, label: m.label, unit: m.unit, kind: m.kind, first, last, count: list.length, improved, best: hub.user?.personalBests[m.key]?.value ?? null };
    })
    .filter(Boolean) as { key: string; label: string; unit: string | null; kind: string; first: number; last: number; count: number; improved: boolean; best: number | null }[];
  const sessions = activities.length;
  const minutes = Math.round(activities.reduce((s, a) => s + a.durationMin, 0));
  const nextMilestone = hub.user?.milestones.find((m) => !m.achieved) ?? null;
  const recommendations: string[] = [];
  if (sessions === 0) recommendations.push(`No ${hub.sport.name.toLowerCase()} sessions logged in the last four weeks — start with a short practice from the builder.`);
  else if (sessions < 4) recommendations.push("Aim for at least one session a week to keep skills improving.");
  if (!trends.length && hub.metrics.some((m) => m.scope === "performance")) recommendations.push("Log a benchmark (e.g. a drill result) so progress can be measured.");
  for (const t of trends.filter((x) => !x.improved && x.count >= 3)) recommendations.push(`${t.label} hasn't improved over ${t.count} entries — revisit the related lesson and check recovery.`);
  if (hub.user?.nextLesson) recommendations.push(`Next lesson: ${hub.lessons.find((l) => l.slug === hub.user!.nextLesson)?.title}.`);
  return { sport: hub.sport, window: { from, to: today }, sessions, minutes, trends, nextMilestone, completedLessons: hub.user?.completedLessons.length ?? 0, totalLessons: hub.lessons.length, recommendations };
}

export async function sportWeek(userId: string, slug: string, sessionsPerWeek?: number) {
  const hub = await getSportHub(slug, userId);
  const p = await getProfile(userId);
  const n = sessionsPerWeek ?? Math.min(4, Math.max(2, p.daysPerWeek));
  const plan = weeklyPlan(hub.profile.weeklyStructure, n, p.trainingDays);
  const byFocus = (f: string) => hub.drills.filter((d) => d.focus === (f === "recovery" ? "cooldown" : f) && levelRank(d.level) <= levelRank(hub.user?.enrollment?.level ?? "beginner")).slice(0, 3).map((d) => d.title);
  return plan.map((d) => ({ ...d, examples: byFocus(d.focus) }));
}

// ── Admin content management ───────────────────────────────────────────
export const adminSportSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{2,40}$/),
  name: z.string().trim().min(2).max(80),
  categorySlug: z.string().max(30),
  parentSlug: z.string().max(40).nullable().optional(),
  summary: z.string().trim().min(10).max(400),
  aliases: z.array(z.string().max(40)).max(10).default([]),
  availability: z.enum(["full", "basic", "external"]),
  metLight: z.number().min(1).max(20),
  metModerate: z.number().min(1).max(20),
  metVigorous: z.number().min(1).max(25),
  distanceUnit: z.enum(["km", "m"]).nullable().optional(),
  profile: sportProfileSchema.default({}),
});

const STATUS = z.enum(["draft", "review", "published"]);

export async function adminListContent() {
  const [sports, lessons, drills, rulesets, sources] = await Promise.all([
    db.sport.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, categorySlug: true, availability: true, contentStatus: true, isCustom: true, _count: { select: { lessons: true, drills: true, rulesets: true } } } }),
    db.lesson.findMany({ where: { contentStatus: { not: "published" } }, include: { sport: { select: { slug: true, name: true } } } }),
    db.drill.findMany({ where: { contentStatus: { not: "published" } }, include: { sport: { select: { slug: true, name: true } } } }),
    db.ruleset.findMany({ where: { contentStatus: { not: "published" } }, include: { sport: { select: { slug: true, name: true } } } }),
    db.contentSource.findMany({ orderBy: { title: "asc" } }),
  ]);
  return { sports, queue: { lessons, drills, rulesets, sports: sports.filter((s) => s.contentStatus !== "published") }, sources };
}

export async function adminUpsertSport(input: z.infer<typeof adminSportSchema>) {
  const data = {
    name: input.name,
    categorySlug: input.categorySlug,
    parentSlug: input.parentSlug ?? null,
    summary: input.summary,
    aliases: JSON.stringify(input.aliases),
    availability: input.availability,
    metLight: input.metLight,
    metModerate: input.metModerate,
    metVigorous: input.metVigorous,
    distanceUnit: input.distanceUnit ?? null,
    profile: JSON.stringify(input.profile),
  };
  if (!(await db.sportCategory.findUnique({ where: { slug: input.categorySlug } }))) throw badRequest("Unknown category");
  const existing = await db.sport.findUnique({ where: { slug: input.slug } });
  const row = existing
    ? await db.sport.update({ where: { id: existing.id }, data: { ...data, isCustom: true } })
    : await db.sport.create({ data: { slug: input.slug, ...data, isCustom: true, contentStatus: "draft" } });
  invalidateSportsCache();
  return row;
}

export const adminLessonSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  title: z.string().trim().min(2).max(120),
  level: z.enum(LEVELS),
  order: z.number().int().min(0).max(999).default(0),
  summary: z.string().trim().min(5).max(400),
  content: lessonContentSchema,
  prerequisites: z.array(z.string().max(60)).max(10).default([]),
  drillSlugs: z.array(z.string().max(60)).max(10).default([]),
  requiresSupervision: z.boolean().default(false),
  sources: z.array(z.string().max(60)).max(10).default([]),
});
export const adminDrillSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  title: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(5).max(300),
  level: z.enum(LEVELS),
  focus: z.enum(["warmup", "technique", "tactical", "conditioning", "game", "cooldown"]),
  durationMin: z.number().int().min(2).max(120),
  setting: z.enum(["solo", "partner", "team"]),
  minPlayers: z.number().int().min(1).max(40).default(1),
  equipment: z.array(z.string().max(40)).max(10).default([]),
  contact: z.enum(["none", "light", "controlled", "full"]).default("none"),
  requiresSupervision: z.boolean().default(false),
  metricKey: z.string().max(40).nullable().optional(),
  content: drillContentSchema,
});
export const adminRulesetSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  name: z.string().trim().min(2).max(120),
  governingBody: z.string().trim().min(2).max(120),
  scope: z.string().trim().min(2).max(300),
  editionNote: z.string().trim().min(5).max(400),
  points: z.array(rulePointSchema).min(1).max(30),
  verification: z.enum(["summary", "general", "unverified"]),
  sources: z.array(z.string().max(60)).min(1, "Rules need at least one source").max(10),
});
export const adminSourceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  title: z.string().trim().min(2).max(200),
  publisher: z.string().trim().min(2).max(200),
  url: z.string().url().startsWith("https://").max(300).nullable().optional(),
  kind: z.enum(["governing_body", "education", "research", "other"]),
  notes: z.string().max(400).nullable().optional(),
});

/** Create or update content as a draft; it becomes visible only after publishing. */
export async function adminUpsertContent(sportSlug: string, type: "lesson" | "drill" | "ruleset", raw: unknown) {
  const sport = await db.sport.findUnique({ where: { slug: sportSlug } });
  if (!sport) throw notFound("Sport not found");
  if (type === "lesson") {
    const v = adminLessonSchema.parse(raw);
    const data = { title: v.title, level: v.level, order: v.order, summary: v.summary, content: JSON.stringify(v.content), prerequisites: JSON.stringify(v.prerequisites), drillSlugs: JSON.stringify(v.drillSlugs), requiresSupervision: v.requiresSupervision, sources: JSON.stringify(v.sources), contentStatus: "draft" };
    return db.lesson.upsert({ where: { sportId_slug: { sportId: sport.id, slug: v.slug } }, create: { sportId: sport.id, slug: v.slug, ...data }, update: data });
  }
  if (type === "drill") {
    const v = adminDrillSchema.parse(raw);
    const data = { title: v.title, purpose: v.purpose, level: v.level, focus: v.focus, durationMin: v.durationMin, setting: v.setting, minPlayers: v.minPlayers, equipment: JSON.stringify(v.equipment), contact: v.contact, requiresSupervision: v.requiresSupervision || v.contact === "controlled" || v.contact === "full", metricKey: v.metricKey ?? null, content: JSON.stringify(v.content), contentStatus: "draft" };
    return db.drill.upsert({ where: { sportId_slug: { sportId: sport.id, slug: v.slug } }, create: { sportId: sport.id, slug: v.slug, ...data }, update: data });
  }
  const v = adminRulesetSchema.parse(raw);
  const known = await db.contentSource.count({ where: { slug: { in: v.sources } } });
  if (known !== v.sources.length) throw badRequest("Every ruleset source must exist in the source registry");
  const data = { name: v.name, governingBody: v.governingBody, scope: v.scope, editionNote: v.editionNote, points: JSON.stringify(v.points), verification: v.verification, sources: JSON.stringify(v.sources), contentStatus: "draft", reviewedAt: null, reviewFlag: null, flaggedAt: null };
  // Keep the previous version before overwriting it.
  const previous = await db.ruleset.findUnique({ where: { sportId_slug: { sportId: sport.id, slug: v.slug } } });
  if (previous) await db.rulesetVersion.create({ data: { rulesetId: previous.id, snapshot: JSON.stringify(previous), reason: "admin edit" } });
  return db.ruleset.upsert({ where: { sportId_slug: { sportId: sport.id, slug: v.slug } }, create: { sportId: sport.id, slug: v.slug, ...data }, update: data });
}

/** Moves content through draft → review → published. Publishing records a review date. */
export async function adminSetStatus(type: "sport" | "lesson" | "drill" | "ruleset", id: string, status: z.infer<typeof STATUS>) {
  STATUS.parse(status);
  const reviewed = status === "published" ? { reviewedAt: new Date() } : {};
  switch (type) {
    case "sport":
      await db.sport.update({ where: { id }, data: { contentStatus: status, ...reviewed } });
      break;
    case "lesson":
      await db.lesson.update({ where: { id }, data: { contentStatus: status } });
      break;
    case "drill":
      await db.drill.update({ where: { id }, data: { contentStatus: status } });
      break;
    case "ruleset":
      await db.ruleset.update({ where: { id }, data: { contentStatus: status, ...reviewed } });
      break;
  }
  invalidateSportsCache();
  return { ok: true };
}

export async function adminUpsertSource(input: z.infer<typeof adminSourceSchema>) {
  const data = { title: input.title, publisher: input.publisher, url: input.url ?? null, kind: input.kind, notes: input.notes ?? null };
  return db.contentSource.upsert({ where: { slug: input.slug }, create: { slug: input.slug, ...data }, update: data });
}

export async function adminAddMetric(sportSlug: string, raw: unknown) {
  const { metricSeedSchema } = await import("../content/sports/types");
  const m = metricSeedSchema.parse(raw);
  const sport = await db.sport.findUnique({ where: { slug: sportSlug } });
  if (!sport) throw notFound("Sport not found");
  const data = { label: m.label, unit: m.unit ?? null, kind: m.kind, scope: m.scope, direction: m.direction, options: JSON.stringify(m.options ?? []), min: m.min ?? null, max: m.max ?? null, minAttempts: m.minAttempts ?? null, description: m.description ?? null, measurement: m.measurement ?? null };
  const row = await db.sportMetric.upsert({ where: { sportId_key: { sportId: sport.id, key: m.key } }, create: { sportId: sport.id, key: m.key, ...data, order: 99 }, update: data });
  invalidateSportsCache();
  return row;
}

/** Full editable view of one sport, including unpublished content. */
export async function adminGetSport(slug: string) {
  const sport = await loadSport(slug, true);
  return {
    sport: { ...sportSummaryView(sport), profile: parseJson(sport.profile, sportProfileSchema, {}), isCustom: sport.isCustom, reviewedAt: sport.reviewedAt },
    metrics: sport.metrics.map(metricView),
    lessons: sport.lessons.map((l) => ({ id: l.id, slug: l.slug, title: l.title, level: l.level, contentStatus: l.contentStatus })),
    drills: sport.drills.map((d) => ({ id: d.id, slug: d.slug, title: d.title, level: d.level, contentStatus: d.contentStatus })),
    rulesets: sport.rulesets.map((r) => ({ id: r.id, slug: r.slug, name: r.name, verification: r.verification, contentStatus: r.contentStatus, reviewedAt: r.reviewedAt })),
  };
}
