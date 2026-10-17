import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { listConnections, sendFriendRequest } from "@/lib/services/community";

export const GET = authedRoute({}, async ({ user }) => listConnections(user.id));
export const POST = authedRoute({ body: z.object({ handle: z.string().max(30) }) }, async ({ user, body }) => {
  rateLimit(`social:${user.id}`, LIMITS.social.limit, LIMITS.social.windowMs);
  return { request: await sendFriendRequest(user.id, body.handle) };
});
