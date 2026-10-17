import { authedRoute } from "@/lib/server/api";
import { completePractice, completePracticeSchema } from "@/lib/services/sports";

export const POST = authedRoute({ body: completePracticeSchema }, async ({ user, params, body }) => completePractice(user.id, params.id, body));
