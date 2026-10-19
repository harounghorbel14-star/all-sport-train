import { authedRoute } from "@/lib/server/api";
import { correctMetricEntry, correctMetricSchema, deleteMetricEntry } from "@/lib/services/sports";

export const PATCH = authedRoute({ body: correctMetricSchema }, async ({ user, params, body }) => ({ entry: await correctMetricEntry(user.id, params.id, body) }));

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteMetricEntry(user.id, params.id);
  return { ok: true };
});
