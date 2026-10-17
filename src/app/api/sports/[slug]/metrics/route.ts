import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { logMetric, metricEntrySchema } from "@/lib/services/sports";

export const POST = authedRoute({ body: metricEntrySchema.extend({ dateKey: dateKeySchema }) }, async ({ user, params, body }) => logMetric(user.id, params.slug, body));
