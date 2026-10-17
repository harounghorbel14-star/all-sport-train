import type { Exercise } from "@prisma/client";
import { z } from "zod";
import type { ExerciseSeed } from "../content/types";
import type { EngineExercise } from "../engine/generator";
import { parseJson } from "./json";

const strArr = z.array(z.string());
const arr = (raw: string) => parseJson(raw, strArr, []);

export function exerciseToDb(ex: ExerciseSeed) {
  return {
    slug: ex.slug,
    name: ex.name,
    description: ex.description,
    category: ex.category,
    movementPattern: ex.movementPattern,
    primaryMuscles: JSON.stringify(ex.primaryMuscles),
    secondaryMuscles: JSON.stringify(ex.secondaryMuscles ?? []),
    equipment: JSON.stringify(ex.equipment ?? []),
    difficulty: ex.difficulty,
    locations: JSON.stringify(ex.locations ?? ["home", "gym", "outdoor"]),
    sports: JSON.stringify(ex.sports ?? ["calisthenics"]),
    progressionGroup: ex.progressionGroup ?? null,
    progressionLevel: ex.progressionLevel ?? null,
    isTimed: ex.isTimed ?? false,
    defaultSets: ex.defaultSets ?? 3,
    repMin: ex.repMin ?? 8,
    repMax: ex.repMax ?? 12,
    holdSeconds: ex.holdSeconds ?? null,
    restSeconds: ex.restSeconds ?? 90,
    met: ex.met ?? 4,
    setup: JSON.stringify(ex.setup),
    steps: JSON.stringify(ex.steps),
    breathing: ex.breathing,
    cues: JSON.stringify(ex.cues ?? []),
    mistakes: JSON.stringify(ex.mistakes),
    safety: JSON.stringify(ex.safety ?? []),
    easier: JSON.stringify(ex.easier ?? []),
    harder: JSON.stringify(ex.harder ?? []),
    related: JSON.stringify(ex.related ?? []),
    contraindications: JSON.stringify(ex.contraindications ?? []),
  };
}

/** Client-safe exercise view model. */
export function exerciseView(e: Exercise) {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description,
    category: e.category,
    movementPattern: e.movementPattern,
    primaryMuscles: arr(e.primaryMuscles),
    secondaryMuscles: arr(e.secondaryMuscles),
    equipment: arr(e.equipment),
    difficulty: e.difficulty,
    locations: arr(e.locations),
    sports: arr(e.sports),
    progressionGroup: e.progressionGroup,
    progressionLevel: e.progressionLevel,
    isTimed: e.isTimed,
    defaultSets: e.defaultSets,
    repMin: e.repMin,
    repMax: e.repMax,
    holdSeconds: e.holdSeconds,
    restSeconds: e.restSeconds,
    met: e.met,
    setup: arr(e.setup),
    steps: arr(e.steps),
    breathing: e.breathing,
    cues: arr(e.cues),
    mistakes: arr(e.mistakes),
    safety: arr(e.safety),
    easier: arr(e.easier),
    harder: arr(e.harder),
    related: arr(e.related),
    contraindications: arr(e.contraindications),
    mediaUrl: e.mediaUrl,
    isCustom: e.isCustom,
  };
}
export type ExerciseView = ReturnType<typeof exerciseView>;

export function viewToEngine(v: ExerciseView): EngineExercise {
  return {
    slug: v.slug,
    name: v.name,
    category: v.category as EngineExercise["category"],
    movementPattern: v.movementPattern as EngineExercise["movementPattern"],
    primaryMuscles: v.primaryMuscles as EngineExercise["primaryMuscles"],
    secondaryMuscles: v.secondaryMuscles as EngineExercise["secondaryMuscles"],
    equipment: v.equipment as EngineExercise["equipment"],
    difficulty: v.difficulty as EngineExercise["difficulty"],
    locations: v.locations as EngineExercise["locations"],
    isTimed: v.isTimed,
    defaultSets: v.defaultSets,
    repMin: v.repMin,
    repMax: v.repMax,
    holdSeconds: v.holdSeconds,
    restSeconds: v.restSeconds,
    met: v.met,
    easier: v.easier,
    harder: v.harder,
    contraindications: v.contraindications as EngineExercise["contraindications"],
    progressionGroup: v.progressionGroup,
    progressionLevel: v.progressionLevel,
  };
}
