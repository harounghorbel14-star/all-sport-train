import type { Equipment } from "./types";

export type SkillCategory = "foundations" | "upper" | "core" | "legs" | "advanced";

export interface SkillTarget {
  metric: "reps" | "seconds";
  value: number;
  sets: number;
}

export interface SkillStep {
  exercise: string; // exercise slug
  alternatives?: string[]; // equivalent slugs for other equipment
  title: string;
  target: SkillTarget;
  tip: string;
}

export interface Prerequisite {
  label: string;
  exercise: string;
  metric: "reps" | "seconds";
  value: number;
}

export interface SkillDef {
  slug: string;
  name: string;
  category: SkillCategory;
  alsoIn?: SkillCategory[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  summary: string;
  /** Any one of these equipment sets is enough. Empty array = no equipment. */
  equipmentAny: Equipment[][];
  prerequisites: Prerequisite[];
  steps: SkillStep[];
  supporting: string[];
  commonErrors: string[];
  rest: string;
  safety: string[];
  typicalTimeline: string;
}

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  foundations: "Beginner foundations",
  upper: "Upper-body strength",
  core: "Core & abs",
  legs: "Legs & athleticism",
  advanced: "Advanced skills",
};

const reps = (value: number, sets = 3): SkillTarget => ({ metric: "reps", value, sets });
const hold = (value: number, sets = 3): SkillTarget => ({ metric: "seconds", value, sets });

export const SKILLS: SkillDef[] = [
  // ── A. Foundations ──────────────────────────────────────────────────
  {
    slug: "first-push-up",
    name: "Your First Push-Up",
    category: "foundations",
    difficulty: 1,
    summary: "Go from wall push-ups to clean floor push-ups with full range of motion.",
    equipmentAny: [[]],
    prerequisites: [],
    steps: [
      { exercise: "wall-push-up", title: "Wall push-ups", target: reps(15), tip: "Body moves as one straight plank." },
      { exercise: "incline-push-up", title: "Incline push-ups", target: reps(12), tip: "Lower the surface a little every week." },
      { exercise: "knee-push-up", alternatives: ["push-up-negative"], title: "Knee push-ups or negatives", target: reps(10), tip: "Negatives: 3–5 s down, reset on the knees." },
      { exercise: "push-up", title: "Full push-ups", target: reps(5), tip: "Chest close to the floor every rep." },
    ],
    supporting: ["front-plank", "scapular-push-up", "dead-bug"],
    commonErrors: ["Sagging hips", "Half repetitions", "Elbows flared to 90°"],
    rest: "Train 2–3 times per week with at least one rest day between sessions.",
    safety: ["Stop if you feel sharp wrist or shoulder pain."],
    typicalTimeline: "Often 3–10 weeks for complete beginners; varies widely.",
  },
  {
    slug: "squat-foundation",
    name: "Squat Foundation",
    category: "foundations",
    difficulty: 1,
    summary: "Build confident, deep bodyweight squats and your first single-leg work.",
    equipmentAny: [[]],
    prerequisites: [],
    steps: [
      { exercise: "assisted-squat", alternatives: ["chair-sit-to-stand"], title: "Assisted squats", target: reps(12), tip: "Use the support for balance only." },
      { exercise: "bodyweight-squat", title: "Bodyweight squats", target: reps(20), tip: "Heels down, knees over toes." },
      { exercise: "split-squat", alternatives: ["reverse-lunge"], title: "Split squats", target: reps(10), tip: "Per leg, back knee just above the floor." },
    ],
    supporting: ["glute-bridge", "calf-raise", "deep-squat-hold"],
    commonErrors: ["Knees caving inward", "Heels lifting"],
    rest: "Legs recover well — 2–3 sessions per week is plenty.",
    safety: ["Reduce depth if your knees hurt."],
    typicalTimeline: "2–6 weeks.",
  },
  {
    slug: "plank-60",
    name: "60-Second Plank",
    category: "foundations",
    alsoIn: ["core"],
    difficulty: 1,
    summary: "Build the core stiffness that every calisthenics skill relies on.",
    equipmentAny: [[]],
    prerequisites: [],
    steps: [
      { exercise: "dead-bug", title: "Dead bugs", target: reps(10), tip: "Lower back stays in contact with the floor." },
      { exercise: "front-plank", title: "Plank 20 s", target: hold(20), tip: "Breathe — never hold your breath." },
      { exercise: "front-plank", title: "Plank 40 s", target: hold(40), tip: "Squeeze glutes to protect the lower back." },
      { exercise: "front-plank", title: "Plank 60 s", target: hold(60, 1), tip: "Quality over duration — stop when hips sag." },
    ],
    supporting: ["side-plank", "bird-dog", "hollow-body-hold"],
    commonErrors: ["Hips sagging", "Hips piked high", "Holding the breath"],
    rest: "Core work can be done 3–4 times per week at low volume.",
    safety: ["Stop if you feel lower-back pain."],
    typicalTimeline: "2–6 weeks.",
  },
  {
    slug: "first-pull-up",
    name: "Your First Pull-Up",
    category: "foundations",
    difficulty: 2,
    summary: "From dead hangs to a strict pull-up — the most requested calisthenics milestone.",
    equipmentAny: [["pullup_bar"]],
    prerequisites: [],
    steps: [
      { exercise: "dead-hang", title: "Dead hang 30 s", target: hold(30), tip: "Builds grip and shoulder tolerance." },
      { exercise: "scapular-pull-up", title: "Scapular pull-ups", target: reps(10), tip: "Arms stay straight." },
      { exercise: "negative-pull-up", alternatives: ["band-assisted-pull-up"], title: "Negatives or band-assisted", target: reps(5), tip: "5 s negatives or full band reps." },
      { exercise: "pull-up", alternatives: ["chin-up"], title: "Strict pull-up", target: reps(1, 3), tip: "One clean rep counts — then build to sets of 3." },
    ],
    supporting: ["inverted-row", "band-row", "hollow-body-hold", "active-hang-hollow"],
    commonErrors: ["Kipping", "Half reps", "Too many negatives too often (very fatiguing)"],
    rest: "Pulling 2–3 times per week. Leave 48 hours between hard pulling sessions.",
    safety: ["Check the bar is secure before every session.", "Stop if you feel elbow pain."],
    typicalTimeline: "Commonly 1–6 months depending on starting strength and bodyweight.",
  },
  // ── B. Upper body ───────────────────────────────────────────────────
  {
    slug: "push-up-mastery",
    name: "Push-Up Mastery",
    category: "upper",
    difficulty: 3,
    summary: "From sets of push-ups to archer push-ups — chest, shoulders and triceps.",
    equipmentAny: [[]],
    prerequisites: [{ label: "5 strict push-ups", exercise: "push-up", metric: "reps", value: 5 }],
    steps: [
      { exercise: "push-up", title: "20 push-ups", target: reps(20, 1), tip: "Unbroken, full range." },
      { exercise: "diamond-push-up", alternatives: ["decline-push-up"], title: "Diamond or decline push-ups", target: reps(12), tip: "Elbows tucked." },
      { exercise: "archer-push-up", title: "Archer push-ups", target: reps(6), tip: "Per side, hips square." },
      { exercise: "pseudo-planche-push-up", title: "Pseudo planche push-ups", target: reps(6), tip: "Keep the lean throughout." },
    ],
    supporting: ["scapular-push-up", "front-plank", "planche-lean"],
    commonErrors: ["Rushing the descent", "Losing body line on hard variations"],
    rest: "2–3 pushing sessions per week.",
    safety: ["Warm up wrists before pseudo planche work."],
    typicalTimeline: "3–9 months.",
  },
  {
    slug: "pull-up-strength",
    name: "Pull-Up Strength",
    category: "upper",
    difficulty: 3,
    summary: "Build from one pull-up to sets of ten and toward one-arm strength — the core of the V-taper.",
    equipmentAny: [["pullup_bar"]],
    prerequisites: [{ label: "1 strict pull-up", exercise: "pull-up", metric: "reps", value: 1 }],
    steps: [
      { exercise: "pull-up", alternatives: ["chin-up"], title: "5 pull-ups", target: reps(5), tip: "Full hang to chin over bar." },
      { exercise: "pull-up", title: "10 pull-ups", target: reps(10, 1), tip: "Add one rep per week when possible." },
      { exercise: "high-pull-up", title: "High pull-ups", target: reps(5), tip: "Bar to lower chest." },
      { exercise: "archer-pull-up", title: "Archer pull-ups", target: reps(3), tip: "Per side." },
    ],
    supporting: ["inverted-row", "scapular-pull-up", "face-pull", "hanging-knee-raise"],
    commonErrors: ["Kipping", "Not reaching full extension"],
    rest: "2–3 pulling sessions per week.",
    safety: ["Elbow tendons adapt slowly — increase volume gradually."],
    typicalTimeline: "3–12 months.",
  },
  {
    slug: "dip-strength",
    name: "Parallel Bar Dips",
    category: "upper",
    difficulty: 3,
    summary: "Safely build up to sets of controlled dips.",
    equipmentAny: [["parallel_bars"]],
    prerequisites: [{ label: "10 push-ups", exercise: "push-up", metric: "reps", value: 10 }],
    steps: [
      { exercise: "support-hold", title: "Support hold 30 s", target: hold(30), tip: "Shoulders down, elbows locked." },
      { exercise: "dip-negative", title: "Dip negatives", target: reps(5), tip: "3–5 s down to a comfortable depth." },
      { exercise: "dip", title: "5 dips", target: reps(5), tip: "Controlled depth." },
      { exercise: "dip", title: "12 dips", target: reps(12, 1), tip: "Prerequisite for muscle-up work." },
    ],
    supporting: ["push-up", "scapular-push-up", "doorway-chest-stretch"],
    commonErrors: ["Excessive depth", "Shrugging"],
    rest: "2 sessions per week.",
    safety: ["Dips stress the front of the shoulder; stop at a depth that feels comfortable."],
    typicalTimeline: "1–4 months.",
  },
  {
    slug: "overhead-press-path",
    name: "Pike to Handstand Push-Up",
    category: "upper",
    difficulty: 4,
    summary: "Bodyweight overhead pressing for broad, strong shoulders.",
    equipmentAny: [[]],
    prerequisites: [{ label: "10 push-ups", exercise: "push-up", metric: "reps", value: 10 }],
    steps: [
      { exercise: "pike-push-up", alternatives: ["incline-pike-push-up"], title: "Pike push-ups", target: reps(10), tip: "Head forms a triangle with hands." },
      { exercise: "elevated-pike-push-up", title: "Elevated pike push-ups", target: reps(8), tip: "Hips stacked over shoulders." },
      { exercise: "wall-handstand-push-up-negative", title: "Wall HSPU negatives", target: reps(3), tip: "Slow and controlled with a mat under your head." },
    ],
    supporting: ["wall-handstand-hold", "dumbbell-lateral-raise", "face-pull", "wall-slide"],
    commonErrors: ["Elbows flaring", "Head landing between the hands"],
    rest: "2 sessions per week.",
    safety: ["Avoid inverted work with uncontrolled high blood pressure, glaucoma or neck problems unless cleared by a clinician."],
    typicalTimeline: "3–12 months.",
  },
  {
    slug: "row-strength",
    name: "Horizontal Pulling",
    category: "upper",
    difficulty: 2,
    summary: "Build a thick, strong upper back and better posture.",
    equipmentAny: [["low_bar"], ["rings"], ["sturdy_table"], ["resistance_band"]],
    prerequisites: [],
    steps: [
      { exercise: "band-row", alternatives: ["table-row"], title: "Band or table rows", target: reps(15), tip: "Squeeze the shoulder blades." },
      { exercise: "inverted-row", alternatives: ["ring-row"], title: "Inverted or ring rows", target: reps(12), tip: "Chest to the bar." },
      { exercise: "archer-row", title: "Archer rows", target: reps(6), tip: "Per side." },
    ],
    supporting: ["band-pull-apart", "prone-ytw", "face-pull"],
    commonErrors: ["Sagging hips", "Shrugging"],
    rest: "2–3 sessions per week.",
    safety: ["Only use a table that cannot tip or slide."],
    typicalTimeline: "1–4 months.",
  },
  // ── C. Core ─────────────────────────────────────────────────────────
  {
    slug: "hollow-body",
    name: "Hollow Body",
    category: "core",
    difficulty: 2,
    summary: "The gymnastics shape behind levers, handstands and clean pull-ups.",
    equipmentAny: [[]],
    prerequisites: [],
    steps: [
      { exercise: "dead-bug", title: "Dead bugs", target: reps(12), tip: "Slow and controlled." },
      { exercise: "hollow-body-hold", title: "Hollow hold 20 s", target: hold(20), tip: "Knees bent is fine at first." },
      { exercise: "hollow-body-hold", title: "Hollow hold 45 s", target: hold(45), tip: "Legs straight, arms overhead." },
    ],
    supporting: ["front-plank", "reverse-crunch"],
    commonErrors: ["Lower back lifting"],
    rest: "3–4 short sessions per week.",
    safety: ["Stop if you feel lower-back pain."],
    typicalTimeline: "3–8 weeks.",
  },
  {
    slug: "hanging-core",
    name: "Hanging Leg Raises",
    category: "core",
    difficulty: 3,
    summary: "Strong abs and grip — from knee raises to toes-to-bar.",
    equipmentAny: [["pullup_bar"]],
    prerequisites: [{ label: "30 s dead hang", exercise: "dead-hang", metric: "seconds", value: 30 }],
    steps: [
      { exercise: "hanging-knee-raise", title: "Hanging knee raises", target: reps(12), tip: "Curl the pelvis up." },
      { exercise: "hanging-leg-raise", title: "Hanging leg raises", target: reps(8), tip: "No swinging." },
      { exercise: "toes-to-bar", title: "Strict toes-to-bar", target: reps(5), tip: "Press the bar down." },
    ],
    supporting: ["reverse-crunch", "lying-leg-raise", "hollow-body-hold"],
    commonErrors: ["Swinging", "Bending knees on straight-leg variations"],
    rest: "2–3 sessions per week.",
    safety: ["Avoid with active lower-back pain."],
    typicalTimeline: "1–6 months.",
  },
  {
    slug: "l-sit",
    name: "L-Sit",
    category: "core",
    alsoIn: ["advanced"],
    difficulty: 4,
    summary: "Compression, triceps and shoulder strength in one hold.",
    equipmentAny: [[]],
    prerequisites: [
      { label: "30 s hollow hold", exercise: "hollow-body-hold", metric: "seconds", value: 30 },
      { label: "10 push-ups", exercise: "push-up", metric: "reps", value: 10 },
    ],
    steps: [
      { exercise: "seated-leg-lift", title: "Seated leg lifts", target: reps(12), tip: "Knees locked." },
      { exercise: "tuck-l-sit", title: "Tuck L-sit 15 s", target: hold(15), tip: "Shoulders pushed down." },
      { exercise: "one-leg-l-sit", title: "One-leg L-sit 10 s", target: hold(10), tip: "Per leg." },
      { exercise: "l-sit", title: "L-sit 10 s", target: hold(10), tip: "Legs at hip height." },
    ],
    supporting: ["hamstring-stretch", "support-hold", "hanging-leg-raise"],
    commonErrors: ["Bent elbows", "Shrugged shoulders"],
    rest: "3 short sessions per week.",
    safety: ["Use parallettes or blocks if your wrists hurt on the floor."],
    typicalTimeline: "2–8 months.",
  },
  // ── D. Legs & athleticism ───────────────────────────────────────────
  {
    slug: "pistol-squat",
    name: "Pistol Squat",
    category: "legs",
    difficulty: 4,
    summary: "Single-leg strength, mobility and balance.",
    equipmentAny: [["sturdy_chair"], []],
    prerequisites: [{ label: "20 bodyweight squats", exercise: "bodyweight-squat", metric: "reps", value: 20 }],
    steps: [
      { exercise: "split-squat", title: "Split squats", target: reps(12), tip: "Per leg." },
      { exercise: "bulgarian-split-squat", alternatives: ["reverse-lunge"], title: "Bulgarian split squats", target: reps(10), tip: "Per leg." },
      { exercise: "assisted-pistol-squat", title: "Assisted pistols", target: reps(6), tip: "Use the support as little as possible." },
      { exercise: "pistol-squat", title: "Pistol squat", target: reps(3), tip: "Per leg." },
    ],
    supporting: ["knee-to-wall", "deep-squat-hold", "single-leg-balance"],
    commonErrors: ["Heel lifting", "Knee collapsing inward"],
    rest: "2 sessions per week.",
    safety: ["Stop if you feel knee pain."],
    typicalTimeline: "2–9 months.",
  },
  {
    slug: "hamstring-strength",
    name: "Hamstring Strength",
    category: "legs",
    difficulty: 3,
    summary: "Glute bridges to Nordic negatives — a strong posterior chain for speed and resilience.",
    equipmentAny: [[]],
    prerequisites: [],
    steps: [
      { exercise: "glute-bridge", title: "Glute bridges", target: reps(20), tip: "Squeeze at the top." },
      { exercise: "single-leg-glute-bridge", title: "Single-leg bridges", target: reps(12), tip: "Per leg." },
      { exercise: "towel-hamstring-curl", title: "Sliding hamstring curls", target: reps(10), tip: "Hips up throughout." },
      { exercise: "nordic-curl-negative", title: "Nordic negatives", target: reps(4), tip: "Start with one set." },
    ],
    supporting: ["good-morning", "single-leg-rdl", "hamstring-stretch"],
    commonErrors: ["Hips dropping"],
    rest: "Nordics cause strong soreness — 1–2 sessions per week.",
    safety: ["Progress Nordic volume very gradually."],
    typicalTimeline: "1–4 months.",
  },
  {
    slug: "jump-landing",
    name: "Jump & Land",
    category: "legs",
    difficulty: 2,
    summary: "Learn safe landing mechanics and build explosive power.",
    equipmentAny: [[]],
    prerequisites: [{ label: "15 bodyweight squats", exercise: "bodyweight-squat", metric: "reps", value: 15 }],
    steps: [
      { exercise: "landing-stick", title: "Landing sticks", target: reps(8), tip: "Silent landings." },
      { exercise: "squat-jump", title: "Squat jumps", target: reps(8), tip: "Land soft, reset each rep." },
    ],
    supporting: ["calf-raise", "single-leg-balance", "bulgarian-split-squat"],
    commonErrors: ["Knees caving on landing", "Stiff legs"],
    rest: "Keep jumping volume low (under ~40 contacts per session at first).",
    safety: ["Skip if you have been told to avoid high-impact activity."],
    typicalTimeline: "2–6 weeks.",
  },
  // ── E. Advanced ─────────────────────────────────────────────────────
  {
    slug: "handstand",
    name: "Handstand",
    category: "advanced",
    difficulty: 4,
    summary: "From wall walks to a freestanding balance.",
    equipmentAny: [[]],
    prerequisites: [
      { label: "30 s plank", exercise: "front-plank", metric: "seconds", value: 30 },
      { label: "10 pike push-ups", exercise: "pike-push-up", metric: "reps", value: 10 },
    ],
    steps: [
      { exercise: "wall-plank-walk", title: "Wall walks", target: reps(3), tip: "Only as high as you control." },
      { exercise: "wall-handstand-hold", title: "Chest-to-wall 30 s", target: hold(30), tip: "Push tall." },
      { exercise: "wall-handstand-hold", title: "Chest-to-wall 60 s", target: hold(60, 1), tip: "Lines stacked." },
      { exercise: "freestanding-handstand", title: "Freestanding 10 s", target: hold(10, 1), tip: "Fingertips control balance." },
    ],
    supporting: ["wrist-prep", "pike-push-up", "hollow-body-hold", "wall-slide"],
    commonErrors: ["Banana back", "Kicking up too hard", "No bail-out practice"],
    rest: "Short frequent practice (10–15 minutes, 3–5×/week) works well.",
    safety: [
      "Practise bailing out (cartwheel/step-down) before freestanding attempts.",
      "Avoid inversions with uncontrolled high blood pressure, glaucoma or neck problems unless cleared by a clinician.",
    ],
    typicalTimeline: "Commonly 6–24 months for a consistent freestanding hold.",
  },
  {
    slug: "muscle-up",
    name: "Muscle-Up",
    category: "advanced",
    difficulty: 5,
    summary: "Pull over the bar and press out. Requires strong pulling, dipping and a clean transition.",
    equipmentAny: [["pullup_bar", "low_bar"], ["pullup_bar"]],
    prerequisites: [
      { label: "10 strict pull-ups", exercise: "pull-up", metric: "reps", value: 10 },
      { label: "10 dips", exercise: "dip", metric: "reps", value: 10 },
    ],
    steps: [
      { exercise: "high-pull-up", title: "High pull-ups", target: reps(5), tip: "Bar to lower chest." },
      { exercise: "straight-bar-dip", title: "Straight bar dips", target: reps(8), tip: "Lean over the bar." },
      { exercise: "muscle-up-transition", title: "Low-bar transitions", target: reps(5), tip: "Elbows stay narrow." },
      { exercise: "muscle-up", title: "Muscle-up", target: reps(1, 3), tip: "One clean rep counts." },
    ],
    supporting: ["pull-up", "dip", "hollow-body-hold", "active-hang-hollow"],
    commonErrors: ["Chicken wing (one arm over first)", "Pulling only to chin height"],
    rest: "2 skill sessions per week; avoid failure on transition work.",
    safety: ["Elbow and shoulder load is high — stop at any sharp pain."],
    typicalTimeline: "Commonly 3–12 months after meeting prerequisites.",
  },
  {
    slug: "front-lever",
    name: "Front Lever",
    category: "advanced",
    difficulty: 5,
    summary: "Horizontal hang with straight arms — elite lat and core strength.",
    equipmentAny: [["pullup_bar"]],
    prerequisites: [
      { label: "8 pull-ups", exercise: "pull-up", metric: "reps", value: 8 },
      { label: "30 s hollow hold", exercise: "hollow-body-hold", metric: "seconds", value: 30 },
    ],
    steps: [
      { exercise: "active-hang-hollow", title: "Hollow hang 30 s", target: hold(30), tip: "Shoulders depressed." },
      { exercise: "tuck-front-lever", title: "Tuck front lever 10 s", target: hold(10), tip: "Back horizontal." },
      { exercise: "advanced-tuck-front-lever", title: "Advanced tuck 8 s", target: hold(8), tip: "Flat back." },
    ],
    supporting: ["pull-up", "inverted-row", "hanging-leg-raise"],
    commonErrors: ["Bent arms", "Hips dropping"],
    rest: "2–3 sessions per week, sets of short holds with full rest.",
    safety: ["Straight-arm work stresses elbows; build gradually."],
    typicalTimeline: "Tuck often within months; full front lever can take years.",
  },
  {
    slug: "back-lever",
    name: "Back Lever",
    category: "advanced",
    difficulty: 5,
    summary: "Face-down horizontal hold behind the hands. High shoulder-extension demand.",
    equipmentAny: [["rings"]],
    prerequisites: [
      { label: "8 pull-ups", exercise: "pull-up", metric: "reps", value: 8 },
      { label: "10 dips", exercise: "dip", metric: "reps", value: 10 },
    ],
    steps: [
      { exercise: "skin-the-cat", title: "Partial skin the cat", target: reps(5), tip: "Increase range very gradually." },
      { exercise: "tuck-back-lever", title: "Tuck back lever 10 s", target: hold(10), tip: "Arms straight." },
    ],
    supporting: ["shoulder-dislocates", "doorway-chest-stretch", "chin-up"],
    commonErrors: ["Dropping into the bottom of skin-the-cat", "Bent arms"],
    rest: "2 sessions per week.",
    safety: [
      "High stress on the biceps tendon and front shoulder — never force range.",
      "Not recommended with any current shoulder issue.",
    ],
    typicalTimeline: "Tuck often within months; full back lever commonly 1+ years.",
  },
  {
    slug: "planche",
    name: "Planche (Tuck)",
    category: "advanced",
    difficulty: 5,
    summary: "Straight-arm support with the body horizontal. One of the hardest bodyweight skills.",
    equipmentAny: [[]],
    prerequisites: [
      { label: "20 push-ups", exercise: "push-up", metric: "reps", value: 20 },
      { label: "10 dips or 10 diamond push-ups", exercise: "diamond-push-up", metric: "reps", value: 10 },
    ],
    steps: [
      { exercise: "planche-lean", title: "Planche lean 30 s", target: hold(30), tip: "Lean gradually." },
      { exercise: "frog-stand", title: "Frog stand 30 s", target: hold(30), tip: "Look slightly ahead." },
      { exercise: "pseudo-planche-push-up", title: "Pseudo planche push-ups", target: reps(8), tip: "Keep the lean." },
      { exercise: "tuck-planche", title: "Tuck planche 8 s", target: hold(8), tip: "Arms locked." },
    ],
    supporting: ["wrist-prep", "scapular-push-up", "hollow-body-hold"],
    commonErrors: ["Bent arms", "Not protracting the shoulders"],
    rest: "2–3 sessions per week; joints need time to adapt.",
    safety: ["Wrist and elbow tendons adapt slowly — increase lean and volume gradually over months."],
    typicalTimeline: "Tuck planche commonly 6–18 months; full planche is multi-year for most.",
  },
];

export const SKILL_BY_SLUG = new Map(SKILLS.map((s) => [s.slug, s]));
