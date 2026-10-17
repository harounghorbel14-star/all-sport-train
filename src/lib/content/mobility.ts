export interface MobilityRoutine {
  slug: string;
  name: string;
  focus: string;
  minutes: number;
  description: string;
  items: { exercise: string; seconds: number; note?: string }[];
  modifications: string[];
}

export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  {
    slug: "upper-back-reset",
    name: "Upper-Back Reset",
    focus: "Upper-back mobility",
    minutes: 6,
    description: "Counter long hours of sitting with gentle rotation and extension.",
    items: [
      { exercise: "cat-cow", seconds: 60 },
      { exercise: "thread-the-needle", seconds: 90, note: "45 s per side" },
      { exercise: "open-book", seconds: 90, note: "45 s per side" },
      { exercise: "childs-pose", seconds: 60 },
      { exercise: "chin-tuck", seconds: 60 },
    ],
    modifications: ["Do open books seated in a chair if lying down is uncomfortable."],
  },
  {
    slug: "thoracic-extension",
    name: "Thoracic Extension",
    focus: "Thoracic extension",
    minutes: 5,
    description: "Improve upper-back extension for overhead work and handstands.",
    items: [
      { exercise: "thoracic-extension", seconds: 90 },
      { exercise: "wall-slide", seconds: 60 },
      { exercise: "cat-cow", seconds: 60 },
      { exercise: "doorway-chest-stretch", seconds: 60 },
    ],
    modifications: ["Use a rolled towel instead of a chair backrest."],
  },
  {
    slug: "shoulder-health",
    name: "Shoulder Health",
    focus: "Shoulder mobility & scapular control",
    minutes: 8,
    description: "Mobility and light activation before pushing and pulling.",
    items: [
      { exercise: "arm-circles", seconds: 60 },
      { exercise: "wall-slide", seconds: 60 },
      { exercise: "prone-ytw", seconds: 120 },
      { exercise: "scapular-push-up", seconds: 60 },
      { exercise: "doorway-chest-stretch", seconds: 60 },
      { exercise: "thread-the-needle", seconds: 90 },
    ],
    modifications: ["Use a smaller range for wall slides if you feel pinching.", "Band pass-throughs can replace arm circles."],
  },
  {
    slug: "hip-opener",
    name: "Hip Opener",
    focus: "Hip mobility",
    minutes: 8,
    description: "Hip flexors, rotation and deep squat comfort.",
    items: [
      { exercise: "leg-swings", seconds: 60 },
      { exercise: "hip-flexor-stretch", seconds: 90, note: "45 s per side" },
      { exercise: "ninety-ninety", seconds: 90 },
      { exercise: "worlds-greatest-stretch", seconds: 90 },
      { exercise: "deep-squat-hold", seconds: 60 },
    ],
    modifications: ["Hold a door frame in the deep squat.", "Sit on a cushion for 90/90 if hips are tight."],
  },
  {
    slug: "ankle-prep",
    name: "Ankle Prep",
    focus: "Ankle mobility",
    minutes: 5,
    description: "Better squats, pistols and landings start at the ankle.",
    items: [
      { exercise: "knee-to-wall", seconds: 90, note: "per side" },
      { exercise: "calf-raise", seconds: 60 },
      { exercise: "single-leg-balance", seconds: 60 },
      { exercise: "deep-squat-hold", seconds: 60 },
    ],
    modifications: ["Hold a wall during balance work."],
  },
  {
    slug: "core-stability",
    name: "Core Stability",
    focus: "Core stability",
    minutes: 6,
    description: "Low-intensity core control that is friendly to sensitive backs.",
    items: [
      { exercise: "dead-bug", seconds: 60 },
      { exercise: "bird-dog", seconds: 90 },
      { exercise: "side-plank", seconds: 60, note: "30 s per side, knees down if needed" },
      { exercise: "glute-bridge", seconds: 60 },
      { exercise: "childs-pose", seconds: 60 },
    ],
    modifications: ["Do side planks from the knees."],
  },
  {
    slug: "desk-break",
    name: "Desk Movement Break",
    focus: "General movement break",
    minutes: 3,
    description: "A quick break you can do in work clothes.",
    items: [
      { exercise: "chin-tuck", seconds: 30 },
      { exercise: "arm-circles", seconds: 30 },
      { exercise: "thoracic-extension", seconds: 45 },
      { exercise: "bodyweight-squat", seconds: 45 },
      { exercise: "calf-raise", seconds: 30 },
    ],
    modifications: ["Use chair sit-to-stands instead of squats."],
  },
  {
    slug: "recovery-flow",
    name: "Recovery Flow",
    focus: "Rest-day recovery",
    minutes: 10,
    description: "Easy full-body flow for rest days and sore muscles.",
    items: [
      { exercise: "cat-cow", seconds: 60 },
      { exercise: "worlds-greatest-stretch", seconds: 120 },
      { exercise: "hamstring-stretch", seconds: 60 },
      { exercise: "hip-flexor-stretch", seconds: 90 },
      { exercise: "thread-the-needle", seconds: 90 },
      { exercise: "childs-pose", seconds: 90 },
    ],
    modifications: ["Move slowly and stay well below any discomfort."],
  },
];

export const MOBILITY_BY_SLUG = new Map(MOBILITY_ROUTINES.map((r) => [r.slug, r]));

/** Educational posture self-check — not a diagnosis. */
export const POSTURE_QUESTIONS = [
  { key: "sitting", q: "Do you sit for more than 6 hours on most days?", tip: "Add a movement break every 45–60 minutes.", routine: "desk-break" },
  { key: "headForward", q: "In a side photo, does your ear sit well in front of your shoulder?", tip: "Chin tucks and upper-back work can help with awareness and comfort.", routine: "upper-back-reset" },
  { key: "roundShoulders", q: "Do your palms face backward when your arms hang relaxed?", tip: "Chest stretches plus rows and face pulls balance pushing work.", routine: "shoulder-health" },
  { key: "overhead", q: "Is it hard to raise both arms overhead against a wall without arching your back?", tip: "Thoracic extension and wall slides improve overhead range.", routine: "thoracic-extension" },
  { key: "squat", q: "Do your heels lift when you squat deeply?", tip: "Ankle mobility work often helps.", routine: "ankle-prep" },
  { key: "hips", q: "Do the fronts of your hips feel tight after sitting?", tip: "Hip flexor stretches and glute bridges are a good start.", routine: "hip-opener" },
] as const;
