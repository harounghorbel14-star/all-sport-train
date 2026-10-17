export interface Per100 {
  kcalPer100g: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrition for a portion, from per-100 g values. */
export function scalePortion(food: Per100, grams: number): Macros {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: Math.round(food.kcalPer100g * f),
    proteinG: r1(food.proteinG * f),
    carbsG: r1(food.carbsG * f),
    fatG: r1(food.fatG * f),
  };
}

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, proteinG: r1(a.proteinG + b.proteinG), carbsG: r1(a.carbsG + b.carbsG), fatG: r1(a.fatG + b.fatG) }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function daySummary<T extends Macros & { meal: string }>(entries: T[]) {
  const byMeal = Object.fromEntries(MEALS.map((m) => [m, sumMacros(entries.filter((e) => e.meal === m))])) as Record<Meal, Macros>;
  return { total: sumMacros(entries), byMeal };
}

/** Energy from macros (4/4/9) — useful to sanity check estimates. */
export const kcalFromMacros = (m: Omit<Macros, "kcal">) => Math.round(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9);

// ── Rule-based meal text parser (used when no AI provider is configured) ──
export interface ParsedItem {
  query: string;
  matchName: string | null;
  grams: number;
  confidence: "medium" | "low";
}

const WORD_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5, some: 1 };
const STOP = new Set(["of", "with", "and", "the", "some", "a", "an", "cup", "cups", "g", "grams", "gram", "slice", "slices", "bowl", "plate", "piece", "pieces", "tbsp", "tsp", "glass", "small", "large", "medium", "big"]);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && !/^\d/.test(t))
    .map((t) => t.replace(/(es|s)$/, ""));

export function bestFoodMatch<T extends { name: string }>(query: string, foods: T[]): { food: T; score: number } | null {
  const q = tokens(query);
  if (!q.length) return null;
  let best: { food: T; score: number } | null = null;
  for (const f of foods) {
    const ft = tokens(f.name);
    const hits = q.filter((t) => ft.some((x) => x === t || (t.length > 3 && (x.startsWith(t) || t.startsWith(x))))).length;
    if (!hits) continue;
    const score = hits / q.length - (ft.length - hits) * 0.05;
    if (!best || score > best.score) best = { food: f, score };
  }
  return best && best.score >= 0.5 ? best : null;
}

/**
 * Splits a free-text meal description into items and guesses portions.
 * Confidence is never "high": text alone cannot pin down portions or recipes.
 */
export function parseMealText<T extends { name: string; servings: { label: string; grams: number }[] }>(text: string, foods: T[]) {
  const parts = text
    .split(/,|\+|\band\b|\bwith\b|;|\n/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 12);
  return parts.map((part): ParsedItem & { food: T | null } => {
    const gramMatch = part.match(/(\d+(?:\.\d+)?)\s*(g|grams?)\b/i);
    const countMatch = part.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|half)\b/i);
    const match = bestFoodMatch(part, foods);
    const food = match?.food ?? null;
    let grams = 100;
    let confidence: ParsedItem["confidence"] = "low";
    if (gramMatch) {
      grams = parseFloat(gramMatch[1]);
      confidence = food ? "medium" : "low";
    } else if (food) {
      const count = countMatch ? (WORD_NUMBERS[countMatch[1].toLowerCase()] ?? parseFloat(countMatch[1])) : 1;
      const serving = food.servings[0];
      grams = Math.round((serving?.grams ?? 100) * (Number.isFinite(count) ? count : 1));
    }
    return { query: part, matchName: food?.name ?? null, grams, confidence, food };
  });
}
