import { authedRoute } from "@/lib/server/api";
import { deleteActivity } from "@/lib/services/activity";

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteActivity(user.id, params.id);
  return { ok: true };
});
