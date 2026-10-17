import { z } from "zod";

/**
 * Sports knowledge content model. Sections are optional so each sport only
 * carries what makes sense for it (positions for team sports, rulesets for
 * competitive sports, contact levels for combat sports, …).
 */

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const levelRank = (l: string) => Math.max(0, LEVELS.indexOf(l as Level));

export const AVAILABILITY = ["full", "basic", "external"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABELS: Record<Availability, { label: string; body: string }> = {
  full: { label: "Learning system available", body: "Lessons, drills, rules summaries, practice builder and sport-specific progress tracking." },
  basic: { label: "In development", body: "Activity tracking and an overview are available. Lessons and drills are still being written." },
  external: { label: "Requires external instruction", body: "This activity must be learned with certified instructors or guides. We provide tracking and general conditioning only." },
};

export const CONTENT_STATUS = ["draft", "review", "published"] as const;

const text = z.string().trim().min(1).max(600);
const list = (max = 20) => z.array(text).max(max);

export const sportProfileSchema = z.object({
  introduction: z.string().max(1500).optional(),
  history: z.string().max(1500).optional(),
  environment: z.string().max(800).optional(),
  equipment: list(25).optional(),
  terminology: z.array(z.object({ term: z.string().max(60), definition: z.string().max(300) })).max(40).optional(),
  positions: z.array(z.object({ name: z.string().max(60), role: z.string().max(400) })).max(20).optional(),
  formations: z.array(z.object({ name: z.string().max(60), description: z.string().max(400) })).max(12).optional(),
  tactics: z.array(z.object({ title: z.string().max(80), points: list(8) })).max(12).optional(),
  techniqueAreas: z.array(z.object({ title: z.string().max(80), points: list(8) })).max(12).optional(),
  conditioning: z.object({ summary: z.string().max(600), exercises: z.array(z.string().max(60)).max(15) }).optional(),
  mobility: z.object({ summary: z.string().max(600), exercises: z.array(z.string().max(60)).max(12) }).optional(),
  injuryPrevention: list(12).optional(),
  recovery: list(10).optional(),
  competitionPrep: list(10).optional(),
  safety: list(12).optional(),
  ageGuidance: z.string().max(600).optional(),
  supervisionNote: z.string().max(600).optional(),
  beginner: list(10).optional(),
  milestones: z
    .array(z.object({ level: z.enum(["beginner", "intermediate", "advanced"]), title: z.string().max(120), metricKey: z.string().max(40).optional(), target: z.number().optional() }))
    .max(20)
    .optional(),
  weeklyStructure: z.array(z.object({ sessionsPerWeek: z.number().int().min(1).max(7), pattern: z.array(z.enum(["technique", "tactical", "conditioning", "game", "recovery"])).min(1).max(7) })).max(7).optional(),
  exerciseTags: z.array(z.string().max(30)).max(6).optional(),
  templates: z
    .array(z.object({ title: z.string().max(80), durationMin: z.number().int().min(5).max(240), intensity: z.enum(["light", "moderate", "vigorous"]), structure: list(10) }))
    .max(6)
    .optional(),
  externalResources: z.array(z.object({ label: z.string().max(120), note: z.string().max(300) })).max(6).optional(),
});
export type SportProfile = z.infer<typeof sportProfileSchema>;

export const lessonContentSchema = z.object({
  objectives: list(8),
  keyPoints: list(12),
  steps: list(12).optional(),
  mistakes: list(10).optional(),
  safety: list(8).optional(),
  progressTest: z.object({ description: z.string().max(400), metricKey: z.string().max(40).optional(), target: z.number().optional() }).optional(),
});
export type LessonContent = z.infer<typeof lessonContentSchema>;

export const drillContentSchema = z.object({
  setup: list(8),
  instructions: list(12),
  coachingPoints: list(8),
  progressions: list(6).optional(),
  regressions: list(6).optional(),
  record: z.string().max(200).optional(),
});
export type DrillContent = z.infer<typeof drillContentSchema>;

export const rulePointSchema = z.object({ topic: z.string().max(60), text: z.string().max(500) });

export const METRIC_KINDS = ["number", "time", "ratio", "select", "text"] as const;
export const metricSeedSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_]{2,40}$/),
  label: z.string().max(60),
  unit: z.string().max(20).optional(),
  kind: z.enum(METRIC_KINDS),
  scope: z.enum(["session", "performance"]),
  direction: z.enum(["higher", "lower", "none"]).default("higher"),
  options: z.array(z.string().max(40)).max(12).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minAttempts: z.number().int().min(1).max(500).optional(),
  description: z.string().max(200).optional(),
  measurement: z.string().max(200).optional(),
});
export type MetricSeed = z.input<typeof metricSeedSchema>;

export interface LessonSeed {
  slug: string;
  title: string;
  level: Level;
  summary: string;
  content: LessonContent;
  prerequisites?: string[];
  drills?: string[];
  requiresSupervision?: boolean;
  sources?: string[];
}

export interface DrillSeed {
  slug: string;
  title: string;
  purpose: string;
  level: Level;
  focus: "warmup" | "technique" | "tactical" | "conditioning" | "game" | "cooldown";
  durationMin: number;
  setting: "solo" | "partner" | "team";
  minPlayers?: number;
  equipment?: string[];
  contact?: "none" | "light" | "controlled" | "full";
  requiresSupervision?: boolean;
  metricKey?: string;
  content: DrillContent;
}

export interface RulesetSeed {
  slug: string;
  name: string;
  governingBody: string;
  scope: string;
  editionNote: string;
  points: { topic: string; text: string }[];
  verification: "summary" | "general" | "unverified";
  sources: string[];
}

export interface SportSeed {
  slug: string;
  name: string;
  category: string;
  parent?: string;
  summary: string;
  aliases?: string[];
  availability: Availability;
  met: [number, number, number]; // light, moderate, vigorous (approximate Compendium values)
  distance?: "km" | "m";
  workoutBased?: boolean;
  metrics?: MetricSeed[];
  profile?: SportProfile;
  lessons?: LessonSeed[];
  drills?: DrillSeed[];
  rulesets?: RulesetSeed[];
}

export interface SourceSeed {
  slug: string;
  title: string;
  publisher: string;
  url?: string;
  kind: "governing_body" | "education" | "research" | "other";
  notes?: string;
}

export const CATEGORIES = [
  { slug: "combat", name: "Combat sports & martial arts", description: "Striking, grappling, weapon-based and traditional martial arts." },
  { slug: "team", name: "Team ball sports", description: "Invasion, field, net and bat-and-ball team games." },
  { slug: "racket", name: "Racket, paddle & bat sports", description: "Individual and doubles racket and paddle games." },
  { slug: "athletics", name: "Athletics & endurance", description: "Track and field, road and trail running, cycling, multisport and paddling." },
  { slug: "strength", name: "Strength, gymnastics & fitness", description: "Calisthenics, lifting, gymnastics, conditioning and mind–body practice." },
  { slug: "water", name: "Water sports", description: "Swimming, diving, board, sail and paddle sports." },
  { slug: "outdoor", name: "Outdoor, mountain & adventure", description: "Mountain, snow, wheel, target and precision sports." },
  { slug: "other", name: "Dance, adaptive & other", description: "Dance, cheer, adaptive and Paralympic disciplines, and regional sports." },
] as const;
