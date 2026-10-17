import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { createCustomFood, searchFoods } from "@/lib/services/nutrition";

export const GET = authedRoute({ query: z.object({ q: z.string().max(60).optional() }) }, async ({ user, query }) => searchFoods(user.id, query.q ?? ""));
export const POST = authedRoute(
  {
    body: z.object({
      name: z.string().trim().min(2).max(80),
      kcalPer100g: z.number().min(0).max(900),
      proteinG: z.number().min(0).max(100),
      carbsG: z.number().min(0).max(100),
      fatG: z.number().min(0).max(100),
      servingLabel: z.string().max(40).optional(),
      servingGrams: z.number().positive().max(2000).optional(),
    }),
  },
  async ({ user, body }) => ({ food: await createCustomFood(user.id, body) }),
);
