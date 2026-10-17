import { authedRoute } from "@/lib/server/api";
import { deletePost } from "@/lib/services/community";

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deletePost(user.id, params.id);
  return { ok: true };
});
