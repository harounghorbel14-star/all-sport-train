import type { ExerciseSeed, MovementPattern } from "../content/types";
import type { Block, EngineOptions, EngineProfile, Experience, GeneratedWorkout } from "./types";

export type EngineExercise = Required<
  Pick<
    ExerciseSeed,
    | "slug"
    | "name"
    | "category"
    | "movementPattern"
    | "primaryMuscles"
    | "secondaryMuscles"
    | "equipment"
    | "difficulty"
    | "locations"
    | "isTimed"
    | "defaultSets"
    | "repMin"
    | "repMax"
    | "restSeconds"
    | "met"
    | "easier"
    | "harder"
    | "contraindications"
  >
> & { progressionGroup?: string | null; progressionLevel?: number | null; holdSeconds?: number | null };

/** Normalise catalog entries (optional fields → defaults). */
export function toEngineExercise(e: ExerciseSeed): EngineExercise {
  return {
    slug: e.slug,
    name: e.name,
    category: e.category,
    movementPattern: e.movementPattern,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles ?? [],
    equipment: e.equipment ?? [],
    difficulty: e.difficulty,
    locations: e.locations ?? ["home", "gym", "outdoor"],
    isTimed: e.isTimed ?? false,
    defaultSets: e.defaultSets ?? 3,
    repMin: e.repMin ?? 8,
    repMax: e.repMax ?? 12,
    holdSeconds: e.holdSeconds ?? null,
    restSeconds: e.restSeconds ?? 90,
    met: e.met ?? 4,
    easier: e.easier ?? [],
    harder: e.harder ?? [],
    contraindications: e.contraindications ?? [],
    progressionGroup: e.progressionGroup ?? null,
    progressionLevel: e.progressionLevel ?? null,
  };
}

// ── Deterministic randomness so the same day produces the same plan ──────
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_DIFFICULTY: Record<Experience, number> = { zero: 2, beginner: 3, intermediate: 4, advanced: 5 };
const START_LEVEL: Record<Experience, number> = { zero: 1, beginner: 2, intermediate: 4, advanced: 5 };
const BASE_SETS: Record<Experience, number> = { zero: 2, beginner: 2, intermediate: 3, advanced: 4 };

type Slot = { pattern: MovementPattern; priority: number; muscleHint?: string; label?: string };

const S = (pattern: MovementPattern, priority: number, muscleHint?: string): Slot => ({ pattern, priority, muscleHint });

/** Weekly split templates. Lower body and core appear in every balanced plan. */
function dayTemplates(profile: EngineProfile): { name: string; focus: string; slots: Slot[] }[] {
  const days = profile.daysPerWeek;
  const fullA = { name: "Full Body A", focus: "full_body", slots: [S("horizontal_push", 1), S("vertical_pull", 1), S("squat", 1), S("hinge", 2), S("core_anti_extension", 2), S("scapular", 4)] };
  const fullB = { name: "Full Body B", focus: "full_body", slots: [S("horizontal_pull", 1), S("vertical_push", 1), S("lunge", 1), S("hinge", 2), S("core_flexion", 2), S("calf", 4)] };
  const fullC = { name: "Full Body C", focus: "full_body", slots: [S("vertical_pull", 1), S("horizontal_push", 1), S("squat", 1), S("dip", 3), S("core_lateral", 2), S("balance", 4)] };
  const upper = { name: "Upper Body", focus: "upper", slots: [S("vertical_pull", 1), S("horizontal_push", 1), S("horizontal_pull", 1), S("vertical_push", 2), S("scapular", 3), S("core_anti_extension", 3)] };
  const lower = { name: "Lower Body & Core", focus: "lower", slots: [S("squat", 1), S("hinge", 1), S("lunge", 2), S("calf", 3), S("core_flexion", 2), S("core_lateral", 3)] };
  const push = { name: "Push", focus: "push", slots: [S("horizontal_push", 1), S("vertical_push", 1), S("dip", 2), S("horizontal_push", 3), S("core_anti_extension", 3)] };
  const pull = { name: "Pull", focus: "pull", slots: [S("vertical_pull", 1), S("horizontal_pull", 1), S("vertical_pull", 2), S("scapular", 3), S("core_flexion", 3)] };
  const athletic = { name: "Athletic Conditioning", focus: "athletic", slots: [S("plyometric", 1), S("lunge", 1), S("horizontal_push", 2), S("horizontal_pull", 2), S("conditioning", 2), S("core_lateral", 3)] };

  const e = profile.emphasis;
  if (e === "v_taper") {
    const vUpper = { name: "V-Taper Upper", focus: "v_taper", slots: [S("vertical_pull", 1), S("vertical_push", 1), S("horizontal_pull", 1), S("shoulder_isolation", 2, "side_delts"), S("horizontal_push", 2, "upper_chest"), S("scapular", 3), S("core_flexion", 3)] };
    const vUpper2 = { name: "V-Taper Upper B", focus: "v_taper", slots: [S("vertical_pull", 1), S("horizontal_push", 1, "upper_chest"), S("horizontal_pull", 2), S("dip", 2), S("shoulder_isolation", 2, "side_delts"), S("core_lateral", 3)] };
    if (days <= 2) return [{ ...fullA, slots: [...fullA.slots.slice(0, 5), S("shoulder_isolation", 3)] }, { ...fullB, slots: [S("vertical_pull", 1), ...fullB.slots] }];
    if (days === 3) return [vUpper, lower, vUpper2];
    return [vUpper, lower, vUpper2, { ...lower, name: "Lower Body & Athleticism", slots: [S("lunge", 1), S("hinge", 1), S("plyometric", 2), S("calf", 3), S("core_anti_extension", 2)] }, upper].slice(0, days);
  }
  if (e === "chest_arms") {
    const ca = { name: "Chest & Arms", focus: "chest_arms", slots: [S("horizontal_push", 1), S("dip", 1), S("horizontal_push", 2, "upper_chest"), S("arms", 2, "biceps"), S("vertical_pull", 2), S("core_anti_extension", 3)] };
    return rotate(days, [ca, lower, upper, ca, fullB]);
  }
  if (e === "abs_core") {
    const core = { name: "Abs & Core", focus: "core", slots: [S("core_anti_extension", 1), S("core_flexion", 1), S("core_lateral", 1), S("hinge", 2), S("horizontal_push", 3), S("vertical_pull", 3)] };
    return rotate(days, [fullA, core, fullB, core, fullC]);
  }
  if (e === "upper_body") return rotate(days, [upper, lower, push, pull, upper]);
  if (e === "lower_body") return rotate(days, [lower, upper, { ...lower, name: "Lower Body B", slots: [S("lunge", 1), S("hinge", 1), S("squat", 2), S("plyometric", 3), S("calf", 3), S("core_lateral", 3)] }, fullA, lower]);
  if (e === "athletic_physique") return rotate(days, [fullA, athletic, fullB, upper, lower]);
  if (e === "full_body") return rotate(days, [fullA, fullB, fullC]);
  // balanced calisthenics
  if (days <= 3) return rotate(days, [fullA, fullB, fullC]);
  if (days === 4) return [upper, lower, push, { ...lower, name: "Legs & Core B", slots: [S("lunge", 1), S("hinge", 1), S("squat", 2), S("core_anti_extension", 2), S("calf", 3)] }];
  return rotate(days, [push, pull, lower, upper, athletic, fullA]);
}

function rotate<T>(days: number, list: T[]): T[] {
  const n = Math.max(1, Math.min(days, 7));
  return Array.from({ length: n }, (_, i) => list[i % list.length]);
}

// ── Filtering ──────────────────────────────────────────────────────────
export function isAvailable(ex: EngineExercise, profile: EngineProfile): boolean {
  const owned = new Set(profile.equipment);
  if (!ex.equipment.every((eq) => owned.has(eq))) return false;
  if (profile.location !== "mixed" && !ex.locations.includes(profile.location as "home")) {
    // Gym-only exercises at home are excluded; bodyweight exercises are allowed everywhere.
    if (ex.equipment.length > 0) return false;
  }
  if (ex.contraindications.some((c) => profile.limitations.includes(c))) return false;
  return true;
}

function maxDifficulty(profile: EngineProfile, phase?: number) {
  if (profile.startFromZero || profile.goals.includes("return_to_exercise")) return Math.min(2, MAX_DIFFICULTY[profile.experience]);
  const base = MAX_DIFFICULTY[profile.experience];
  return phase === 1 ? Math.min(base, 3) : base;
}

/**
 * Pick the user's working level in a progression group. History drives
 * progression: we only step up after repeated top-of-range sessions with
 * manageable effort (RPE ≤ 8), and step back after repeated misses.
 */
export function workingLevel(
  group: EngineExercise[],
  profile: EngineProfile,
  history: Record<string, ExerciseHistoryLike>,
  allowProgress: boolean,
): { level: number; progression: Block["progression"] } {
  const levels = group.filter((e) => e.progressionLevel != null);
  if (!levels.length) return { level: 1, progression: "new" };
  const performed = levels.filter((e) => (history[e.slug]?.sessions ?? 0) > 0);
  if (!performed.length) {
    const start = profile.startFromZero ? 1 : START_LEVEL[profile.experience];
    return { level: start, progression: "new" };
  }
  // Most recently trained / highest level performed
  const current = performed.reduce((a, b) => ((b.progressionLevel ?? 0) > (a.progressionLevel ?? 0) ? b : a));
  const h = history[current.slug];
  const lvl = current.progressionLevel ?? 1;
  if (allowProgress && h.recentTopHits >= 2 && (h.lastRpe ?? 7) <= 8) return { level: lvl + 1, progression: "progress" };
  if (h.recentMisses >= 2 || (h.lastRpe ?? 0) >= 10) return { level: Math.max(1, lvl - 1), progression: "regress" };
  return { level: lvl, progression: "hold" };
}

type ExerciseHistoryLike = { sessions: number; recentTopHits: number; recentMisses: number; lastRpe?: number | null; lastReps?: number | null; lastSeconds?: number | null };

function chooseForSlot(
  slot: Slot,
  pool: EngineExercise[],
  profile: EngineProfile,
  opts: EngineOptions,
  used: Set<string>,
  rand: () => number,
): { ex: EngineExercise; progression: Block["progression"] } | null {
  const maxDiff = maxDifficulty(profile, opts.phase);
  const avoid = new Set(opts.avoidMuscles ?? []);
  let candidates = pool.filter(
    (e) =>
      e.movementPattern === slot.pattern &&
      e.category !== "mobility" &&
      e.category !== "skill" &&
      !used.has(e.slug) &&
      e.difficulty <= maxDiff &&
      !e.primaryMuscles.some((m) => avoid.has(m)),
  );
  if (!candidates.length) return null;

  // Preferences: calisthenics/bodyweight users favour progressions; weights users favour loaded options.
  const prefersWeights = profile.exercisePrefs.includes("weights") || profile.location === "gym";
  const prefersBodyweight = profile.exercisePrefs.includes("bodyweight") || profile.goals.includes("calisthenics") || profile.emphasis === "balanced_calisthenics";

  if (slot.muscleHint) {
    const hinted = candidates.filter((e) => e.primaryMuscles.includes(slot.muscleHint as never));
    if (hinted.length) candidates = hinted;
  }

  // Group by progression ladder; choose a ladder, then the level.
  const ladders = new Map<string, EngineExercise[]>();
  const standalone: EngineExercise[] = [];
  for (const c of candidates) {
    if (c.progressionGroup) ladders.set(c.progressionGroup, [...(ladders.get(c.progressionGroup) ?? []), c]);
    else standalone.push(c);
  }

  const allowProgress = opts.readinessVolume >= 1 && !opts.deload;
  const options: { ex: EngineExercise; progression: Block["progression"]; score: number }[] = [];

  const ladderBase = 1.6 + (prefersBodyweight ? 0.6 : 0);
  for (const [, group] of ladders) {
    const fullGroup = pool.filter((e) => e.progressionGroup === group[0].progressionGroup && e.movementPattern === slot.pattern);
    const { level, progression } = workingLevel(fullGroup, profile, opts.history, allowProgress);
    // Closest available level at or below the working level (fallback: lowest available)
    const sorted = [...group].sort((a, b) => (a.progressionLevel ?? 0) - (b.progressionLevel ?? 0));
    const atOrBelow = sorted.filter((e) => (e.progressionLevel ?? 0) <= level);
    const bestLevel = atOrBelow.length ? atOrBelow[atOrBelow.length - 1].progressionLevel : sorted[0].progressionLevel;
    const sameLevel = sorted.filter((e) => e.progressionLevel === bestLevel);
    const pick = sameLevel[Math.floor(rand() * sameLevel.length)];
    const effective = (pick.progressionLevel ?? 0) < level && progression === "progress" ? "hold" : progression;
    // Prefer the ladder named after the slot, and penalise ladders whose available levels are far too easy.
    const primary = group[0].progressionGroup === slot.pattern ? 0.5 : 0;
    const tooEasy = Math.max(0, level - (pick.progressionLevel ?? level) - 1) * 0.8;
    options.push({ ex: pick, progression: effective, score: ladderBase + primary - tooEasy + rand() * 0.5 });
  }
  for (const s of standalone) {
    const loaded = s.equipment.some((eq) => ["dumbbells", "barbell", "kettlebell", "cable_machine"].includes(eq));
    const score = (loaded && prefersWeights ? 2.4 : loaded ? 0.9 : 1.0) + rand() * 0.5 - (s.difficulty > START_LEVEL[profile.experience] + 1 ? 1 : 0);
    options.push({ ex: s, progression: opts.history[s.slug]?.sessions ? "hold" : "new", score });
  }
  options.sort((a, b) => b.score - a.score);
  const chosen = options[0];
  return chosen ? { ex: chosen.ex, progression: chosen.progression } : null;
}

function resolveVariation(slugs: string[], byslug: Map<string, EngineExercise>, profile: EngineProfile): string | null {
  for (const s of slugs) {
    const e = byslug.get(s);
    if (e && isAvailable(e, profile)) return s;
  }
  return null;
}

function repTarget(ex: EngineExercise, profile: EngineProfile): { repMin: number | null; repMax: number | null; seconds: number | null; rest: number } {
  const goals = profile.goals;
  if (ex.isTimed) {
    let seconds = ex.holdSeconds ?? 30;
    if (profile.startFromZero || profile.experience === "zero") seconds = Math.max(10, Math.round(seconds * 0.6));
    if (profile.experience === "advanced") seconds = Math.round(seconds * 1.3);
    return { repMin: null, repMax: null, seconds, rest: ex.restSeconds };
  }
  let min = ex.repMin;
  let max = ex.repMax;
  let rest = ex.restSeconds;
  if (goals.includes("strength") && !goals.includes("endurance")) {
    min = Math.max(3, min - 2);
    max = Math.max(min + 2, Math.min(max, min + 4));
    rest = Math.round(rest * 1.3);
  } else if (goals.includes("endurance") || goals.includes("fat_loss")) {
    min = min + 2;
    max = max + 4;
    rest = Math.round(rest * 0.75);
  }
  if (profile.startFromZero || profile.experience === "zero") {
    max = Math.max(min, Math.min(max, min + 4));
    rest = Math.max(rest, 75);
  }
  return { repMin: min, repMax: max, seconds: null, rest: Math.min(240, Math.max(30, rest)) };
}

const WARMUP_GENERAL = ["arm-circles", "cat-cow", "leg-swings", "inchworm", "worlds-greatest-stretch"];
const COOLDOWN_BY_FOCUS: Record<string, string[]> = {
  upper: ["doorway-chest-stretch", "thread-the-needle", "childs-pose"],
  lower: ["hip-flexor-stretch", "hamstring-stretch", "knee-to-wall"],
  default: ["childs-pose", "hip-flexor-stretch", "doorway-chest-stretch"],
};

const PATTERN_FALLBACKS: Partial<Record<MovementPattern, MovementPattern[]>> = {
  vertical_pull: ["horizontal_pull", "scapular"],
  horizontal_pull: ["vertical_pull", "scapular"],
  vertical_push: ["horizontal_push", "scapular"],
  dip: ["horizontal_push", "arms"],
  shoulder_isolation: ["scapular", "vertical_push"],
  arms: ["horizontal_pull", "dip"],
  plyometric: ["lunge", "conditioning"],
  conditioning: ["core_flexion"],
  balance: ["calf"],
};

const mobilityBlock = (slug: string, seconds = 45): Block => ({ exercise: slug, sets: 1, repMin: null, repMax: null, seconds, restSeconds: 0 });

/** Estimated session minutes (work ≈ 3 s per rep or hold time, plus rest). */
export function estimateMinutes(w: Pick<GeneratedWorkout, "warmup" | "main" | "cooldown">): number {
  const blockSec = (b: Block) => {
    const work = b.seconds ?? Math.round(((b.repMin ?? 8) + (b.repMax ?? 12)) / 2) * 3;
    return b.sets * work + Math.max(0, b.sets - 1) * b.restSeconds + 30;
  };
  const total = [...w.warmup, ...w.main, ...w.cooldown].reduce((s, b) => s + blockSec(b), 0);
  return Math.max(5, Math.round(total / 60));
}

export function generateWorkout(exercises: EngineExercise[], profile: EngineProfile, opts: EngineOptions): GeneratedWorkout {
  const rand = rng(opts.seed ?? `${opts.date}:${opts.dayIndex}`);
  const byslug = new Map(exercises.map((e) => [e.slug, e]));
  const pool = exercises.filter((e) => isAvailable(e, profile));
  const notes: string[] = [];
  const minutes = opts.minutesOverride ?? (profile.startFromZero ? Math.min(profile.sessionMinutes, 25) : profile.sessionMinutes);

  // Recovery session when readiness says rest
  if (opts.readinessBand === "rest" || opts.readinessVolume <= 0) {
    const flow = ["cat-cow", "worlds-greatest-stretch", "open-book", "hip-flexor-stretch", "thread-the-needle", "childs-pose"]
      .filter((s) => byslug.has(s))
      .map((s) => mobilityBlock(s, 60));
    const main: Block[] = flow.length ? flow : [mobilityBlock("childs-pose", 60)];
    return {
      title: "Recovery & Mobility",
      focus: "recovery",
      dayType: "recovery",
      estimatedMinutes: Math.min(minutes, 15),
      warmup: [],
      main,
      cooldown: [],
      notes: [
        "Your check-in suggests recovery today. Gentle movement only — skip anything that hurts.",
        "If pain persists or is sharp, please consult a qualified health professional.",
      ],
      phase: opts.phase,
      readiness: "rest",
    };
  }

  const templates = dayTemplates(profile);
  let template = templates[((opts.dayIndex % templates.length) + templates.length) % templates.length];
  if (opts.focusOverride) {
    const match = templates.find((t) => t.focus === opts.focusOverride || t.name.toLowerCase().includes(opts.focusOverride!.toLowerCase()));
    if (match) template = match;
  }

  const used = new Set<string>();
  const main: Block[] = [];
  const volume = Math.max(0.5, Math.min(1.2, opts.readinessVolume * (opts.deload ? 0.7 : 1)));
  let sets = Math.max(1, Math.round(BASE_SETS[profile.experience] * volume));
  if (profile.startFromZero) sets = Math.min(sets, 2);

  // Skill practice goes first while fresh (only when the user has an Academy skill in progress).
  if (opts.skillExercise && byslug.has(opts.skillExercise) && opts.readinessVolume >= 1) {
    const skill = byslug.get(opts.skillExercise)!;
    if (isAvailable(skill, profile)) {
      const t = repTarget(skill, profile);
      main.push({
        exercise: skill.slug,
        sets: Math.max(2, Math.min(4, sets + 1)),
        repMin: t.repMin,
        repMax: t.repMax,
        seconds: t.seconds,
        restSeconds: Math.max(90, t.rest),
        note: "Skill practice — stop each set with good form, never to failure.",
        easier: resolveVariation(skill.easier, byslug, profile),
        harder: null,
        progression: "hold",
      });
      used.add(skill.slug);
    }
  }

  const slots = [...template.slots].sort((a, b) => a.priority - b.priority);
  for (const slot of slots) {
    let pick = chooseForSlot(slot, pool, profile, opts, used, rand);
    // When nothing fits (equipment / limitations), fall back to a related pattern.
    for (const alt of PATTERN_FALLBACKS[slot.pattern] ?? []) {
      if (pick) break;
      pick = chooseForSlot({ ...slot, pattern: alt, muscleHint: undefined }, pool, profile, opts, used, rand);
    }
    if (!pick) continue;
    const { ex, progression } = pick;
    const t = repTarget(ex, profile);
    const h = opts.history[ex.slug];
    let note: string | undefined;
    if (progression === "progress") note = "New progression unlocked from your recent sessions — start conservatively.";
    if (progression === "regress") note = "Stepped back a level based on recent sets. Rebuild clean reps here.";
    if (progression === "hold" && h && !ex.isTimed && h.lastReps) note = `Last time: ${h.lastReps} reps. Aim to match or add one rep with good form.`;
    if (progression === "hold" && h && ex.isTimed && h.lastSeconds) note = `Last time: ${h.lastSeconds}s. Hold steady or add a few seconds.`;
    main.push({
      exercise: ex.slug,
      sets: slot.priority >= 3 ? Math.max(1, sets - 1) : sets,
      repMin: t.repMin,
      repMax: t.repMax,
      seconds: t.seconds,
      restSeconds: t.rest,
      note,
      easier: resolveVariation(ex.easier, byslug, profile),
      harder: resolveVariation(ex.harder, byslug, profile),
      progression,
    });
    used.add(ex.slug);
  }

  if (!main.length) {
    // Extremely restricted case (e.g. many limitations): fall back to gentle mobility & core.
    for (const s of ["dead-bug", "bird-dog", "glute-bridge", "wall-slide"]) {
      const e = byslug.get(s);
      if (e && isAvailable(e, profile)) {
        const t = repTarget(e, profile);
        main.push({ exercise: s, sets: 2, repMin: t.repMin, repMax: t.repMax, seconds: t.seconds, restSeconds: t.rest, easier: null, harder: null, progression: "new" });
      }
    }
    notes.push("Few exercises match your current equipment and limitations. Update them in your profile for more variety.");
  }

  const pushing = main.some((b) => ["horizontal_push", "vertical_push", "dip", "skill"].includes(byslug.get(b.exercise)?.movementPattern ?? ""));
  const warmupSlugs = [...WARMUP_GENERAL].sort(() => rand() - 0.5).slice(0, 3);
  if (pushing && byslug.has("wrist-prep")) warmupSlugs.push("wrist-prep");
  const warmup = warmupSlugs.filter((s) => byslug.has(s)).map((s) => mobilityBlock(s, s === "wrist-prep" ? 90 : 45));

  const coolKey = template.focus === "lower" ? "lower" : ["upper", "push", "pull", "v_taper", "chest_arms"].includes(template.focus) ? "upper" : "default";
  const cooldown = COOLDOWN_BY_FOCUS[coolKey].filter((s) => byslug.has(s)).map((s) => mobilityBlock(s, 40));

  // Fit the session into the time budget: trim low-priority blocks, then sets.
  const workout = { warmup, main, cooldown };
  let estimate = estimateMinutes(workout);
  while (estimate > minutes + 3 && workout.main.length > 3) {
    workout.main.pop();
    estimate = estimateMinutes(workout);
  }
  while (estimate > minutes + 3 && workout.main.some((b) => b.sets > 1)) {
    const biggest = workout.main.reduce((a, b) => (b.sets > a.sets ? b : a));
    biggest.sets -= 1;
    estimate = estimateMinutes(workout);
  }
  if (estimate > minutes + 3 && workout.cooldown.length > 1) {
    workout.cooldown = workout.cooldown.slice(0, 1);
    estimate = estimateMinutes(workout);
  }

  if (opts.readinessBand === "easy") notes.push("Lighter session based on today's check-in. Keep every set comfortable.");
  if (opts.deload) notes.push("Deload week: reduced volume to let your body absorb recent training.");
  if (profile.startFromZero) notes.push("Start-from-zero mode: short and gentle. Finishing is the win today.");
  if (profile.limitations.length) notes.push("Exercises that commonly aggravate your listed limitations were excluded. Stop any movement that causes pain.");
  notes.push("Leave 1–3 reps in reserve on most sets. Quality over quantity.");

  return {
    title: template.name,
    focus: template.focus,
    dayType: "training",
    estimatedMinutes: estimate,
    warmup: workout.warmup,
    main: workout.main,
    cooldown: workout.cooldown,
    notes,
    phase: opts.phase,
    readiness: opts.readinessBand,
  };
}

/** Suitable substitutes: same movement pattern, available, safe, closest difficulty first. */
export function substitutesFor(slug: string, exercises: EngineExercise[], profile: EngineProfile, limit = 6): EngineExercise[] {
  const base = exercises.find((e) => e.slug === slug);
  if (!base) return [];
  return exercises
    .filter((e) => e.slug !== slug && e.movementPattern === base.movementPattern && isAvailable(e, profile) && e.category !== "skill")
    .sort((a, b) => Math.abs(a.difficulty - base.difficulty) - Math.abs(b.difficulty - base.difficulty))
    .slice(0, limit);
}
