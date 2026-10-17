import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { MEALS } from "@/lib/domain/nutrition";
import { deleteFoodEntry, updateFoodEntry } from "@/lib/services/nutrition";

export const PATCH = authedRoute(
  { body: z.object({ grams: z.number().positive().max(5000).optional(), meal: z.enum(MEALS).optional(), servingLabel: z.string().max(60).optional() }) },
  async ({ user, params, body }) => ({ entry: await updateFoodEntry(user.id, params.id, body) }),
);
export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteFoodEntry(user.id, params.id);
  return { ok: true };
});
