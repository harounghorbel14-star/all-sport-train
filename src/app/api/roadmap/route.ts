import { authedRoute } from "@/lib/server/api";
import { roadmapOverview } from "@/lib/services/roadmap";

export const GET = authedRoute({}, async ({ user }) => roadmapOverview(user.id));
