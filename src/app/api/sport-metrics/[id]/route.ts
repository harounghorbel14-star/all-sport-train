import { authedRoute } from "@/lib/server/api";
import { deleteMetricEntry } from "@/lib/services/sports";

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteMetricEntry(user.id, params.id);
  return { ok: true };
});
