import type { z } from "zod";
import { db } from "../server/db";
import { badRequest } from "../server/errors";
import { readinessBand, readinessScore, READINESS_ADVICE } from "../domain/readiness";
import { todayKey, addDays } from "../domain/dates";
import { XP } from "../domain/levels";
import { MOBILITY_BY_SLUG } from "../content/mobility";
import type { checkInSchema } from "../validation";
import { getProfile } from "./profile";
import { awardXp, evaluateAchievements } from "./gamification";

export async function saveCheckIn(userId: string, input: z.infer<typeof checkInSchema>) {
  const readiness = readinessScore(input);
  const data = {
    sleepHours: input.sleepHours ?? null,
    energy: input.energy,
    soreness: input.soreness,
    stress: input.stress ?? null,
    pain: input.pain,
    painNotes: input.painNotes ?? null,
    isRestDay: input.isRestDay,
    readiness,
  };
  const c = await db.checkIn.upsert({
    where: { userId_dateKey: { userId, dateKey: input.dateKey } },
    create: { userId, dateKey: input.dateKey, ...data },
    update: data,
  });
  await awardXp(userId, "checkin", input.dateKey, XP.checkin);
  const band = readinessBand(readiness, input.pain);
  return { checkIn: c, band, advice: READINESS_ADVICE[band] };
}

export async function recoveryOverview(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const from = addDays(today, -13);
  const [checkIns, mobility] = await Promise.all([
    db.checkIn.findMany({ where: { userId, dateKey: { gte: from } }, orderBy: { dateKey: "asc" } }),
    db.mobilitySession.findMany({ where: { userId, dateKey: { gte: from } }, orderBy: { createdAt: "desc" } }),
  ]);
  const todayCheck = checkIns.find((c) => c.dateKey === today) ?? null;
  const band = todayCheck ? readinessBand(todayCheck.readiness, todayCheck.pain) : null;
  return { today, todayCheck, band, advice: band ? READINESS_ADVICE[band] : null, checkIns, mobility };
}

export async function logMobility(userId: string, routineSlug: string, dateKey: string, minutes?: number) {
  const routine = MOBILITY_BY_SLUG.get(routineSlug);
  if (!routine) throw badRequest("Unknown routine");
  const session = await db.mobilitySession.create({ data: { userId, routineSlug, dateKey, minutes: minutes ?? routine.minutes } });
  await awardXp(userId, "mobility", session.id, XP.mobility);
  const achievements = await evaluateAchievements(userId);
  return { session, achievements };
}
