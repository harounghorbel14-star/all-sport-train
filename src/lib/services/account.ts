import { db } from "../server/db";
import { deleteAllUploads } from "./media";

/** Full export of the user's own data (JSON). Media files are listed by metadata; download them individually. */
export async function exportAccount(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      plans: true,
      workoutSessions: { include: { sets: true } },
      personalRecords: true,
      favorites: true,
      skillProgress: true,
      foodEntries: true,
      customFoods: true,
      savedMeals: true,
      waterLogs: true,
      activities: true,
      checkIns: true,
      mobilityLogs: true,
      measurements: true,
      media: true,
      formChecks: true,
      achievements: true,
      xpEvents: true,
      weeklyReviews: true,
      coachMessages: true,
      recommendationFeedback: true,
      corrections: true,
      notifications: true,
      challengeEntries: true,
      posts: { include: { comments: true } },
      comments: true,
      reactions: true,
      userSports: { include: { sport: { select: { slug: true, name: true } } } },
      lessonProgress: true,
      practicePlans: true,
      sportMetrics: true,
    },
  });
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  const safe = { ...rest, hasPassword: Boolean(passwordHash) };
  return { exportedAt: new Date().toISOString(), format: "apex-fit-export-v1", data: safe };
}

/** Permanently deletes the account, all database rows (cascade) and stored media. */
export async function deleteAccount(userId: string) {
  await deleteAllUploads(userId);
  await db.user.delete({ where: { id: userId } });
}
