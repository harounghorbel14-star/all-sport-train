import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { addDays, todayKey, weekStart } from "../domain/dates";
import { cyclingMetFromSpeed, exerciseKcal, estimateTdee, runningMetFromPace, walkingMetFromSpeed } from "../domain/energy";
import { XP } from "../domain/levels";
import { SPORT_BY_SLUG } from "../content/sports";
import type { activitySchema } from "../validation";
import { getProfile } from "./profile";
import { awardXp, evaluateAchievements } from "./gamification";

type ActivityInput = z.infer<typeof activitySchema>;

/** MET for a sport session, refined by pace when distance is known. */
export function activityMet(sport: string, intensity: "light" | "moderate" | "vigorous", distanceKm?: number, durationMin?: number) {
  const def = SPORT_BY_SLUG.get(sport);
  if (!def) throw badRequest("Unknown sport");
  if (distanceKm && durationMin) {
    const byPace =
      sport === "running" ? runningMetFromPace(distanceKm, durationMin) : sport === "cycling" ? cyclingMetFromSpeed(distanceKm, durationMin) : sport === "walking" ? walkingMetFromSpeed(distanceKm, durationMin) : null;
    if (byPace) return { met: byPace, basis: "pace" as const };
  }
  return { met: def.met[intensity], basis: "intensity" as const };
}

export async function logActivity(userId: string, input: ActivityInput) {
  const def = SPORT_BY_SLUG.get(input.sport);
  if (!def) throw badRequest("Unknown sport");
  // Validate sport-specific fields against the sport definition.
  const metrics: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(input.metrics ?? {})) {
    const field = def.fields.find((f) => f.key === k);
    if (!field) continue;
    if (field.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || (field.min != null && n < field.min) || (field.max != null && n > field.max)) throw badRequest(`Invalid value for ${field.label}`);
      metrics[k] = n;
    } else if (field.type === "select") {
      if (!field.options?.includes(String(v))) throw badRequest(`Invalid option for ${field.label}`);
      metrics[k] = String(v);
    } else metrics[k] = String(v).slice(0, 80);
  }
  const p = await getProfile(userId);
  const { met, basis } = activityMet(input.sport, input.intensity, input.distanceKm, input.durationMin);
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
    await awardXp(userId, "activity", entry.id, XP.activity);
    const achievements = await evaluateAchievements(userId);
    return { entry, estimate: { ...kcal, basis, met }, achievements };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("This activity was already imported");
    throw e;
  }
}

export async function deleteActivity(userId: string, id: string) {
  const entry = await db.activityEntry.findFirst({ where: { id, userId } });
  if (!entry) throw notFound("Activity not found");
  if (entry.source === "workout") throw conflict("Workout activities are managed from the workout history");
  await db.activityEntry.delete({ where: { id: entry.id } });
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
