import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { listSavedMeals, saveMeal, savedMealItems } from "@/lib/services/nutrition";

export const GET = authedRoute({}, async ({ user }) => ({ meals: await listSavedMeals(user.id) }));
export const POST = authedRoute(
  { body: z.object({ name: z.string().trim().min(1).max(80), items: savedMealItems, isRecipe: z.boolean().optional(), servings: z.number().int().min(1).max(20).optional(), notes: z.string().max(500).optional() }) },
  async ({ user, body }) => ({ meal: await saveMeal(user.id, body) }),
);
