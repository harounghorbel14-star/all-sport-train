import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { blockUser, unblockUser } from "@/lib/services/community";

const body = z.object({ handle: z.string().max(30) });
export const POST = authedRoute({ body }, async ({ user, body }) => {
  await blockUser(user.id, body.handle);
  return { ok: true };
});
export const DELETE = authedRoute({ body }, async ({ user, body }) => {
  await unblockUser(user.id, body.handle);
  return { ok: true };
});
