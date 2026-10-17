import { authedRoute } from "@/lib/server/api";
import { listChallenges } from "@/lib/services/challenges";

export const GET = authedRoute({}, async ({ user }) => ({ challenges: await listChallenges(user.id) }));
