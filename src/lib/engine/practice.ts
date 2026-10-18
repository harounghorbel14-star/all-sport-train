import { z } from "zod";
import { levelRank, type Level } from "../content/sports/types";

/**
 * Sport practice-session builder and related pure logic (weekly plans,
 * personal bests, next lesson). No database access here.
 */

export interface EngineDrill {
  slug: string;
  title: string;
  level: string;
  focus: string;
  durationMin: number;
  setting: string;
  minPlayers: number;
  contact: string;
  requiresSupervision: boolean;
  metricKey: string | null;
  equipment: string[];
}

export type PracticeFocus = "balanced" | "technique" | "tactical" | "conditioning" | "game";
export type PracticeSetting = "solo" | "partner" | "team";

export interface PracticeInput {
  sportName: string;
  drills: EngineDrill[];
  conditioningExercises: string[];
  level: Level;
  minutes: number;
  focus: PracticeFocus;
  setting: PracticeSetting;
  players: number;
  supervised: boolean;
  under18: boolean;
  /** Drills from the next lesson are preferred. */
  preferredDrills?: string[];
  seed?: string;
}

export const practiceBlockSchema = z.object({
  kind: z.enum(["drill", "exercises"]),
  drillSlug: z.string().nullable(),
  title: z.string(),
  minutes: z.number().int().min(1).max(180),
  focus: z.string(),
  metricKey: z.string().nullable(),
  exercises: z.array(z.string()).optional(),
  note: z.string().optional(),
});
export const practiceContentSchema = z.object({
  title: z.string(),
  focus: z.string(),
  minutes: z.number().int(),
  blocks: z.array(practiceBlockSchema),
  safety: z.array(z.string()),
  notes: z.array(z.string()),
  excluded: z.array(z.object({ title: z.string(), reason: z.string() })),
});
export type PracticeContent = z.infer<typeof practiceContentSchema>;
export type PracticeBlock = z.infer<typeof practiceBlockSchema>;

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SETTING_RANK: Record<PracticeSetting, number> = { solo: 0, partner: 1, team: 2 };

/** Why a drill can't be used, or null when it is allowed. Safety rules live here. */
export function drillExclusion(d: EngineDrill, i: Pick<PracticeInput, "level" | "setting" | "players" | "supervised" | "under18">): string | null {
  if (levelRank(d.level) > levelRank(i.level)) return "Above your current level";
  if (SETTING_RANK[d.setting as PracticeSetting] > SETTING_RANK[i.setting]) return d.setting === "team" ? "Needs a team" : "Needs a partner";
  if (d.minPlayers > i.players) return `Needs at least ${d.minPlayers} players`;
  if (d.contact === "full") return "Full-contact training is never generated — train it only in a supervised club";
  if (d.contact === "controlled" && (!i.supervised || i.under18 || levelRank(i.level) < 2)) return "Controlled sparring only for supervised adult advanced athletes";
  if (d.requiresSupervision && !i.supervised) return "Requires a qualified coach — mark that you train with one to unlock";
  if (d.contact === "light" && i.under18 && !i.supervised) return "Partner contact for under-18s only in supervised clubs";
  return null;
}

export function generatePractice(input: PracticeInput): PracticeContent {
  const rand = rng(input.seed ?? `${input.sportName}:${input.level}:${input.minutes}:${input.focus}`);
  const excluded: PracticeContent["excluded"] = [];
  const allowed = input.drills.filter((d) => {
    const why = drillExclusion(d, input);
    if (why) excluded.push({ title: d.title, reason: why });
    return !why;
  });
  const minutes = Math.max(10, Math.min(180, Math.round(input.minutes)));
  const blocks: PracticeBlock[] = [];
  const used = new Set<string>();
  const preferred = new Set(input.preferredDrills ?? []);
  const toBlock = (d: EngineDrill, mins = d.durationMin): PracticeBlock => ({ kind: "drill", drillSlug: d.slug, title: d.title, minutes: mins, focus: d.focus, metricKey: d.metricKey });

  const pick = (focuses: string[]) =>
    allowed
      .filter((d) => focuses.includes(d.focus) && !used.has(d.slug))
      .map((d) => ({ d, score: (preferred.has(d.slug) ? 10 : 0) + levelRank(d.level) * 2 + rand() }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.d);

  // Warm-up and cooldown are always included when available.
  const warm = pick(["warmup"])[0];
  const cool = pick(["cooldown"])[0];
  const warmMin = warm ? Math.min(warm.durationMin, Math.max(5, Math.round(minutes * 0.15))) : 0;
  const coolMin = cool ? Math.min(cool.durationMin, Math.max(4, Math.round(minutes * 0.1))) : 0;
  if (warm) {
    blocks.push(toBlock(warm, warmMin));
    used.add(warm.slug);
  }
  if (cool) used.add(cool.slug);

  let remaining = minutes - warmMin - coolMin;
  const shares: Record<PracticeFocus, [string[], number][]> = {
    balanced: [[["technique"], 0.5], [["tactical", "game"], 0.25], [["conditioning"], 0.25]],
    technique: [[["technique"], 0.8], [["conditioning"], 0.2]],
    tactical: [[["tactical", "game"], 0.6], [["technique"], 0.4]],
    conditioning: [[["conditioning"], 0.7], [["technique"], 0.3]],
    game: [[["game", "tactical"], 0.7], [["technique"], 0.3]],
  };
  const main: PracticeBlock[] = [];
  const budget = remaining;
  for (const [focuses, share] of shares[input.focus]) {
    let slot = Math.round(budget * share);
    for (const d of pick(focuses)) {
      if (slot < 4 || remaining < 4) break;
      const mins = Math.min(d.durationMin, slot, remaining);
      if (mins < Math.min(5, d.durationMin)) continue;
      main.push(toBlock(d, mins));
      used.add(d.slug);
      slot -= mins;
      remaining -= mins;
    }
  }
  // Fill any remaining time with more technique, then sport conditioning exercises.
  for (const d of pick(["technique", "game", "tactical"])) {
    if (remaining < 5) break;
    const mins = Math.min(d.durationMin, remaining);
    main.push(toBlock(d, mins));
    used.add(d.slug);
    remaining -= mins;
  }
  if (remaining >= 6 && input.conditioningExercises.length) {
    const ex = [...input.conditioningExercises].sort(() => rand() - 0.5).slice(0, 3);
    main.push({ kind: "exercises", drillSlug: null, title: "Sport-specific strength circuit", minutes: remaining, focus: "conditioning", metricKey: null, exercises: ex, note: "2–3 rounds, 8–12 controlled reps each, 60 s rest between rounds." });
    remaining = 0;
  } else if (remaining > 0 && main.length) {
    main[main.length - 1].minutes += remaining;
    remaining = 0;
  }
  blocks.push(...main);
  if (cool) blocks.push(toBlock(cool, coolMin));

  const notes: string[] = [];
  if (!main.some((b) => b.kind === "drill")) {
    const supervisedOnly = excluded.some((e) => e.reason.includes("qualified coach"));
    notes.push(
      supervisedOnly
        ? "Most drills for this sport need a qualified coach (and, in water, a lifeguard). Mark that you train with one to unlock them — until then this session is conditioning only."
        : "No main drills match your current level and setting yet. Try a different setting or ask a coach.",
    );
  }
  if (input.setting === "solo") notes.push("Solo session — partner and team drills were left out.");
  if (preferred.size && main.some((b) => b.drillSlug && preferred.has(b.drillSlug))) notes.push("Includes drills from your next lesson.");
  const safety = ["Stop any drill that causes pain.", "Warm up fully before high-intensity work."];
  if (excluded.some((e) => e.reason.includes("coach") || e.reason.includes("supervised") || e.reason.includes("contact"))) {
    safety.push("Some partner-contact drills were not included. Contact training belongs in a supervised club setting.");
  }
  return {
    title: `${input.sportName} · ${input.focus === "balanced" ? "practice" : `${input.focus} focus`}`,
    focus: input.focus,
    minutes: blocks.reduce((s, b) => s + b.minutes, 0),
    blocks,
    safety,
    notes,
    excluded,
  };
}

// ── Weekly plan ─────────────────────────────────────────────────────────
export type SessionFocus = "technique" | "tactical" | "conditioning" | "game" | "recovery";

export function weeklyPlan(structure: { sessionsPerWeek: number; pattern: SessionFocus[] }[] | undefined, sessionsPerWeek: number, trainingDays: number[]) {
  const n = Math.max(1, Math.min(7, sessionsPerWeek));
  const options = structure?.length ? structure : [{ sessionsPerWeek: 3, pattern: ["technique", "conditioning", "game"] as SessionFocus[] }];
  const best = [...options].sort((a, b) => Math.abs(a.sessionsPerWeek - n) - Math.abs(b.sessionsPerWeek - n))[0];
  const pattern = Array.from({ length: n }, (_, i) => best.pattern[i % best.pattern.length]);
  // Spread sessions over the user's training days first, then other days.
  const preferred = [...trainingDays].sort();
  const others = [1, 2, 3, 4, 5, 6, 0].filter((d) => !preferred.includes(d));
  const days = [...preferred, ...others].slice(0, n).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return days.map((weekday, i) => ({ weekday, focus: pattern[i] }));
}

// ── Metrics & personal bests ────────────────────────────────────────────
export interface MetricDef {
  key: string;
  label: string;
  kind: string;
  direction: string;
  minAttempts: number | null;
  unit: string | null;
}
export interface MetricEntryLike {
  metricKey: string;
  value: number;
  attempts: number | null;
  dateKey: string;
}

/** Whether an entry can count as a personal best (ratios need enough attempts). */
export const pbEligible = (m: MetricDef, e: MetricEntryLike) => m.kind !== "ratio" || (e.attempts ?? 0) >= (m.minAttempts ?? 1);

export function personalBests(metrics: MetricDef[], entries: MetricEntryLike[]) {
  const out: Record<string, MetricEntryLike | null> = {};
  for (const m of metrics) {
    if (m.direction === "none" || m.kind === "text") continue;
    const list = entries.filter((e) => e.metricKey === m.key && pbEligible(m, e));
    out[m.key] = list.reduce<MetricEntryLike | null>((best, e) => {
      if (!best) return e;
      return m.direction === "lower" ? (e.value < best.value ? e : best) : e.value > best.value ? e : best;
    }, null);
  }
  return out;
}

/** Ratio input → percentage value. */
export function ratioValue(made: number, attempts: number) {
  if (attempts <= 0 || made < 0 || made > attempts) throw new Error("Made must be between 0 and attempts");
  return Math.round((made / attempts) * 1000) / 10;
}

export function isImprovement(direction: string, previous: number | null | undefined, value: number) {
  if (previous == null) return false;
  return direction === "lower" ? value < previous : direction === "higher" ? value > previous : false;
}

/** Milestone achieved? Select metrics (coach ratings) compare the leading number. */
export function milestoneMet(direction: string, best: number | null | undefined, target: number | undefined) {
  if (best == null || target == null) return false;
  return direction === "lower" ? best <= target : best >= target;
}

// ── Learning path ───────────────────────────────────────────────────────
export interface LessonLike {
  slug: string;
  level: string;
  order: number;
  prerequisites: string[];
}

/** First incomplete lesson whose prerequisites are done and level is at most one step above the user. */
export function nextLesson<T extends LessonLike>(lessons: T[], completed: Set<string>, userLevel: string): T | null {
  const sorted = [...lessons].sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.order - b.order);
  return sorted.find((l) => !completed.has(l.slug) && l.prerequisites.every((p) => completed.has(p)) && levelRank(l.level) <= levelRank(userLevel) + 1) ?? null;
}
