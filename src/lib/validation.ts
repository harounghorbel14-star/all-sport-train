import { z } from "zod";
import { EQUIPMENT, LIMITATIONS } from "./content/types";
import { EMPHASES, EXPERIENCE, GOALS } from "./engine/types";
import { isDateKey, isValidTimeZone } from "./domain/dates";
import { MEALS } from "./domain/nutrition";

export const AGE_RANGES = ["under18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export const LOCATIONS = ["home", "gym", "outdoor", "mixed"] as const;
export const DIET_PREFS = ["none", "vegetarian", "vegan", "pescatarian", "halal", "kosher", "low_lactose", "gluten_free"] as const;
export const EXERCISE_PREFS = ["bodyweight", "weights", "short_sessions", "low_impact", "skills", "outdoors"] as const;

export const dateKeySchema = z.string().refine(isDateKey, "Expected a date in YYYY-MM-DD format");
export const timeZoneSchema = z.string().max(64).refine(isValidTimeZone, "Unknown time zone");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Include at least one letter and one number");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Tell us what to call you").max(40),
  timezone: timeZoneSchema.optional(),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

const list = <T extends readonly [string, ...string[]]>(values: T, max = 20) => z.array(z.enum(values)).max(max);

export const onboardingSchema = z.object({
  ageRange: z.enum(AGE_RANGES).nullable().optional(),
  sex: z.enum(["female", "male", "unspecified"]).nullable().optional(),
  experience: z.enum(EXPERIENCE),
  startFromZero: z.boolean(),
  goals: list(GOALS).min(1, "Pick at least one goal"),
  emphasis: z.enum(EMPHASES),
  sports: z.array(z.string().max(30)).max(20),
  location: z.enum(LOCATIONS),
  equipment: list(EQUIPMENT, 30),
  daysPerWeek: z.number().int().min(1).max(7),
  trainingDays: z.array(z.number().int().min(0).max(6)).max(7),
  sessionMinutes: z.number().int().min(10).max(120),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  limitations: list(LIMITATIONS),
  limitationNotes: z.string().max(500).nullable().optional(),
  exercisePrefs: list(EXERCISE_PREFS),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  weightKg: z.number().min(25).max(350).nullable().optional(),
  dietPrefs: list(DIET_PREFS),
  allergies: z.array(z.string().trim().max(40)).max(20),
  units: z.enum(["metric", "imperial"]).optional(),
  timezone: timeZoneSchema.optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const notificationPrefsSchema = z.object({
  workoutReminders: z.boolean().default(false),
  hydrationReminders: z.boolean().default(false),
  weeklyReport: z.boolean().default(true),
  challengeDeadlines: z.boolean().default(true),
  milestones: z.boolean().default(true),
  habitReminders: z.boolean().default(false),
  reminderHour: z.number().int().min(0).max(23).default(18),
  quietStart: z.number().int().min(0).max(23).default(22),
  quietEnd: z.number().int().min(0).max(23).default(7),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const settingsSchema = onboardingSchema.partial().extend({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().max(300).nullable().optional(),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3–20 letters, numbers or underscores")
    .optional(),
  locale: z.enum(["en", "fr", "ar"]).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  reducedMotion: z.boolean().optional(),
  calorieGoal: z.number().int().min(800).max(6000).nullable().optional(),
  proteinGoalG: z.number().int().min(20).max(400).nullable().optional(),
  waterGoalMl: z.number().int().min(500).max(8000).optional(),
  nutritionInCoach: z.boolean().optional(),
  accountability: z.boolean().optional(),
  visibility: z.enum(["private", "friends", "public"]).optional(),
  shareWorkouts: z.boolean().optional(),
  notificationPrefs: notificationPrefsSchema.partial().optional(),
});

export const foodEntrySchema = z.object({
  dateKey: dateKeySchema,
  meal: z.enum(MEALS),
  foodId: z.string().max(40).optional(),
  grams: z.number().positive().max(5000),
  servingLabel: z.string().max(60).optional(),
  // For custom / AI-estimated entries without a database food
  name: z.string().trim().min(1).max(120).optional(),
  kcal: z.number().min(0).max(10000).optional(),
  proteinG: z.number().min(0).max(1000).optional(),
  carbsG: z.number().min(0).max(1000).optional(),
  fatG: z.number().min(0).max(1000).optional(),
  source: z.enum(["local", "usda", "custom", "ai_estimate", "quick"]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const activitySchema = z.object({
  sport: z.string().max(30),
  title: z.string().max(80).optional(),
  dateKey: dateKeySchema,
  durationMin: z.number().positive().max(24 * 60),
  intensity: z.enum(["light", "moderate", "vigorous"]),
  rpe: z.number().int().min(1).max(10).optional(),
  distanceKm: z.number().min(0).max(1000).optional(),
  elevationM: z.number().min(0).max(20000).optional(),
  metrics: z.record(z.string(), z.union([z.string().max(80), z.number()])).optional(),
  notes: z.string().max(500).optional(),
  externalId: z.string().max(100).optional(),
});

export const checkInSchema = z.object({
  dateKey: dateKeySchema,
  sleepHours: z.number().min(0).max(16).nullable().optional(),
  energy: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5).nullable().optional(),
  pain: z.boolean().default(false),
  painNotes: z.string().max(300).nullable().optional(),
  isRestDay: z.boolean().default(false),
});

export const measurementSchema = z.object({
  dateKey: dateKeySchema,
  weightKg: z.number().min(25).max(350).nullable().optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  chestCm: z.number().min(40).max(200).nullable().optional(),
  waistCm: z.number().min(40).max(200).nullable().optional(),
  armCm: z.number().min(10).max(80).nullable().optional(),
  thighCm: z.number().min(20).max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  milestone: z.string().max(120).nullable().optional(),
});
