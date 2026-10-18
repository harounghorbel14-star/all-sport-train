import { authedRoute } from "@/lib/server/api";
import { nextRecommendation, respondSchema, respondToRecommendation } from "@/lib/services/recommendation";

export const GET = authedRoute({}, async ({ user }) => ({ recommendation: await nextRecommendation(user.id) }));
export const POST = authedRoute({ body: respondSchema }, async ({ user, body }) => respondToRecommendation(user.id, body));
