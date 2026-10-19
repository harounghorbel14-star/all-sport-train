import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { addDays, todayKey, weekStart } from "../domain/dates";
import { cyclingMetFromSpeed, exerciseKcal, estimateTdee, runningMetFromPace, walkingMetFromSpeed } from "../domain/energy";
import { XP } from "../domain/levels";
import { sportBySlug } from "./sports";
import type { activitySchema } from "../validation";
import { getProfile } from "./profile";
import { awardXp, evaluateAchievements, revokeXp } from "./gamification";

type ActivityInput = z.infer<typeof activitySchema>;

/** MET for a sport session, refined by pace when distance is known. */
export async function activityMet(sport: string, intensity: "light" | "moderate" | "vigorous", distanceKm?: number, durationMin?: number) {
  const def = await sportBySlug(sport);
  if (!def) throw badRequest("Unknown sport");
  if (distanceKm && durationMin) {
    const byPace =
      sport === "running" ? runningMetFromPace(distanceKm, durationMin) : sport === "cycling" ? cyclingMetFromSpeed(distanceKm, durationMin) : sport === "walking" ? walkingMetFromSpeed(distanceKm, durationMin) : null;
    if (byPace) return { met: byPace, basis: "pace" as const };
  }
  const met = intensity === "light" ? def.met[0] : intensity === "vigorous" ? def.met[2] : def.met[1];
  return { met, basis: "intensity" as const };
}

const ACTIVITY_XP_PER_DAY = 5;

export async function logActivity(userId: string, input: ActivityInput) {
  const def = await sportBySlug(input.sport);
  if (!def) throw badRequest("Unknown sport");
  // Validate sport-specific session fields against the sport's metric definitions.
  const fields = def.metrics.filter((m) => m.scope === "session");
  const metrics: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(input.metrics ?? {})) {
    const field = fields.find((f) => f.key === k);
    if (!field) continue;
    if (field.kind === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || (field.min != null && n < field.min) || (field.max != null && n > field.max)) throw badRequest(`Invalid value for ${field.label}`);
      metrics[k] = n;
    } else if (field.kind === "select") {
      if (!field.options?.includes(String(v))) throw badRequest(`Invalid option for ${field.label}`);
      metrics[k] = String(v);
    } else metrics[k] = String(v).slice(0, 80);
  }
  const p = await getProfile(userId);
  const { met, basis } = await activityMet(input.sport, input.intensity, input.distanceKm, input.durationMin);
  const kcal = exerciseKcal(met, input.durationMin, p.weightKg);
  try {
    const entry = await db.activityEntry.create({
      data: {
        userId,
        sport: input.sport,
        title: input.title ?? def.name,
        dateKey: input.dateKey,
        durationMin: input.durationMin,
        intensity: input.intensity,
        rpe: input.rpe ?? null,
        distanceKm: input.distanceKm ?? null,
        elevationM: input.elevationM ?? (typeof metrics.elevationM === "number" ? metrics.elevationM : null),
        metrics: JSON.stringify(metrics),
        kcalLow: kcal.low,
        kcalHigh: kcal.high,
        source: input.externalId ? "import" : "manual",
        externalId: input.externalId ?? null,
        notes: input.notes ?? null,
      },
    });
    // Activities still count toward stats, but only the first few each day earn XP.
    const earnedToday = await db.xpEvent.count({ where: { userId, source: "activity", createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (earnedToday < ACTIVITY_XP_PER_DAY) await awardXp(userId, "activity", entry.id, XP.activity);
    const achievements = await evaluateAchievements(userId);
    return { entry, estimate: { ...kcal, basis, met }, achievements };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("This activity was already imported");
    throw e;
  }
}

/**
 * Corrects a logged activity (duration, intensity, distance, date, effort, notes). Energy is re-estimated
 * from the corrected values; the previous values are kept in the correction log. Workout entries are
 * corrected from the workout itself, not here.
 */
export async function correctActivity(
  userId: string,
  id: string,
  input: { dateKey?: string; durationMin?: number; intensity?: "light" | "moderate" | "vigorous"; distanceKm?: number | null; rpe?: number | null; notes?: string | null; reason?: string },
) {
  const entry = await db.activityEntry.findFirst({ where: { id, userId } });
  if (!entry) throw notFound("Activity not found");
  if (entry.source === "workout") throw conflict("Workout activities are managed from the workout history");
  const p = await getProfile(userId);
  const next = {
    dateKey: input.dateKey ?? entry.dateKey,
    durationMin: input.durationMin ?? entry.durationMin,
    intensity: (input.intensity ?? entry.intensity) as "light" | "moderate" | "vigorous",
    distanceKm: input.distanceKm === undefined ? entry.distanceKm : input.distanceKm,
    rpe: input.rpe === undefined ? entry.rpe : input.rpe,
    notes: input.notes === undefined ? entry.notes : input.notes,
  };
  const { met } = await activityMet(entry.sport, next.intensity, next.distanceKm ?? undefined, next.durationMin);
  const kcal = exerciseKcal(met, next.durationMin, p.weightKg);
  const before = { dateKey: entry.dateKey, durationMin: entry.durationMin, intensity: entry.intensity, distanceKm: entry.distanceKm, rpe: entry.rpe, notes: entry.notes, kcalLow: entry.kcalLow, kcalHigh: entry.kcalHigh };
  const after = { ...next, kcalLow: kcal.low, kcalHigh: kcal.high };
  return db.$transaction(async (tx) => {
    const u = await tx.activityEntry.update({ where: { id: entry.id }, data: after });
    await tx.recordCorrection.create({ data: { userId, recordType: "activity", recordId: entry.id, before: JSON.stringify(before), after: JSON.stringify(after), reason: input.reason ?? null } });
    return u;
  });
}

export async function deleteActivity(userId: string, id: string) {
  const entry = await db.activityEntry.findFirst({ where: { id, userId } });
  if (!entry) throw notFound("Activity not found");
  if (entry.source === "workout") throw conflict("Workout activities are managed from the workout history");
  await db.activityEntry.delete({ where: { id: entry.id } });
  await revokeXp(userId, "activity", entry.id);
}

export async function listActivities(userId: string, from: string, to: string) {
  return db.activityEntry.findMany({ where: { userId, dateKey: { gte: from, lte: to } }, orderBy: [{ dateKey: "desc" }, { startedAt: "desc" }], take: 200 });
}

export async function activityOverview(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const start = weekStart(today);
  const from = addDays(today, -27);
  const entries = await listActivities(userId, from, today);
  const days = Array.from({ length: 28 }, (_, i) => addDays(from, i)).map((d) => {
    const list = entries.filter((e) => e.dateKey === d);
    return {
      dateKey: d,
      minutes: Math.round(list.reduce((s, e) => s + e.durationMin, 0)),
      kcalLow: list.reduce((s, e) => s + e.kcalLow, 0),
      kcalHigh: list.reduce((s, e) => s + e.kcalHigh, 0),
    };
  });
  const week = entries.filter((e) => e.dateKey >= start);
  const bySport = new Map<string, { minutes: number; sessions: number; distanceKm: number }>();
  for (const e of week) {
    const cur = bySport.get(e.sport) ?? { minutes: 0, sessions: 0, distanceKm: 0 };
    cur.minutes += e.durationMin;
    cur.sessions += 1;
    cur.distanceKm += e.distanceKm ?? 0;
    bySport.set(e.sport, cur);
  }
  return {
    today,
    days,
    week: {
      minutes: Math.round(week.reduce((s, e) => s + e.durationMin, 0)),
      sessions: week.length,
      kcalLow: week.reduce((s, e) => s + e.kcalLow, 0),
      kcalHigh: week.reduce((s, e) => s + e.kcalHigh, 0),
      distanceKm: Math.round(week.reduce((s, e) => s + (e.distanceKm ?? 0), 0) * 10) / 10,
      bySport: [...bySport.entries()].map(([sport, v]) => ({ sport, ...v, minutes: Math.round(v.minutes) })),
    },
    recent: entries.slice(0, 20),
    tdee: estimateTdee(p),
    bodyMassKnown: !!p.weightKg,
  };
}
