import { authedRoute } from "@/lib/server/api";
import { achievementsOverview, streakSummary, weeklyMissions } from "@/lib/services/gamification";

export const GET = authedRoute({}, async ({ user }) => {
  const [streak, achievements, missions] = await Promise.all([streakSummary(user.id), achievementsOverview(user.id), weeklyMissions(user.id)]);
  return { streak, achievements, missions };
});
