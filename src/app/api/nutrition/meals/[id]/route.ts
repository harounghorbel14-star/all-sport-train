import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { MEALS } from "@/lib/domain/nutrition";
import { deleteSavedMeal, logSavedMeal } from "@/lib/services/nutrition";

export const POST = authedRoute(
  { body: z.object({ dateKey: dateKeySchema, meal: z.enum(MEALS), portion: z.number().positive().max(20).optional() }) },
  async ({ user, params, body }) => logSavedMeal(user.id, params.id, body.dateKey, body.meal, body.portion),
);
export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteSavedMeal(user.id, params.id);
  return { ok: true };
});
