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
      goalItems: true,
      quizAttempts: true,
      workoutTemplates: true,
      travelPeriods: true,
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

/** What the app stores about the user, by category (counts only), plus the sharing settings that apply. */
export async function privacySummary(userId: string) {
  const [workouts, activities, foods, water, measurements, photos, formChecks, coachMessages, posts, goals, quizAttempts, templates, trips, corrections, google] = await Promise.all([
    db.workoutSession.count({ where: { userId } }),
    db.activityEntry.count({ where: { userId } }),
    db.foodEntry.count({ where: { userId } }),
    db.waterLog.count({ where: { userId } }),
    db.bodyMeasurement.count({ where: { userId } }),
    db.mediaUpload.count({ where: { userId, kind: "progress_photo" } }),
    db.formCheck.count({ where: { userId } }),
    db.coachMessage.count({ where: { userId } }),
    db.post.count({ where: { authorId: userId } }),
    db.goal.count({ where: { userId } }),
    db.quizAttempt.count({ where: { userId } }),
    db.workoutTemplate.count({ where: { userId } }),
    db.travelPeriod.count({ where: { userId } }),
    db.recordCorrection.count({ where: { userId } }),
    db.authAccount.findFirst({ where: { userId, provider: "google" }, select: { id: true } }),
  ]);
  const p = await db.profile.findUniqueOrThrow({ where: { userId }, select: { visibility: true, shareWorkouts: true, nutritionInCoach: true } });
  return {
    counts: { workouts, activities, foods, water, measurements, photos, formChecks, coachMessages, posts, goals, quizAttempts, templates, trips, corrections },
    sharing: { visibility: p.visibility, shareWorkouts: p.shareWorkouts, nutritionInCoach: p.nutritionInCoach },
    connected: { google: !!google, healthServices: [] as string[] },
  };
}
