import { authedRoute } from "@/lib/server/api";
import { deleteComment } from "@/lib/services/community";

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteComment(user.id, params.id);
  return { ok: true };
});
