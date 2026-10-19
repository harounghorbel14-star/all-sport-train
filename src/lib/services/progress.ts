import type { z } from "zod";
import { db } from "../server/db";
import { badRequest, notFound } from "../server/errors";
import { addDays, dateKey, todayKey, weekStart } from "../domain/dates";
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

/** Corrects a measurement; previous values are kept in the correction log, and profile weight/height follow the latest entry. */
export async function correctMeasurement(userId: string, id: string, input: Partial<z.infer<typeof measurementSchema>> & { reason?: string }) {
  const m = await db.bodyMeasurement.findFirst({ where: { id, userId } });
  if (!m) throw notFound("Measurement not found");
  const { reason, ...changes } = input;
  const keys = Object.keys(changes) as (keyof typeof changes)[];
  if (!keys.length) throw badRequest("Nothing to correct");
  const before = Object.fromEntries(keys.map((k) => [k, m[k as keyof typeof m] ?? null]));
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.bodyMeasurement.update({ where: { id: m.id }, data: changes });
    await tx.recordCorrection.create({ data: { userId, recordType: "measurement", recordId: m.id, before: JSON.stringify(before), after: JSON.stringify(changes), reason: reason ?? null } });
    return u;
  });
  const latest = await db.bodyMeasurement.findFirst({ where: { userId }, orderBy: [{ dateKey: "desc" }, { createdAt: "desc" }] });
  if (latest?.id === m.id && (changes.weightKg !== undefined || changes.heightCm !== undefined)) {
    await db.profile.update({ where: { userId }, data: { ...(changes.weightKg !== undefined ? { weightKg: changes.weightKg } : {}), ...(changes.heightCm !== undefined ? { heightCm: changes.heightCm } : {}) } });
  }
  return updated;
}

/** The correction history of one of the user's records (original values first). */
export async function correctionHistory(userId: string, recordType: string, recordId: string) {
  return db.recordCorrection.findMany({ where: { userId, recordType, recordId }, orderBy: { createdAt: "asc" } });
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

// ── Monthly report ───────────────────────────────────────────────────────
const monthOf = (key: string) => key.slice(0, 7);
const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};

/**
 * This month vs the previous one, from logged data only, in the user's time zone. Each sport is
 * compared only with itself (minutes and sessions), never through a combined "fitness score".
 * Missing data is reported as missing, not as zero improvement or decline.
 */
export async function monthlyReport(userId: string, month?: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const m = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : monthOf(today);
  const prev = prevMonth(m);
  const from = `${prev}-01`;
  const to = `${m}-31`;
  // Timestamped rows are fetched with a day of margin, then assigned to months in the user's time zone.
  const [sessions, activities, prs, lessons, results] = await Promise.all([
    db.workoutSession.findMany({ where: { userId, status: "completed", dateKey: { gte: from, lte: to } }, select: { dateKey: true, durationSeconds: true } }),
    db.activityEntry.findMany({ where: { userId, dateKey: { gte: from, lte: to } }, select: { dateKey: true, sport: true, durationMin: true, source: true } }),
    db.personalRecord.findMany({ where: { userId, achievedAt: { gte: new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000), lte: new Date(Date.parse(`${to}T23:59:59Z`) + 86_400_000) } }, include: { exercise: { select: { name: true } } } }),
    db.lessonProgress.findMany({ where: { userId, status: "completed", completedAt: { gte: new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000) } }, include: { lesson: { select: { title: true, sport: { select: { name: true } } } } } }),
    db.sportMetricEntry.findMany({ where: { userId, dateKey: { gte: from, lte: to } }, select: { dateKey: true } }),
  ]);
  const summarise = (mk: string) => {
    const inMonth = (k: string | null) => !!k && monthOf(k) === mk;
    const w = sessions.filter((s) => inMonth(s.dateKey));
    const acts = activities.filter((a) => inMonth(a.dateKey) && a.source !== "workout");
    const bySport = new Map<string, { sessions: number; minutes: number }>();
    for (const a of acts) {
      const cur = bySport.get(a.sport) ?? { sessions: 0, minutes: 0 };
      bySport.set(a.sport, { sessions: cur.sessions + 1, minutes: cur.minutes + Math.round(a.durationMin) });
    }
    const activeDays = new Set([...w.map((s) => s.dateKey!), ...acts.map((a) => a.dateKey)]);
    return {
      month: mk,
      workouts: w.length,
      workoutMinutes: Math.round(w.reduce((t, s) => t + (s.durationSeconds ?? 0), 0) / 60),
      activeDays: activeDays.size,
      sports: [...bySport.entries()].map(([sport, v]) => ({ sport, ...v })).sort((a, b) => b.minutes - a.minutes),
      personalRecords: prs.filter((r) => inMonth(dateKey(r.achievedAt, p.timezone))).map((r) => ({ exercise: r.exercise.name, metric: r.metric, value: r.value })),
      lessonsCompleted: lessons.filter((l) => l.completedAt && inMonth(dateKey(l.completedAt, p.timezone))).map((l) => ({ title: l.lesson.title, sport: l.lesson.sport.name })),
      sportResultsLogged: results.filter((r) => inMonth(r.dateKey)).length,
    };
  };
  const current = summarise(m);
  const previous = summarise(prev);
  const partial = m === monthOf(today);
  return {
    current,
    previous,
    partial,
    notes: [
      ...(partial ? [`${m} isn't over yet — comparisons are with a full previous month.`] : []),
      ...(previous.workouts + previous.sports.length === 0 ? ["Nothing was logged the month before, so there's no comparison yet."] : []),
    ],
  };
}
