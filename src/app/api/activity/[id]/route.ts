import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { correctActivity, deleteActivity } from "@/lib/services/activity";

export const PATCH = authedRoute(
  {
    body: z.object({
      dateKey: dateKeySchema.optional(),
      durationMin: z.number().positive().max(24 * 60).optional(),
      intensity: z.enum(["light", "moderate", "vigorous"]).optional(),
      distanceKm: z.number().min(0).max(1000).nullable().optional(),
      rpe: z.number().int().min(1).max(10).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
      reason: z.string().max(300).optional(),
    }),
  },
  async ({ user, params, body }) => ({ entry: await correctActivity(user.id, params.id, body) }),
);

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteActivity(user.id, params.id);
  return { ok: true };
});
