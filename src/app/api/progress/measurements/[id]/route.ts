import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { measurementSchema } from "@/lib/validation";
import { correctMeasurement, deleteMeasurement } from "@/lib/services/progress";

export const PATCH = authedRoute(
  { body: measurementSchema.partial().extend({ reason: z.string().max(300).optional() }) },
  async ({ user, params, body }) => ({ measurement: await correctMeasurement(user.id, params.id, body) }),
);

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteMeasurement(user.id, params.id);
  return { ok: true };
});
