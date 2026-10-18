import { UPPER_EXERCISES } from "./exercises-upper";
import { LOWER_CORE_EXERCISES } from "./exercises-lower-core";
import { SKILL_MOBILITY_EXERCISES } from "./exercises-skills-mobility";
import type { ExerciseSeed } from "./types";

export const EXERCISE_CATALOG: ExerciseSeed[] = [...UPPER_EXERCISES, ...LOWER_CORE_EXERCISES, ...SKILL_MOBILITY_EXERCISES];

export const EXERCISE_BY_SLUG = new Map(EXERCISE_CATALOG.map((e) => [e.slug, e]));

export { DIFFICULTY_LABELS, EQUIPMENT_LABELS, LIMITATION_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "../exercise-labels";
