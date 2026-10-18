import { z } from "zod";
import { db } from "../server/db";
import { badRequest, notFound } from "../server/errors";
import { env } from "../server/env";
import { log } from "../server/logger";
import { parseJson } from "../server/json";
import { addDays, todayKey } from "../domain/dates";
import { daySummary, scalePortion } from "../domain/nutrition";
import { calorieGuidance, proteinGuidance } from "../domain/energy";
import { getProfile } from "./profile";
import type { foodEntrySchema } from "../validation";

const servingsSchema = z.array(z.object({ label: z.string(), grams: z.number() }));

export function foodView(f: { id: string; name: string; brand: string | null; category: string; kcalPer100g: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null; servings: string; source: string; isEstimate: boolean; ownerId: string | null }) {
  return { ...f, servings: parseJson(f.servings, servingsSchema, [{ label: "100 g", grams: 100 }]) };
}
export type FoodView = ReturnType<typeof foodView>;

/** Optional USDA FoodData Central search. Only runs when FDC_API_KEY is configured. */
async function searchUsda(q: string): Promise<FoodView[]> {
  const key = env().FDC_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=10&dataType=Foundation,SR%20Legacy&api_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`USDA ${res.status}`);
    const data = (await res.json()) as { foods?: { fdcId: number; description: string; foodNutrients?: { nutrientNumber?: string; value?: number }[] }[] };
    return (data.foods ?? []).map((f) => {
      const n = (num: string) => f.foodNutrients?.find((x) => x.nutrientNumber === num)?.value ?? 0;
      return {
        id: `usda:${f.fdcId}`,
        name: f.description,
        brand: null,
        category: "usda",
        kcalPer100g: n("208"),
        proteinG: n("203"),
        carbsG: n("205"),
        fatG: n("204"),
        fiberG: n("291") || null,
        servings: [{ label: "100 g", grams: 100 }],
        source: "usda",
        isEstimate: false,
        ownerId: null,
      };
    });
  } catch (e) {
    log.warn("usda_search_failed", { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function searchFoods(userId: string, q: string) {
  const query = q.trim();
  if (!query) {
    const recent = await db.foodEntry.findMany({ where: { userId, foodId: { not: null } }, orderBy: { createdAt: "desc" }, take: 30, include: { food: true } });
    const seen = new Set<string>();
    const foods = recent.filter((r) => r.food && !seen.has(r.food.id) && seen.add(r.food.id)).map((r) => foodView(r.food!));
    return { foods: foods.slice(0, 10), source: "recent" as const, usdaConfigured: !!env().FDC_API_KEY };
  }
  const local = await db.food.findMany({
    where: { name: { contains: query }, OR: [{ ownerId: null }, { ownerId: userId }] },
    take: 25,
    orderBy: { name: "asc" },
  });
  // SQLite `contains` is case-sensitive for non-ASCII; also try a lower/upper-cased variant
  let rows = local;
  if (!rows.length) {
    const all = await db.food.findMany({ where: { OR: [{ ownerId: null }, { ownerId: userId }] }, take: 1000 });
    const ql = query.toLowerCase();
    rows = all.filter((f) => f.name.toLowerCase().includes(ql)).slice(0, 25);
  }
  const usda = rows.length < 5 ? await searchUsda(query) : [];
  return { foods: [...rows.map(foodView), ...usda], source: "local" as const, usdaConfigured: !!env().FDC_API_KEY };
}

type EntryInput = z.infer<typeof foodEntrySchema>;

export async function addFoodEntry(userId: string, input: EntryInput) {
  if (input.foodId && !input.foodId.startsWith("usda:")) {
    const food = await db.food.findFirst({ where: { id: input.foodId, OR: [{ ownerId: null }, { ownerId: userId }] } });
    if (!food) throw notFound("Food not found");
    const m = scalePortion(food, input.grams);
    return db.foodEntry.create({
      data: { userId, foodId: food.id, dateKey: input.dateKey, meal: input.meal, name: food.name, grams: input.grams, servingLabel: input.servingLabel ?? null, ...m, source: food.source, confidence: food.isEstimate ? "medium" : "high" },
    });
  }
  if (!input.name || input.kcal == null) throw badRequest("Custom entries need a name and calories");
  return db.foodEntry.create({
    data: {
      userId,
      dateKey: input.dateKey,
      meal: input.meal,
      name: input.name,
      grams: input.grams,
      servingLabel: input.servingLabel ?? null,
      kcal: Math.round(input.kcal),
      proteinG: input.proteinG ?? 0,
      carbsG: input.carbsG ?? 0,
      fatG: input.fatG ?? 0,
      source: input.source ?? "custom",
      confidence: input.confidence ?? (input.source === "ai_estimate" ? "low" : null),
    },
  });
}

export async function updateFoodEntry(userId: string, id: string, patch: { grams?: number; meal?: string; servingLabel?: string }) {
  const entry = await db.foodEntry.findFirst({ where: { id, userId }, include: { food: true } });
  if (!entry) throw notFound("Entry not found");
  const data: Record<string, unknown> = {};
  if (patch.meal) data.meal = patch.meal;
  if (patch.servingLabel !== undefined) data.servingLabel = patch.servingLabel;
  if (patch.grams && patch.grams !== entry.grams) {
    if (entry.food) Object.assign(data, scalePortion(entry.food, patch.grams));
    else {
      const f = patch.grams / entry.grams;
      Object.assign(data, { kcal: Math.round(entry.kcal * f), proteinG: entry.proteinG * f, carbsG: entry.carbsG * f, fatG: entry.fatG * f });
    }
    data.grams = patch.grams;
  }
  return db.foodEntry.update({ where: { id: entry.id }, data });
}

export async function deleteFoodEntry(userId: string, id: string) {
  const { count } = await db.foodEntry.deleteMany({ where: { id, userId } });
  if (!count) throw notFound("Entry not found");
}

export async function nutritionDay(userId: string, dateKey: string) {
  const p = await getProfile(userId);
  const [entries, water, burned] = await Promise.all([
    db.foodEntry.findMany({ where: { userId, dateKey }, orderBy: { createdAt: "asc" } }),
    db.waterLog.aggregate({ where: { userId, dateKey }, _sum: { ml: true } }),
    db.activityEntry.aggregate({ where: { userId, dateKey }, _sum: { kcalLow: true, kcalHigh: true } }),
  ]);
  const summary = daySummary(entries);
  const guidance = calorieGuidance(p, p.goals);
  const protein = proteinGuidance(p.weightKg, p.goals);
  return {
    dateKey,
    entries,
    summary,
    waterMl: water._sum.ml ?? 0,
    waterGoalMl: p.waterGoalMl,
    goals: {
      kcal: p.calorieGoal ?? guidance.target,
      kcalNote: p.calorieGoal ? "Your custom goal." : guidance.note,
      proteinG: p.proteinGoalG ?? protein?.grams ?? null,
    },
    exerciseKcal: { low: burned._sum.kcalLow ?? 0, high: burned._sum.kcalHigh ?? 0 },
    hasEstimates: entries.some((e) => e.source === "ai_estimate" || e.confidence === "low"),
  };
}

export async function nutritionWeek(userId: string, endKey: string) {
  const start = addDays(endKey, -6);
  const rows = await db.foodEntry.groupBy({
    by: ["dateKey"],
    where: { userId, dateKey: { gte: start, lte: endKey } },
    _sum: { kcal: true, proteinG: true, carbsG: true, fatG: true },
  });
  const map = new Map(rows.map((r) => [r.dateKey, r._sum]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const s = map.get(d);
    return { dateKey: d, kcal: Math.round(s?.kcal ?? 0), proteinG: Math.round(s?.proteinG ?? 0), carbsG: Math.round(s?.carbsG ?? 0), fatG: Math.round(s?.fatG ?? 0), logged: !!s };
  });
}

export async function addWater(userId: string, dateKey: string, ml: number) {
  return db.waterLog.create({ data: { userId, dateKey, ml } });
}

export async function resetWater(userId: string, dateKey: string) {
  await db.waterLog.deleteMany({ where: { userId, dateKey } });
}

export async function createCustomFood(userId: string, input: { name: string; kcalPer100g: number; proteinG: number; carbsG: number; fatG: number; servingLabel?: string; servingGrams?: number }) {
  const servings = [{ label: "100 g", grams: 100 }];
  if (input.servingLabel && input.servingGrams) servings.unshift({ label: input.servingLabel, grams: input.servingGrams });
  const f = await db.food.create({
    data: { ownerId: userId, name: input.name, kcalPer100g: input.kcalPer100g, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG, servings: JSON.stringify(servings), source: "custom", isEstimate: false, category: "custom" },
  });
  return foodView(f);
}

const mealItemSchema = z.object({ foodId: z.string().nullable().optional(), name: z.string(), grams: z.number(), kcal: z.number(), proteinG: z.number(), carbsG: z.number(), fatG: z.number() });
export const savedMealItems = z.array(mealItemSchema).min(1).max(30);

/** Food ids a user may link to: shared database foods and their own custom foods (USDA ids aren't stored rows). */
async function usableFoodIds(userId: string, ids: (string | null | undefined)[]) {
  const local = [...new Set(ids.filter((id): id is string => !!id && !id.startsWith("usda:")))];
  if (!local.length) return new Set<string>();
  const rows = await db.food.findMany({ where: { id: { in: local }, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export async function saveMeal(userId: string, input: { name: string; items: z.infer<typeof savedMealItems>; isRecipe?: boolean; servings?: number; notes?: string }) {
  const ok = await usableFoodIds(userId, input.items.map((i) => i.foodId));
  // Another user's private food (or an unknown id) is kept as a plain named item, never linked.
  const items = input.items.map((i) => ({ ...i, foodId: i.foodId && (i.foodId.startsWith("usda:") || ok.has(i.foodId)) ? i.foodId : null }));
  return db.savedMeal.create({
    data: { userId, name: input.name, items: JSON.stringify(items), isRecipe: !!input.isRecipe, servings: input.servings ?? 1, notes: input.notes ?? null },
  });
}

export async function listSavedMeals(userId: string) {
  const rows = await db.savedMeal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((r) => ({ ...r, items: parseJson(r.items, savedMealItems, []) }));
}

export async function logSavedMeal(userId: string, mealId: string, dateKey: string, meal: string, portion = 1) {
  const saved = await db.savedMeal.findFirst({ where: { id: mealId, userId } });
  if (!saved) throw notFound("Saved meal not found");
  const items = parseJson(saved.items, savedMealItems, []);
  const factor = portion / (saved.servings || 1);
  const ok = await usableFoodIds(userId, items.map((i) => i.foodId)); // a linked food may have been deleted since
  await db.foodEntry.createMany({
    data: items.map((i) => ({
      userId,
      foodId: i.foodId && ok.has(i.foodId) ? i.foodId : null,
      dateKey,
      meal,
      name: i.name,
      grams: Math.round(i.grams * factor),
      kcal: Math.round(i.kcal * factor),
      proteinG: Math.round(i.proteinG * factor * 10) / 10,
      carbsG: Math.round(i.carbsG * factor * 10) / 10,
      fatG: Math.round(i.fatG * factor * 10) / 10,
      source: "local",
    })),
  });
  return { logged: items.length };
}

export async function deleteSavedMeal(userId: string, id: string) {
  const { count } = await db.savedMeal.deleteMany({ where: { id, userId } });
  if (!count) throw notFound("Saved meal not found");
}

export async function todayNutrition(userId: string) {
  const p = await getProfile(userId);
  return nutritionDay(userId, todayKey(p.timezone));
}
