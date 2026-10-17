import { z } from "zod";
import { db } from "../server/db";
import { badRequest } from "../server/errors";
import { parseMealText, scalePortion } from "../domain/nutrition";
import { foodView } from "../services/nutrition";
import { AiUnavailableError, aiStatus, structured } from "./provider";

export const estimateItemSchema = z.object({
  name: z.string(),
  grams: z.number(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().optional(),
});
const aiEstimateSchema = z.object({
  items: z.array(estimateItemSchema),
  overallConfidence: z.enum(["high", "medium", "low"]),
  assumptions: z.array(z.string()),
});

export interface MealEstimate {
  items: (z.infer<typeof estimateItemSchema> & { foodId?: string | null })[];
  overallConfidence: "medium" | "low";
  assumptions: string[];
  provider: "ai" | "local";
  disclaimer: string;
}

const DISCLAIMER =
  "These are estimates, not measurements. Portion sizes, ingredients, sauces, oils and cooking methods can change the real values a lot. Review and correct each item before saving.";

const SYSTEM = `You estimate the nutrition of meals for a food diary. Return each distinct food item with an estimated portion in grams and estimated calories and macronutrients for that portion.
Be realistic and conservative. Note hidden ingredients (oil, butter, sauces) as separate items or in the note when relevant.
Confidence must reflect uncertainty: use "low" when portions or ingredients are unclear (typical for photos), "medium" when the description is specific. Use "high" only for packaged items with stated portions.
Never claim exact values. List the main assumptions you made.`;

const downgrade = (c: "high" | "medium" | "low"): "medium" | "low" => (c === "low" ? "low" : "medium");

/** Local fallback: match text against the food database. */
async function localEstimate(text: string): Promise<MealEstimate> {
  const foods = (await db.food.findMany({ where: { ownerId: null }, take: 2000 })).map(foodView);
  const parsed = parseMealText(text, foods);
  const items = parsed.map((p) => {
    if (!p.food) {
      return { name: p.query, grams: p.grams, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, confidence: "low" as const, note: "Not found in the local database — enter values manually.", foodId: null };
    }
    const m = scalePortion(p.food, p.grams);
    return { name: p.food.name, grams: p.grams, ...m, confidence: p.confidence, note: `Matched “${p.query}”`, foodId: p.food.id };
  });
  return {
    items,
    overallConfidence: "low",
    assumptions: ["Matched against the built-in food database using typical serving sizes.", "No AI provider is configured, so preparation methods and hidden ingredients are not estimated."],
    provider: "local",
    disclaimer: DISCLAIMER,
  };
}

export async function estimateMeal(input: { text?: string; image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } }): Promise<MealEstimate> {
  if (!input.text?.trim() && !input.image) throw badRequest("Describe the meal or add a photo");
  if (aiStatus().configured) {
    try {
      const content: ({ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } })[] = [];
      if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data } });
      content.push({ type: "text", text: input.text?.trim() ? `Meal description: ${input.text.trim()}` : "Estimate the meal in this photo." });
      const res = await structured({ system: SYSTEM, messages: [{ role: "user", content }], schema: aiEstimateSchema, maxTokens: 2000 });
      return {
        items: res.items.slice(0, 15).map((i) => ({ ...i, confidence: input.image ? "low" : downgrade(i.confidence), foodId: null })),
        overallConfidence: input.image ? "low" : downgrade(res.overallConfidence),
        assumptions: res.assumptions.slice(0, 8),
        provider: "ai",
        disclaimer: DISCLAIMER,
      };
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
      if (!input.text?.trim()) throw badRequest("Photo estimates are temporarily unavailable. Describe the meal in words instead.");
    }
  } else if (!input.text?.trim()) {
    throw badRequest("Photo estimates need an AI provider to be configured. Describe the meal in words, or search foods manually.");
  }
  return localEstimate(input.text!);
}
