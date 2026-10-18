import { z } from "zod";
import { db } from "../server/db";
import { badRequest } from "../server/errors";
import { parseJson } from "../server/json";
import { addDays, todayKey, weekday } from "../domain/dates";
import { readinessBand } from "../domain/readiness";
import { recommend, type ExerciseSeries, type Recommendation } from "../domain/recommendation";
import { getProfile } from "./profile";
import { listSkills } from "./skills";
import { exerciseMap } from "./exercises";
import { regenerateToday } from "./workouts";

/** Collects the logged data the recommendation is based on (and only that). */
export async function nextRecommendation(userId: string): Promise<Recommendation & { dateKey: string; feedback: { action: string; at: Date } | null }> {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const since = addDays(today, -90);
  const [checkIn, sessions, lastActivity, skills, map, feedback] = await Promise.all([
    db.checkIn.findUnique({ where: { userId_dateKey: { userId, dateKey: today } } }),
    db.workoutSession.findMany({
      where: { userId, status: "completed", dateKey: { gte: since } },
      orderBy: [{ dateKey: "desc" }, { endedAt: "desc" }],
      take: 30,
      select: { dateKey: true, rpe: true, sets: { select: { exerciseId: true, reps: true, seconds: true, skipped: true } } },
    }),
    db.activityEntry.findFirst({ where: { userId, dateKey: { lte: today } }, orderBy: { dateKey: "desc" }, select: { dateKey: true } }),
    listSkills(userId),
    exerciseMap(),
    db.recommendationFeedback.findFirst({ where: { userId, dateKey: today }, orderBy: { createdAt: "desc" } }),
  ]);
  const recent = sessions.map((s) => ({ dateKey: s.dateKey!, rpe: s.rpe, setsDone: s.sets.filter((x) => !x.skipped).length, setsSkipped: s.sets.filter((x) => x.skipped).length }));
  const lastWorkout = recent[0]?.dateKey ?? null;
  const lastActiveDate = [lastWorkout, lastActivity?.dateKey ?? null].filter(Boolean).sort().at(-1) ?? null;

  // Best set per session for each exercise (oldest first).
  const byId = new Map([...map.values()].map((e) => [e.id, e]));
  const series = new Map<string, ExerciseSeries>();
  for (const s of [...sessions].reverse()) {
    const best = new Map<string, number>();
    for (const set of s.sets) {
      if (set.skipped) continue;
      const ex = byId.get(set.exerciseId);
      if (!ex) continue;
      const v = ex.isTimed ? set.seconds : set.reps;
      if (v != null) best.set(ex.slug, Math.max(best.get(ex.slug) ?? 0, v));
    }
    for (const [slug, v] of best) {
      const ex = map.get(slug)!;
      const entry: ExerciseSeries = series.get(slug) ?? {
        slug,
        name: ex.name,
        metric: ex.isTimed ? "seconds" : "reps",
        points: [],
        easier: ex.easier[0] && map.get(ex.easier[0]) ? { slug: ex.easier[0], name: map.get(ex.easier[0])!.name } : null,
        harder: ex.harder[0] && map.get(ex.harder[0]) ? { slug: ex.harder[0], name: map.get(ex.harder[0])!.name } : null,
      };
      entry.points.push({ dateKey: s.dateKey!, best: v });
      series.set(slug, entry);
    }
  }

  // Skills the user has started whose prerequisites aren't met (e.g. after editing their profile).
  const missingPrerequisites = skills
    .filter((s) => s.progress && !s.completed && !s.prerequisitesMet)
    .flatMap((s) => s.prereqs.filter((pr) => !pr.met).map((pr) => ({ skill: s.skill.name, label: pr.label, best: pr.best, target: pr.value, source: pr.source })));

  const rec = recommend({
    today,
    isTrainingDay: p.trainingDays.length ? p.trainingDays.includes(weekday(today)) : true,
    doneToday: lastWorkout === today,
    checkIn: checkIn ? { band: readinessBand(checkIn.readiness, checkIn.pain), readiness: checkIn.readiness, pain: checkIn.pain } : null,
    recent,
    lastActiveDate,
    plannedMinutes: p.sessionMinutes,
    series: [...series.values()],
    missingPrerequisites,
  });
  return { ...rec, dateKey: today, feedback: feedback ? { action: feedback.action, at: feedback.createdAt } : null };
}

export const respondSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("modify"), minutes: z.number().int().min(10).max(120).optional(), focus: z.string().max(30).optional(), volumeScale: z.number().min(0.5).max(1).optional() }),
  z.object({ action: z.literal("reject"), reason: z.string().max(300).optional() }),
]);

/**
 * Accept applies the suggestion to today's workout, modify applies the user's own changes, reject
 * changes nothing. Every response is recorded so the suggestion isn't pushed again today.
 */
export async function respondToRecommendation(userId: string, input: z.infer<typeof respondSchema>) {
  const rec = await nextRecommendation(userId);
  const detail = (extra: object) => JSON.stringify({ suggestion: { kind: rec.kind, difficulty: rec.difficulty, volumeScale: rec.volumeScale, reasons: rec.reasons }, ...extra });
  if (input.action === "reject") {
    await db.recommendationFeedback.create({ data: { userId, dateKey: rec.dateKey, action: "rejected", detail: detail({ reason: input.reason ?? null }) } });
    return { action: "rejected" as const, plan: null };
  }
  if (input.action === "accept" && rec.kind !== "train" && rec.kind !== "recover") throw badRequest("There's no workout change to apply today.");
  const overrides =
    input.action === "accept"
      ? { volumeScale: rec.volumeScale }
      : { minutes: input.minutes, focus: input.focus, volumeScale: input.volumeScale };
  const result = await regenerateToday(userId, overrides);
  await db.recommendationFeedback.create({ data: { userId, dateKey: rec.dateKey, action: input.action === "accept" ? "accepted" : "modified", detail: detail({ applied: overrides, planId: result.plan.id }) } });
  return { action: input.action === "accept" ? ("accepted" as const) : ("modified" as const), plan: result.plan, workout: result.workout };
}

export const feedbackHistory = async (userId: string) =>
  (await db.recommendationFeedback.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 })).map((f) => ({ ...f, detail: parseJson(f.detail ?? "{}", z.record(z.string(), z.unknown()), {}) }));
