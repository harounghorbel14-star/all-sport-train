import { authedRoute } from "@/lib/server/api";
import { getGoal, goalPatchSchema, updateGoal } from "@/lib/services/goals";

export const GET = authedRoute({}, async ({ user, params }) => ({ goal: await getGoal(user.id, params.id) }));

/** Edit, abandon or restore a goal. Nothing is deleted; previous values are kept in the correction log. */
export const PATCH = authedRoute({ body: goalPatchSchema }, async ({ user, params, body }) => ({ goal: await updateGoal(user.id, params.id, body) }));
