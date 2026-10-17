import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { setChallengeMembership } from "@/lib/services/challenges";

export const POST = authedRoute({ body: z.object({ join: z.boolean() }) }, async ({ user, params, body }) => setChallengeMembership(user.id, params.id, body.join));
