import { authedRoute } from "@/lib/server/api";
import { deleteFormCheck } from "@/lib/services/formcheck";

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteFormCheck(user.id, params.id);
  return { ok: true };
});
