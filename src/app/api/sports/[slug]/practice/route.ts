import { authedRoute } from "@/lib/server/api";
import { createPractice, practiceRequestSchema } from "@/lib/services/sports";

export const POST = authedRoute({ body: practiceRequestSchema }, async ({ user, params, body }) => ({ plan: await createPractice(user.id, params.slug, body) }));
