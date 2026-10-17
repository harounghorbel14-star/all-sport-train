import { authedRoute } from "@/lib/server/api";
import { activitySchema } from "@/lib/validation";
import { activityOverview, logActivity } from "@/lib/services/activity";

export const GET = authedRoute({}, async ({ user }) => activityOverview(user.id));
export const POST = authedRoute({ body: activitySchema }, async ({ user, body }) => logActivity(user.id, body));
