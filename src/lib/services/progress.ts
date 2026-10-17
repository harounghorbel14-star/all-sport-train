import type { z } from "zod";
import { db } from "../server/db";
import { notFound } from "../server/errors";
import { addDays, todayKey, weekStart } from "../domain/dates";
import type { measurementSchema } from "../validation";
import { getProfile } from "./profile";

export async function addMeasurement(userId: string, input: z.infer<typeof measurementSchema>) {
  const m = await db.bodyMeasurement.create({ data: { userId, ...input } });
  if (input.weightKg || input.heightCm) {
    // Latest weight/height feed calorie estimates.
    const latest = await db.bodyMeasurement.findFirst({ where: { userId }, orderBy: [{ dateKey: "desc" }, { createdAt: "desc" }] });
    if (latest?.id === m.id) {
      await db.profile.update({ where: { userId }, data: { ...(input.weightKg ? { weightKg: input.weightKg } : {}), ...(input.heightCm ? { heightCm: input.heightCm } : {}) } });
    }
  }
  return m;
}

export async function listMeasurements(userId: string) {
  return db.bodyMeasurement.findMany({ where: { userId }, orderBy: [{ dateKey: "desc" }, { createdAt: "desc" }], take: 200 });
}

export async function deleteMeasurement(userId: string, id: string) {
  const { count } = await db.bodyMeasurement.deleteMany({ where: { id, userId } });
  if (!count) throw notFound("Measurement not found");
}

export const RANGES = { "4w": 4, "12w": 12, "24w": 24, "52w": 52 } as const;
export type RangeKey = keyof typeof RANGES;

/** Analytics computed only from persisted data. Weeks without data are zeros, never invented. */
export async function analytics(userId: string, range: RangeKey = "12w", exerciseSlug?: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const weeks = RANGES[range] ?? 12;
  const firstWeek = addDays(weekStart(today), -(weeks - 1) * 7);
  const weekKeys = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7));

  const [sessions, activities, food, measurements, mobility] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, status: "completed", dateKey: { gte: firstWeek } },
      select: { id: true, dateKey: true, durationSeconds: true, sets: { where: { skipped: false }, select: { reps: true, loadKg: true, seconds: true } } },
    }),
    db.activityEntry.findMany({ where: { userId, dateKey: { gte: firstWeek } }, select: { dateKey: true, durationMin: true, kcalLow: true, kcalHigh: true, sport: true } }),
    db.foodEntry.groupBy({ by: ["dateKey"], where: { userId, dateKey: { gte: firstWeek } }, _sum: { kcal: true, proteinG: true } }),
    db.bodyMeasurement.findMany({ where: { userId, dateKey: { gte: firstWeek } }, orderBy: { dateKey: "asc" } }),
    db.mobilitySession.findMany({ where: { userId, dateKey: { gte: firstWeek } }, select: { dateKey: true, minutes: true } }),
  ]);

  const wk = (d: string) => weekStart(d);
  const perWeek = weekKeys.map((w) => {
    const s = sessions.filter((x) => x.dateKey && wk(x.dateKey) === w);
    const a = activities.filter((x) => wk(x.dateKey) === w);
    const f = food.filter((x) => wk(x.dateKey) === w);
    return {
      week: w,
      workouts: s.length,
      minutes: Math.round(s.reduce((t, x) => t + (x.durationSeconds ?? 0), 0) / 60),
      reps: s.reduce((t, x) => t + x.sets.reduce((u, y) => u + (y.reps ?? 0), 0), 0),
      loadVolumeKg: Math.round(s.reduce((t, x) => t + x.sets.reduce((u, y) => u + (y.reps ?? 0) * (y.loadKg ?? 0), 0), 0)),
      sets: s.reduce((t, x) => t + x.sets.length, 0),
      activeMinutes: Math.round(a.reduce((t, x) => t + x.durationMin, 0)),
      kcalBurnedMid: Math.round(a.reduce((t, x) => t + (x.kcalLow + x.kcalHigh) / 2, 0)),
      mobilitySessions: mobility.filter((x) => wk(x.dateKey) === w).length,
      avgKcalEaten: f.length ? Math.round(f.reduce((t, x) => t + (x._sum.kcal ?? 0), 0) / f.length) : null,
      daysLogged: f.length,
    };
  });

  let exerciseSeries: { dateKey: string; best: number; metric: "reps" | "seconds" }[] = [];
  if (exerciseSlug) {
    const ex = await db.exercise.findUnique({ where: { slug: exerciseSlug }, select: { id: true, isTimed: true } });
    if (ex) {
      const sets = await db.setLog.findMany({
        where: { exerciseId: ex.id, skipped: false, session: { userId, status: "completed", dateKey: { gte: firstWeek } } },
        select: { reps: true, seconds: true, session: { select: { dateKey: true } } },
      });
      const byDay = new Map<string, number>();
      for (const s of sets) {
        const v = ex.isTimed ? (s.seconds ?? 0) : (s.reps ?? 0);
        const d = s.session.dateKey!;
        byDay.set(d, Math.max(byDay.get(d) ?? 0, v));
      }
      exerciseSeries = [...byDay.entries()].sort().map(([dateKey, best]) => ({ dateKey, best, metric: ex.isTimed ? "seconds" : "reps" }));
    }
  }

  const trainedExercises = await db.setLog.findMany({
    where: { skipped: false, session: { userId, status: "completed" } },
    distinct: ["exerciseId"],
    select: { exercise: { select: { slug: true, name: true } } },
    take: 100,
  });

  const skills = await db.skillProgress.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });

  return {
    range,
    perWeek,
    totals: {
      workouts: sessions.length,
      minutes: perWeek.reduce((t, w) => t + w.minutes, 0),
      activeMinutes: perWeek.reduce((t, w) => t + w.activeMinutes, 0),
    },
    exerciseSeries,
    trainedExercises: trainedExercises.map((t) => t.exercise),
    measurements,
    skills,
    hasAnyData: sessions.length + activities.length + food.length + measurements.length + mobility.length > 0,
  };
}
