export type Intensity = "light" | "moderate" | "vigorous";

export interface SportField {
  key: string;
  label: string;
  type: "number" | "select" | "text";
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface SportTemplate {
  title: string;
  durationMin: number;
  intensity: Intensity;
  structure: string[];
}

export interface SportDef {
  slug: string;
  name: string;
  group: "strength" | "endurance" | "team" | "combat" | "racket" | "mind_body" | "conditioning";
  /** MET values from the Compendium of Physical Activities (rounded). */
  met: Record<Intensity, number>;
  distance: "km" | "m" | null;
  fields: SportField[];
  primaryMetrics: string[];
  beginner: string[];
  templates: SportTemplate[];
  workoutBased?: boolean; // logged primarily through the workout tracker
}

const sessionType = (options: string[]): SportField => ({ key: "sessionType", label: "Session type", type: "select", options });

export const SPORTS: SportDef[] = [
  {
    slug: "calisthenics",
    name: "Calisthenics",
    group: "strength",
    met: { light: 2.8, moderate: 3.8, vigorous: 8.0 },
    distance: null,
    workoutBased: true,
    fields: [sessionType(["strength", "skill practice", "conditioning"])],
    primaryMetrics: ["Exercise variations", "Reps & holds", "Skill milestones"],
    beginner: [
      "Start with the easiest variation you can do with clean form for 8–12 reps.",
      "Progress by moving up a variation, not by grinding sloppy reps.",
      "Two to four sessions per week is plenty to make steady progress.",
    ],
    templates: [
      { title: "Full-body foundation", durationMin: 30, intensity: "moderate", structure: ["Push", "Pull", "Squat", "Hinge", "Core"] },
      { title: "Skill + strength", durationMin: 45, intensity: "moderate", structure: ["10 min skill practice", "Strength circuit", "Core finisher"] },
    ],
  },
  {
    slug: "strength",
    name: "Strength Training",
    group: "strength",
    met: { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    distance: null,
    workoutBased: true,
    fields: [sessionType(["full body", "upper", "lower", "push", "pull"])],
    primaryMetrics: ["Sets × reps × load", "Estimated volume", "Personal records"],
    beginner: ["Learn the movement with light loads first.", "Leave 1–3 reps in reserve on most sets.", "Add load in small steps once all target reps feel solid."],
    templates: [{ title: "Full-body strength", durationMin: 50, intensity: "moderate", structure: ["Squat", "Press", "Row", "Hinge", "Carry"] }],
  },
  {
    slug: "gym",
    name: "Gym & Bodybuilding",
    group: "strength",
    met: { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    distance: null,
    workoutBased: true,
    fields: [sessionType(["push", "pull", "legs", "upper", "lower", "full body"])],
    primaryMetrics: ["Sets × reps × load", "Weekly sets per muscle", "Personal records"],
    beginner: ["About 10 hard sets per muscle per week is a solid starting point.", "Prioritise compound lifts, then add isolation work.", "Sleep and protein matter as much as the program."],
    templates: [{ title: "Upper hypertrophy", durationMin: 60, intensity: "moderate", structure: ["Incline press", "Pulldown", "Row", "Lateral raise", "Curls & triceps"] }],
  },
  {
    slug: "running",
    name: "Running",
    group: "endurance",
    met: { light: 7.0, moderate: 9.8, vigorous: 11.8 },
    distance: "km",
    fields: [
      sessionType(["easy", "tempo", "intervals", "long run", "race"]),
      { key: "elevationM", label: "Elevation gain", type: "number", unit: "m", min: 0, max: 10000 },
    ],
    primaryMetrics: ["Distance", "Duration", "Pace"],
    beginner: ["Start with run/walk intervals (e.g. 1 min run, 2 min walk).", "Most runs should feel conversational.", "Increase weekly distance gradually — roughly 10% per week is a common guideline."],
    templates: [
      { title: "Run/walk starter", durationMin: 25, intensity: "light", structure: ["5 min brisk walk", "8 × (1 min jog + 1.5 min walk)", "Cool-down walk"] },
      { title: "Easy run", durationMin: 30, intensity: "moderate", structure: ["Easy conversational pace", "Relaxed shoulders, light steps"] },
    ],
  },
  {
    slug: "walking",
    name: "Walking",
    group: "endurance",
    met: { light: 2.8, moderate: 3.5, vigorous: 5.0 },
    distance: "km",
    fields: [{ key: "steps", label: "Steps", type: "number", min: 0, max: 100000 }],
    primaryMetrics: ["Distance", "Duration", "Steps"],
    beginner: ["Walking counts — it is one of the best habits you can build.", "A brisk pace is where talking is possible but singing is hard."],
    templates: [{ title: "Brisk walk", durationMin: 30, intensity: "moderate", structure: ["5 min easy", "20 min brisk", "5 min easy"] }],
  },
  {
    slug: "cycling",
    name: "Cycling",
    group: "endurance",
    met: { light: 4.0, moderate: 6.8, vigorous: 10.0 },
    distance: "km",
    fields: [
      { key: "environment", label: "Environment", type: "select", options: ["outdoor", "indoor"] },
      { key: "elevationM", label: "Elevation gain", type: "number", unit: "m", min: 0, max: 10000 },
    ],
    primaryMetrics: ["Distance", "Duration", "Elevation"],
    beginner: ["Set saddle height so the knee is slightly bent at the bottom of the pedal stroke.", "Always wear a helmet outdoors."],
    templates: [{ title: "Endurance ride", durationMin: 45, intensity: "moderate", structure: ["10 min easy", "30 min steady", "5 min easy"] }],
  },
  {
    slug: "swimming",
    name: "Swimming",
    group: "endurance",
    met: { light: 5.8, moderate: 7.0, vigorous: 9.8 },
    distance: "m",
    fields: [
      { key: "stroke", label: "Main stroke", type: "select", options: ["freestyle", "breaststroke", "backstroke", "butterfly", "mixed"] },
      { key: "poolLengthM", label: "Pool length", type: "number", unit: "m", min: 10, max: 100 },
    ],
    primaryMetrics: ["Distance", "Time", "Stroke"],
    beginner: ["Focus on relaxed breathing before speed.", "Rest at the wall as often as you need."],
    templates: [{ title: "Technique swim", durationMin: 30, intensity: "light", structure: ["200 m easy", "8 × 25 m drills", "200 m easy"] }],
  },
  {
    slug: "football",
    name: "Football / Soccer",
    group: "team",
    met: { light: 5.0, moderate: 7.0, vigorous: 10.0 },
    distance: "km",
    fields: [
      sessionType(["training", "match", "casual game"]),
      { key: "minutesPlayed", label: "Minutes played", type: "number", min: 0, max: 200 },
      { key: "goals", label: "Goals", type: "number", min: 0, max: 50 },
      { key: "assists", label: "Assists", type: "number", min: 0, max: 50 },
    ],
    primaryMetrics: ["Session duration", "Perceived intensity", "Goals & assists"],
    beginner: ["Hamstring and calf strength reduce common injury risk.", "Warm up with dynamic drills before playing."],
    templates: [{ title: "Speed & agility", durationMin: 40, intensity: "vigorous", structure: ["Dynamic warm-up", "Ladder / cone drills", "6 × 30 m sprints", "Nordic negatives"] }],
  },
  {
    slug: "basketball",
    name: "Basketball",
    group: "team",
    met: { light: 4.5, moderate: 6.5, vigorous: 8.0 },
    distance: null,
    fields: [
      sessionType(["shooting", "training", "game"]),
      { key: "points", label: "Points", type: "number", min: 0, max: 200 },
      { key: "rebounds", label: "Rebounds", type: "number", min: 0, max: 100 },
      { key: "assists", label: "Assists", type: "number", min: 0, max: 100 },
    ],
    primaryMetrics: ["Session duration", "Perceived intensity", "Game stats"],
    beginner: ["Learn landing mechanics to protect knees.", "Strong calves and ankles help with jumping."],
    templates: [{ title: "Vertical jump prep", durationMin: 35, intensity: "moderate", structure: ["Landing sticks", "Squat jumps", "Bulgarian split squats", "Calf raises"] }],
  },
  {
    slug: "boxing",
    name: "Boxing",
    group: "combat",
    met: { light: 5.5, moderate: 7.8, vigorous: 9.0 },
    distance: null,
    fields: [
      sessionType(["technique", "bag work", "pads", "sparring"]),
      { key: "rounds", label: "Rounds", type: "number", min: 0, max: 50 },
      { key: "roundMinutes", label: "Round length", type: "number", unit: "min", min: 1, max: 5 },
    ],
    primaryMetrics: ["Rounds", "Duration", "Perceived intensity"],
    beginner: ["Learn stance and guard before power.", "Always wrap hands for bag work.", "Only spar under qualified supervision."],
    templates: [{ title: "Bag rounds", durationMin: 30, intensity: "vigorous", structure: ["Jump rope 5 min", "6 × 2 min bag rounds, 1 min rest", "Core finisher"] }],
  },
  {
    slug: "martial_arts",
    name: "Martial Arts",
    group: "combat",
    met: { light: 5.3, moderate: 7.0, vigorous: 10.3 },
    distance: null,
    fields: [
      { key: "style", label: "Style", type: "text" },
      sessionType(["technique", "drilling", "sparring / rolling", "forms"]),
    ],
    primaryMetrics: ["Session duration", "Perceived intensity"],
    beginner: ["Train under a qualified instructor.", "Mobility and grip strength carry over to most styles."],
    templates: [{ title: "Martial arts conditioning", durationMin: 30, intensity: "moderate", structure: ["Mobility", "Shadow drills", "Core circuit"] }],
  },
  {
    slug: "tennis",
    name: "Tennis",
    group: "racket",
    met: { light: 5.0, moderate: 7.3, vigorous: 8.0 },
    distance: null,
    fields: [
      sessionType(["drills", "singles", "doubles"]),
      { key: "setsPlayed", label: "Sets played", type: "number", min: 0, max: 10 },
    ],
    primaryMetrics: ["Session duration", "Sets played"],
    beginner: ["Rotator-cuff and forearm strength help prevent overuse issues."],
    templates: [{ title: "Court conditioning", durationMin: 30, intensity: "moderate", structure: ["Lateral shuffles", "Split-step drills", "Pallof press", "Face pulls"] }],
  },
  {
    slug: "volleyball",
    name: "Volleyball",
    group: "team",
    met: { light: 3.0, moderate: 4.0, vigorous: 8.0 },
    distance: null,
    fields: [sessionType(["training", "indoor match", "beach"])],
    primaryMetrics: ["Session duration", "Perceived intensity"],
    beginner: ["Land softly from jumps; strengthen shoulders for serving and spiking."],
    templates: [{ title: "Jump & shoulder prep", durationMin: 30, intensity: "moderate", structure: ["Landing sticks", "Squat jumps", "Band pull-aparts", "Face pulls"] }],
  },
  {
    slug: "hiking",
    name: "Hiking",
    group: "endurance",
    met: { light: 5.3, moderate: 6.0, vigorous: 7.8 },
    distance: "km",
    fields: [
      { key: "elevationM", label: "Elevation gain", type: "number", unit: "m", min: 0, max: 10000 },
      { key: "packKg", label: "Pack weight", type: "number", unit: "kg", min: 0, max: 50 },
    ],
    primaryMetrics: ["Distance", "Elevation", "Duration"],
    beginner: ["Carry water, check weather and tell someone your route.", "Step-ups and calf raises prepare your legs for climbs."],
    templates: [{ title: "Trail prep", durationMin: 35, intensity: "moderate", structure: ["Step-ups", "Reverse lunges", "Calf raises", "Single-leg balance"] }],
  },
  {
    slug: "yoga",
    name: "Yoga",
    group: "mind_body",
    met: { light: 2.3, moderate: 3.0, vigorous: 4.0 },
    distance: null,
    fields: [{ key: "style", label: "Style", type: "select", options: ["hatha", "vinyasa", "yin", "power", "restorative"] }],
    primaryMetrics: ["Session duration", "Consistency"],
    beginner: ["Use blocks and straps freely — they are tools, not crutches.", "Never force a pose into pain."],
    templates: [{ title: "Gentle flow", durationMin: 20, intensity: "light", structure: ["Breathing", "Cat-cow", "Sun salutations", "Child's pose"] }],
  },
  {
    slug: "pilates",
    name: "Pilates",
    group: "mind_body",
    met: { light: 2.8, moderate: 3.0, vigorous: 4.0 },
    distance: null,
    fields: [{ key: "style", label: "Style", type: "select", options: ["mat", "reformer"] }],
    primaryMetrics: ["Session duration", "Consistency"],
    beginner: ["Focus on controlled breathing and deep core engagement."],
    templates: [{ title: "Core control", durationMin: 25, intensity: "light", structure: ["Dead bugs", "Bird dogs", "Side planks", "Glute bridges"] }],
  },
  {
    slug: "mobility",
    name: "Mobility",
    group: "mind_body",
    met: { light: 2.3, moderate: 2.5, vigorous: 3.0 },
    distance: null,
    fields: [{ key: "focusArea", label: "Focus area", type: "text" }],
    primaryMetrics: ["Sessions", "Minutes"],
    beginner: ["Short daily sessions beat occasional long ones."],
    templates: [{ title: "Daily 10", durationMin: 10, intensity: "light", structure: ["Upper-back reset", "Hip opener"] }],
  },
  {
    slug: "hiit",
    name: "HIIT & Conditioning",
    group: "conditioning",
    met: { light: 6.0, moderate: 8.0, vigorous: 10.0 },
    distance: null,
    fields: [
      { key: "rounds", label: "Rounds", type: "number", min: 0, max: 100 },
      { key: "workSec", label: "Work interval", type: "number", unit: "s", min: 5, max: 600 },
      { key: "restSec", label: "Rest interval", type: "number", unit: "s", min: 0, max: 600 },
    ],
    primaryMetrics: ["Rounds", "Duration", "Perceived intensity"],
    beginner: ["Start with low-impact moves and longer rests.", "One or two HIIT sessions per week is enough for most people."],
    templates: [{ title: "Low-impact intervals", durationMin: 20, intensity: "moderate", structure: ["Step jacks", "Step-back burpees", "Mountain climbers", "40 s work / 20 s rest × 3 rounds"] }],
  },
  {
    slug: "athletic",
    name: "General Athletic Training",
    group: "conditioning",
    met: { light: 4.0, moderate: 6.0, vigorous: 8.0 },
    distance: null,
    fields: [{ key: "focusArea", label: "Focus", type: "text" }],
    primaryMetrics: ["Session duration", "Perceived intensity"],
    beginner: ["Mix strength, speed, mobility and conditioning across the week."],
    templates: [{ title: "Athletic circuit", durationMin: 35, intensity: "moderate", structure: ["Landing sticks", "Push-ups", "Inverted rows", "Split squats", "Plank"] }],
  },
];

export const SPORT_BY_SLUG = new Map(SPORTS.map((s) => [s.slug, s]));
