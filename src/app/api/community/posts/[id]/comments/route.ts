import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { addComment } from "@/lib/services/community";

export const POST = authedRoute({ body: z.object({ body: z.string().max(500) }) }, async ({ user, params, body }) => {
  rateLimit(`social:${user.id}`, LIMITS.social.limit, LIMITS.social.windowMs);
  return { comment: await addComment(user.id, params.id, body.body) };
});
