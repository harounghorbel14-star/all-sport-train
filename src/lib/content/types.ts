export const EQUIPMENT = [
  "pullup_bar",
  "low_bar",
  "rings",
  "parallel_bars",
  "parallettes",
  "resistance_band",
  "dumbbells",
  "kettlebell",
  "barbell",
  "bench",
  "cable_machine",
  "sturdy_chair",
  "sturdy_table",
  "jump_rope",
  "box",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const LIMITATIONS = ["shoulder", "wrist", "elbow", "lower_back", "knee", "ankle", "hip", "neck", "high_impact"] as const;
export type Limitation = (typeof LIMITATIONS)[number];

export const MOVEMENT_PATTERNS = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "dip",
  "squat",
  "lunge",
  "hinge",
  "calf",
  "core_anti_extension",
  "core_flexion",
  "core_lateral",
  "scapular",
  "shoulder_isolation",
  "arms",
  "carry",
  "balance",
  "plyometric",
  "conditioning",
  "skill",
  "mobility",
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const MUSCLES = [
  "chest",
  "upper_chest",
  "front_delts",
  "side_delts",
  "rear_delts",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "upper_back",
  "traps",
  "abs",
  "obliques",
  "deep_core",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
  "hip_flexors",
  "full_body",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type ExerciseCategory = "strength" | "skill" | "core" | "mobility" | "cardio" | "plyometric";

export interface ExerciseSeed {
  slug: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  primaryMuscles: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment?: Equipment[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  locations?: ("home" | "gym" | "outdoor")[];
  sports?: string[];
  progressionGroup?: string;
  progressionLevel?: number;
  isTimed?: boolean;
  defaultSets?: number;
  repMin?: number;
  repMax?: number;
  holdSeconds?: number;
  restSeconds?: number;
  met?: number;
  setup: string[];
  steps: string[];
  breathing: string;
  cues?: string[];
  mistakes: string[];
  safety?: string[];
  easier?: string[];
  harder?: string[];
  related?: string[];
  contraindications?: Limitation[];
}
