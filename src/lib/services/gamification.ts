import { Prisma } from "@prisma/client";
import { db } from "../server/db";
import { addDays, todayKey, weekStart } from "../domain/dates";
import { computeStreak, weeklyConsistency, weeklyStreak } from "../domain/streaks";
import { ACHIEVEMENTS, newlyUnlocked, type AchievementStats } from "../domain/achievements";
import { levelFromXp, levelTitle } from "../domain/levels";
import { SKILLS } from "../content/skills";
import { getProfile } from "./profile";
import { notify } from "./notifications";

const HISTORY_DAYS = 400;

export async function activityDays(userId: string, today: string) {
  const since = addDays(today, -HISTORY_DAYS);
  const [sessions, activities, mobility, rest] = await Promise.all([
    db.workoutSession.findMany({ where: { userId, status: "completed", dateKey: { gte: since } }, select: { dateKey: true } }),
    db.activityEntry.findMany({ where: { userId, dateKey: { gte: since } }, select: { dateKey: true } }),
    db.mobilitySession.findMany({ where: { userId, dateKey: { gte: since } }, select: { dateKey: true } }),
    db.checkIn.findMany({ where: { userId, isRestDay: true, dateKey: { gte: since } }, select: { dateKey: true } }),
  ]);
  const active = new Set<string>();
  sessions.forEach((s) => s.dateKey && active.add(s.dateKey));
  activities.forEach((a) => active.add(a.dateKey));
  mobility.forEach((m) => active.add(m.dateKey));
  const trainingDays = new Set(sessions.map((s) => s.dateKey!).filter(Boolean));
  activities.forEach((a) => trainingDays.add(a.dateKey));
  return { active, rest: new Set(rest.map((r) => r.dateKey)), training: trainingDays };
}

export async function streakSummary(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const days = await activityDays(userId, today);
  const streak = computeStreak({ activeDays: days.active, restDays: days.rest, trainingDays: p.trainingDays, today });
  const weekly = weeklyConsistency(days.training, today, p.daysPerWeek);
  const wStreak = weeklyStreak(days.training, today, p.daysPerWeek);
  const level = levelFromXp(p.xp);
  return { ...streak, weekly, weeklyStreak: wStreak, level: { ...level, title: levelTitle(level.level) }, today, activeDays: [...days.active] };
}

/** Idempotent XP award: the same (source, refId) is only counted once. */
export async function awardXp(userId: string, source: string, refId: string, amount: number) {
  if (amount <= 0) return false;
  try {
    await db.$transaction([
      db.xpEvent.create({ data: { userId, source, refId, amount } }),
      db.profile.update({ where: { userId }, data: { xp: { increment: amount } } }),
    ]);
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

const PUSHUP_SLUGS = ["wall-push-up", "incline-push-up", "knee-push-up", "push-up-negative", "push-up", "decline-push-up", "diamond-push-up", "archer-push-up", "pseudo-planche-push-up"];
const PULLUP_SLUGS = ["pull-up", "chin-up", "archer-pull-up", "high-pull-up"];

export async function collectStats(userId: string): Promise<AchievementStats> {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const [workouts, pushups, pullups, plank, skillsDone, reviews, mobility, prs, activities, sports] = await Promise.all([
    db.workoutSession.count({ where: { userId, status: "completed" } }),
    db.setLog.aggregate({ where: { skipped: false, session: { userId }, exercise: { slug: { in: PUSHUP_SLUGS } } }, _sum: { reps: true } }),
    db.setLog.aggregate({ where: { skipped: false, session: { userId }, exercise: { slug: { in: PULLUP_SLUGS } } }, _max: { reps: true } }),
    db.setLog.aggregate({ where: { skipped: false, session: { userId }, exercise: { slug: "front-plank" } }, _max: { seconds: true } }),
    db.skillProgress.count({ where: { userId, unlockedAt: { not: null }, skillSlug: { in: SKILLS.map((s) => s.slug) } } }),
    db.weeklyReview.count({ where: { userId } }),
    db.mobilitySession.count({ where: { userId } }),
    db.personalRecord.count({ where: { userId } }),
    db.activityEntry.count({ where: { userId } }),
    db.activityEntry.findMany({ where: { userId }, distinct: ["sport"], select: { sport: true }, take: 50 }),
  ]);
  // Assessment PRs (logged tests) count toward pull-up / plank milestones too.
  const [pullPr, plankPr] = await Promise.all([
    db.personalRecord.aggregate({ where: { userId, metric: "reps", exercise: { slug: { in: PULLUP_SLUGS } } }, _max: { value: true } }),
    db.personalRecord.aggregate({ where: { userId, metric: "seconds", exercise: { slug: "front-plank" } }, _max: { value: true } }),
  ]);
  const days = await activityDays(userId, today);
  const streak = computeStreak({ activeDays: days.active, restDays: days.rest, trainingDays: p.trainingDays, today });
  // Best weekly streak across history
  let best = 0;
  let run = 0;
  const target = p.daysPerWeek;
  const byWeek = new Map<string, number>();
  days.training.forEach((d) => byWeek.set(weekStart(d), (byWeek.get(weekStart(d)) ?? 0) + 1));
  const weeks = [...byWeek.keys()].sort();
  if (weeks.length) {
    for (let w = weeks[0]; w <= weekStart(today); w = addDays(w, 7)) {
      run = (byWeek.get(w) ?? 0) >= target ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return {
    workoutsCompleted: workouts,
    pushupRepsTotal: pushups._sum.reps ?? 0,
    maxPullupReps: Math.max(pullups._max.reps ?? 0, pullPr._max.value ?? 0),
    maxPlankSeconds: Math.max(plank._max.seconds ?? 0, plankPr._max.value ?? 0),
    longestStreak: streak.longest,
    bestWeeklyStreak: Math.max(best, weeklyStreak(days.training, today, target)),
    skillsUnlocked: skillsDone,
    weeklyReviews: reviews,
    mobilitySessions: mobility,
    personalRecords: prs,
    activitiesLogged: activities,
    sportsTried: new Set([...sports.map((s) => s.sport), ...(workouts ? ["calisthenics"] : [])]).size,
  };
}

/** Evaluate and persist newly unlocked achievements. */
export async function evaluateAchievements(userId: string) {
  const [stats, unlocked] = await Promise.all([
    collectStats(userId),
    db.userAchievement.findMany({ where: { userId }, select: { key: true } }),
  ]);
  const fresh = newlyUnlocked(stats, new Set(unlocked.map((u) => u.key)));
  const created = [];
  for (const a of fresh) {
    try {
      await db.userAchievement.create({ data: { userId, key: a.key } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
    await awardXp(userId, "achievement", a.key, a.xp);
    await notify(userId, { type: "milestones", title: `Achievement unlocked: ${a.title}`, body: a.description, href: "/challenges", dedupeKey: `ach-${a.key}` });
    created.push({ key: a.key, title: a.title, description: a.description, icon: a.icon, xp: a.xp });
  }
  return created;
}

export async function achievementsOverview(userId: string) {
  const [stats, unlocked] = await Promise.all([collectStats(userId), db.userAchievement.findMany({ where: { userId } })]);
  const at = new Map(unlocked.map((u) => [u.key, u.unlockedAt]));
  return ACHIEVEMENTS.map((a) => ({
    key: a.key,
    title: a.title,
    description: a.description,
    icon: a.icon,
    xp: a.xp,
    unlockedAt: at.get(a.key) ?? null,
    progress: a.progress(stats),
  }));
}

/** Weekly missions derived from real logged data (no stored state needed). */
export async function weeklyMissions(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const start = weekStart(today);
  const end = addDays(start, 6);
  const range = { gte: start, lte: end };
  const [workouts, mobility, checkins, waterDays, review] = await Promise.all([
    db.workoutSession.count({ where: { userId, status: "completed", dateKey: range } }),
    db.mobilitySession.count({ where: { userId, dateKey: range } }),
    db.checkIn.count({ where: { userId, dateKey: range } }),
    db.waterLog.groupBy({ by: ["dateKey"], where: { userId, dateKey: range }, _sum: { ml: true } }),
    db.weeklyReview.count({ where: { userId, weekStart: start } }),
  ]);
  const hydrated = waterDays.filter((d) => (d._sum.ml ?? 0) >= p.waterGoalMl).length;
  const missions = [
    { key: "workouts", title: `Complete ${p.daysPerWeek} workouts`, progress: workouts, target: p.daysPerWeek, xp: 60 },
    { key: "mobility", title: "Two mobility sessions", progress: mobility, target: 2, xp: 30 },
    { key: "checkins", title: "Check in on four days", progress: checkins, target: 4, xp: 20 },
    { key: "water", title: "Hit your water goal three days", progress: hydrated, target: 3, xp: 20 },
    { key: "review", title: "Complete your weekly review", progress: review, target: 1, xp: 25 },
  ];
  for (const m of missions) {
    if (m.progress >= m.target) await awardXp(userId, "mission", `${start}:${m.key}`, m.xp);
  }
  return { weekStart: start, missions: missions.map((m) => ({ ...m, done: m.progress >= m.target })) };
}
