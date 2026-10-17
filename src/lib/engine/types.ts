import { z } from "zod";

export const EXPERIENCE = ["zero", "beginner", "intermediate", "advanced"] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const GOALS = [
  "general_fitness",
  "strength",
  "muscle",
  "calisthenics",
  "fat_loss",
  "athletic",
  "endurance",
  "mobility",
  "posture",
  "sport_conditioning",
  "return_to_exercise",
] as const;
export type Goal = (typeof GOALS)[number];

export const EMPHASES = [
  "balanced_calisthenics",
  "v_taper",
  "chest_arms",
  "abs_core",
  "full_body",
  "upper_body",
  "lower_body",
  "athletic_physique",
] as const;
export type Emphasis = (typeof EMPHASES)[number];

export const blockSchema = z.object({
  exercise: z.string(),
  sets: z.number().int().min(1).max(10),
  repMin: z.number().int().min(1).max(100).nullable(),
  repMax: z.number().int().min(1).max(100).nullable(),
  seconds: z.number().int().min(5).max(600).nullable(),
  restSeconds: z.number().int().min(0).max(600),
  note: z.string().max(300).optional(),
  easier: z.string().nullable().optional(),
  harder: z.string().nullable().optional(),
  progression: z.enum(["progress", "hold", "regress", "new"]).optional(),
});
export type Block = z.infer<typeof blockSchema>;

export const workoutSchema = z.object({
  title: z.string().max(120),
  focus: z.string().max(60),
  dayType: z.string().max(40),
  estimatedMinutes: z.number().int().min(1).max(240),
  warmup: z.array(blockSchema).max(10),
  main: z.array(blockSchema).min(1).max(14),
  cooldown: z.array(blockSchema).max(8),
  notes: z.array(z.string().max(400)).max(10),
  phase: z.number().int().min(1).max(6).optional(),
  readiness: z.enum(["rest", "easy", "normal", "ready"]).optional(),
});
export type GeneratedWorkout = z.infer<typeof workoutSchema>;

export interface ExerciseHistory {
  sessions: number;
  lastReps?: number | null;
  lastSeconds?: number | null;
  lastRpe?: number | null;
  /** Number of recent sessions in which every set hit the top of the target range. */
  recentTopHits: number;
  /** Recent sessions where the user fell short of the bottom of the range. */
  recentMisses: number;
  lastDate?: string;
}

export interface EngineProfile {
  experience: Experience;
  startFromZero: boolean;
  goals: string[];
  emphasis: Emphasis;
  equipment: string[];
  location: string;
  sessionMinutes: number;
  daysPerWeek: number;
  trainingDays: number[];
  limitations: string[];
  exercisePrefs: string[];
}

export interface EngineOptions {
  date: string;
  /** Index of this session within the training week (0-based). */
  dayIndex: number;
  history: Record<string, ExerciseHistory>;
  /** 0..1 from readiness check-in (0 = recovery session). */
  readinessVolume: number;
  readinessBand?: "rest" | "easy" | "normal" | "ready";
  phase?: number;
  deload?: boolean;
  minutesOverride?: number;
  focusOverride?: string;
  /** Exercise slug for the active Academy skill step, if any. */
  skillExercise?: string | null;
  /** Patterns to avoid today (e.g. "shoulders feel tired"). */
  avoidMuscles?: string[];
  seed?: string;
}
