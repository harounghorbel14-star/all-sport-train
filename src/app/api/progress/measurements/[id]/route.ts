import { authedRoute } from "@/lib/server/api";
import { deleteMeasurement } from "@/lib/services/progress";

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteMeasurement(user.id, params.id);
  return { ok: true };
});
