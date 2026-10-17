import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { removeFriend, respondFriendRequest } from "@/lib/services/community";

export const PATCH = authedRoute({ body: z.object({ accept: z.boolean() }) }, async ({ user, params, body }) => ({ friendship: await respondFriendRequest(user.id, params.id, body.accept) }));
export const DELETE = authedRoute({}, async ({ user, params }) => {
  await removeFriend(user.id, params.id);
  return { ok: true };
});
