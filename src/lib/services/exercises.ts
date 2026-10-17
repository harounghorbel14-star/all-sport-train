import type { Prisma } from "@prisma/client";
import { db } from "../server/db";
import { exerciseView, viewToEngine, type ExerciseView } from "../server/exercise-mapper";
import type { EngineExercise } from "../engine/generator";
import { notFound } from "../server/errors";

let cache: { at: number; views: ExerciseView[] } | null = null;
const TTL = 60_000;

/** All exercises (catalog + admin-added), cached briefly in memory. */
export async function allExercises(): Promise<ExerciseView[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.views;
  const rows = await db.exercise.findMany({ orderBy: [{ difficulty: "asc" }, { name: "asc" }] });
  cache = { at: Date.now(), views: rows.map(exerciseView) };
  return cache.views;
}

export const invalidateExerciseCache = () => {
  cache = null;
};

export async function engineExercises(): Promise<EngineExercise[]> {
  return (await allExercises()).map(viewToEngine);
}

export async function exerciseMap() {
  return new Map((await allExercises()).map((e) => [e.slug, e]));
}

export interface ExerciseFilters {
  q?: string;
  muscle?: string;
  pattern?: string;
  difficulty?: number;
  equipment?: string; // "none" or an equipment key
  sport?: string;
  location?: string;
  category?: string;
  level?: "beginner" | "advanced";
  favorites?: boolean;
}

export async function searchExercises(filters: ExerciseFilters, userId?: string) {
  let list = await allExercises();
  const q = filters.q?.trim().toLowerCase();
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.primaryMuscles.some((m) => m.includes(q)));
  if (filters.muscle) list = list.filter((e) => e.primaryMuscles.includes(filters.muscle!) || e.secondaryMuscles.includes(filters.muscle!));
  if (filters.pattern) list = list.filter((e) => e.movementPattern === filters.pattern);
  if (filters.difficulty) list = list.filter((e) => e.difficulty === filters.difficulty);
  if (filters.equipment === "none") list = list.filter((e) => e.equipment.length === 0);
  else if (filters.equipment) list = list.filter((e) => e.equipment.includes(filters.equipment!));
  if (filters.sport) list = list.filter((e) => e.sports.includes(filters.sport!));
  if (filters.location) list = list.filter((e) => e.locations.includes(filters.location!));
  if (filters.category) list = list.filter((e) => e.category === filters.category);
  if (filters.level === "beginner") list = list.filter((e) => e.difficulty <= 2);
  if (filters.level === "advanced") list = list.filter((e) => e.difficulty >= 4);
  let favs = new Set<string>();
  if (userId) {
    const rows = await db.favoriteExercise.findMany({ where: { userId }, select: { exerciseId: true } });
    favs = new Set(rows.map((r) => r.exerciseId));
    if (filters.favorites) list = list.filter((e) => favs.has(e.id));
  }
  return list.map((e) => ({ ...e, favorite: favs.has(e.id) }));
}

export async function getExercise(slug: string, userId?: string) {
  const row = await db.exercise.findUnique({ where: { slug } });
  if (!row) throw notFound("Exercise not found");
  const view = exerciseView(row);
  if (!userId) return { exercise: view, favorite: false, records: [], recentSets: [] };
  const [fav, records, recentSets] = await Promise.all([
    db.favoriteExercise.findUnique({ where: { userId_exerciseId: { userId, exerciseId: row.id } } }),
    db.personalRecord.findMany({ where: { userId, exerciseId: row.id }, orderBy: { value: "desc" }, take: 5 }),
    db.setLog.findMany({
      where: { exerciseId: row.id, skipped: false, session: { userId } },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { reps: true, seconds: true, loadKg: true, rpe: true, completedAt: true },
    }),
  ]);
  return { exercise: view, favorite: !!fav, records, recentSets };
}

export async function toggleFavorite(userId: string, slug: string, on: boolean) {
  const ex = await db.exercise.findUnique({ where: { slug }, select: { id: true } });
  if (!ex) throw notFound("Exercise not found");
  if (on) {
    await db.favoriteExercise.upsert({ where: { userId_exerciseId: { userId, exerciseId: ex.id } }, create: { userId, exerciseId: ex.id }, update: {} });
  } else {
    await db.favoriteExercise.deleteMany({ where: { userId, exerciseId: ex.id } });
  }
  return { favorite: on };
}

export async function upsertCustomExercise(data: Prisma.ExerciseCreateInput) {
  const row = await db.exercise.upsert({ where: { slug: data.slug }, create: { ...data, isCustom: true }, update: data });
  invalidateExerciseCache();
  return exerciseView(row);
}
