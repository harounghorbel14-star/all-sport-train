import { db } from "../server/db";
import { notFound } from "../server/errors";
import { addDays, todayKey } from "../domain/dates";
import { getProfile } from "./profile";

const PUSHUP_SLUGS = ["wall-push-up", "incline-push-up", "knee-push-up", "push-up-negative", "push-up", "decline-push-up", "diamond-push-up", "archer-push-up", "pseudo-planche-push-up"];

/** Make sure this month's community challenges exist (idempotent). */
export async function ensureMonthlyChallenges(today: string) {
  const monthStart = today.slice(0, 8) + "01";
  const exists = await db.challenge.count({ where: { startsOn: monthStart } });
  if (exists) return;
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const monthEnd = addDays(nextMonth, -1);
  const label = new Date(monthStart + "T00:00:00Z").toLocaleString("en", { month: "long", timeZone: "UTC" });
  const defs = [
    { slug: `pushups-${monthStart}`, title: `${label} 1,000 Push-Ups`, description: "Accumulate 1,000 push-up reps (any variation) across the month.", metric: "pushup_reps", target: 1000 },
    { slug: `workouts-${monthStart}`, title: `${label} 12 Sessions`, description: "Complete 12 workouts this month. Rest days are part of the plan.", metric: "workouts", target: 12 },
    { slug: `mobility-${monthStart}`, title: `${label} Mobility Habit`, description: "Complete 10 mobility sessions this month.", metric: "mobility_sessions", target: 10 },
    { slug: `active-${monthStart}`, title: `${label} 600 Active Minutes`, description: "Log 600 minutes of any activity.", metric: "active_minutes", target: 600 },
  ];
  for (const d of defs) {
    await db.challenge.upsert({ where: { slug: d.slug }, create: { ...d, startsOn: monthStart, endsOn: monthEnd }, update: {} });
  }
}

async function progressFor(userId: string, c: { metric: string; startsOn: string; endsOn: string }) {
  const range = { gte: c.startsOn, lte: c.endsOn };
  switch (c.metric) {
    case "pushup_reps": {
      const r = await db.setLog.aggregate({ where: { skipped: false, exercise: { slug: { in: PUSHUP_SLUGS } }, session: { userId, status: "completed", dateKey: range } }, _sum: { reps: true } });
      return r._sum.reps ?? 0;
    }
    case "workouts":
      return db.workoutSession.count({ where: { userId, status: "completed", dateKey: range } });
    case "mobility_sessions":
      return db.mobilitySession.count({ where: { userId, dateKey: range } });
    case "active_minutes": {
      const r = await db.activityEntry.aggregate({ where: { userId, dateKey: range }, _sum: { durationMin: true } });
      return Math.round(r._sum.durationMin ?? 0);
    }
    default:
      return 0;
  }
}

export async function listChallenges(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  await ensureMonthlyChallenges(today);
  const challenges = await db.challenge.findMany({
    where: { endsOn: { gte: addDays(today, -31) } },
    orderBy: { startsOn: "desc" },
    include: { participants: { where: { userId } }, _count: { select: { participants: true } } },
    take: 12,
  });
  return Promise.all(
    challenges.map(async (c) => {
      const joined = c.participants.length > 0;
      const progress = joined ? await progressFor(userId, c) : 0;
      if (joined && progress >= c.target && !c.participants[0].completedAt) {
        await db.challengeParticipant.update({ where: { userId_challengeId: { userId, challengeId: c.id } }, data: { completedAt: new Date() } });
      }
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        metric: c.metric,
        target: c.target,
        startsOn: c.startsOn,
        endsOn: c.endsOn,
        active: c.startsOn <= today && c.endsOn >= today,
        daysLeft: Math.max(0, Math.round((Date.parse(c.endsOn) - Date.parse(today)) / 86_400_000)),
        participants: c._count.participants,
        joined,
        progress,
      };
    }),
  );
}

export async function setChallengeMembership(userId: string, challengeId: string, join: boolean) {
  const c = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!c) throw notFound("Challenge not found");
  if (join) await db.challengeParticipant.upsert({ where: { userId_challengeId: { userId, challengeId } }, create: { userId, challengeId }, update: {} });
  else await db.challengeParticipant.deleteMany({ where: { userId, challengeId } });
  return { joined: join };
}
