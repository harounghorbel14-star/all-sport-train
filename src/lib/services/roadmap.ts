import { db } from "../server/db";
import { conflict } from "../server/errors";
import { addDays, todayKey } from "../domain/dates";
import { XP } from "../domain/levels";
import { PHASES, reviewAdjustment, type ReviewDifficulty } from "../engine/roadmap";
import { getProfile } from "./profile";
import { roadmapFor } from "./workouts";
import { awardXp, evaluateAchievements } from "./gamification";

export async function roadmapOverview(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const state = await roadmapFor(p, today);
  const weekEnd = addDays(state.weekStartKey, 6);
  const [sessions, reviews, painDays] = await Promise.all([
    db.workoutSession.count({ where: { userId, status: "completed", dateKey: { gte: state.weekStartKey, lte: weekEnd } } }),
    db.weeklyReview.findMany({ where: { userId }, orderBy: { weekIndex: "desc" }, take: 30 }),
    db.checkIn.count({ where: { userId, pain: true, dateKey: { gte: state.weekStartKey, lte: weekEnd } } }),
  ]);
  const reviewedThisWeek = reviews.some((r) => r.weekStart === state.weekStartKey);
  return {
    state,
    phases: PHASES,
    thisWeek: { sessions, planned: p.daysPerWeek, painDays },
    reviews: reviews.map((r) => ({ ...r, adjustment: JSON.parse(r.adjustment) as { action: string; message: string } })),
    reviewedThisWeek,
    startFromZero: p.startFromZero,
  };
}

export async function submitWeeklyReview(userId: string, input: { feeling: number; difficulty: ReviewDifficulty; notes?: string }) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const state = await roadmapFor(p, today);
  const existing = await db.weeklyReview.findFirst({ where: { userId, weekStart: state.weekStartKey } });
  if (existing) throw conflict("You've already reviewed this week");
  const weekEnd = addDays(state.weekStartKey, 6);
  const [sessions, pain] = await Promise.all([
    db.workoutSession.count({ where: { userId, status: "completed", dateKey: { gte: state.weekStartKey, lte: weekEnd } } }),
    db.checkIn.count({ where: { userId, pain: true, dateKey: { gte: state.weekStartKey, lte: weekEnd } } }),
  ]);
  const adjustment = reviewAdjustment({ feeling: input.feeling, difficulty: input.difficulty, sessionsDone: sessions, sessionsPlanned: p.daysPerWeek, painReported: pain > 0 });
  const maxIdx = await db.weeklyReview.aggregate({ where: { userId }, _max: { weekIndex: true } });
  const review = await db.weeklyReview.create({
    data: {
      userId,
      weekIndex: Math.max(state.week, (maxIdx._max.weekIndex ?? 0) + 1),
      weekStart: state.weekStartKey,
      feeling: input.feeling,
      difficulty: input.difficulty,
      notes: input.notes ?? null,
      adjustment: JSON.stringify(adjustment),
    },
  });
  await awardXp(userId, "review", review.id, XP.weeklyReview);
  const achievements = await evaluateAchievements(userId);
  return { review, adjustment, achievements };
}
