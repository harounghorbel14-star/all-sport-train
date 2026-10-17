import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { createGroup, listGroups } from "@/lib/services/community";

export const GET = authedRoute({}, async ({ user }) => ({ groups: await listGroups(user.id) }));
export const POST = authedRoute({ body: z.object({ name: z.string().max(60), description: z.string().max(300), sport: z.string().max(30).optional() }) }, async ({ user, body }) => {
  rateLimit(`social:${user.id}`, LIMITS.social.limit, LIMITS.social.windowMs);
  return { group: await createGroup(user.id, body) };
});
