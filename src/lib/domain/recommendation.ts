import type { ReadinessBand } from "./readiness";
import { diffDays } from "./dates";

export interface RecentSession {
  dateKey: string;
  rpe: number | null;
  setsDone: number;
  setsSkipped: number;
}

export interface ExerciseSeries {
  slug: string;
  name: string;
  metric: "reps" | "seconds";
  /** Best set per completed session, oldest first. */
  points: { dateKey: string; best: number }[];
  easier?: { slug: string; name: string } | null;
  harder?: { slug: string; name: string } | null;
}

export interface MissingPrerequisite {
  skill: string;
  label: string;
  best: number;
  target: number;
  source: "workout" | "self_reported_test" | null;
}

export interface RecommendationInput {
  today: string;
  isTrainingDay: boolean;
  doneToday: boolean;
  checkIn: { band: ReadinessBand; readiness: number; pain: boolean } | null;
  /** Completed workouts, newest first. */
  recent: RecentSession[];
  /** Most recent day with a completed workout or logged activity. */
  lastActiveDate: string | null;
  plannedMinutes: number;
  series: ExerciseSeries[];
  missingPrerequisites: MissingPrerequisite[];
}

export interface Plateau {
  exercise: string;
  slug: string;
  sessions: number;
  best: number;
  metric: "reps" | "seconds";
  message: string;
  alternatives: { slug: string; name: string; why: string }[];
}

export interface Recommendation {
  kind: "train" | "recover" | "rest" | "done";
  title: string;
  difficulty: "as_planned" | "easier";
  /** Applied to the workout engine's volume when the suggestion is accepted (1 = as planned). */
  volumeScale: number;
  minutes: number;
  /** Each reason quotes the data it is based on. */
  reasons: string[];
  /** What we don't know. Missing data is never treated as a sign of recovery or improvement. */
  dataGaps: string[];
  plateaus: Plateau[];
  prerequisites: MissingPrerequisite[];
  /** Either changes to apply to today's workout, or a link (e.g. a mobility routine). */
  alternatives: { label: string; minutes?: number; focus?: string; volumeScale?: number; href?: string }[];
}

const PLATEAU_MIN_SESSIONS = 4;
const PLATEAU_MIN_DAYS = 21;

/**
 * Cautious plateau check: only with at least 4 sessions over 3+ weeks, and only when the two most
 * recent sessions didn't beat the earlier best. Fewer data points → no claim either way.
 */
export function detectPlateau(s: ExerciseSeries): Plateau | null {
  const pts = s.points;
  if (pts.length < PLATEAU_MIN_SESSIONS) return null;
  if (diffDays(pts[pts.length - 1].dateKey, pts[0].dateKey) < PLATEAU_MIN_DAYS) return null;
  const earlier = Math.max(...pts.slice(0, -2).map((p) => p.best));
  const latest = Math.max(...pts.slice(-2).map((p) => p.best));
  if (latest > earlier) return null;
  const unit = s.metric === "seconds" ? "s" : " reps";
  const alternatives = [
    s.easier && { ...s.easier, why: "an easier variation for cleaner, higher-quality reps" },
    s.harder && { ...s.harder, why: "a harder variation at lower reps, if your form is solid" },
  ].filter(Boolean) as Plateau["alternatives"];
  return {
    exercise: s.name,
    slug: s.slug,
    sessions: pts.length,
    best: Math.max(earlier, latest),
    metric: s.metric,
    message: `Your best ${s.name} set hasn't gone up over your last ${pts.length} sessions (best ${Math.max(earlier, latest)}${unit}). Stalls like this are common and can come from sleep, stress or simply needing more time — it isn't a diagnosis. If it continues, a variation can help.`,
    alternatives,
  };
}

export function recommend(input: RecommendationInput): Recommendation {
  const reasons: string[] = [];
  const dataGaps: string[] = [];
  const plateaus = input.series.map(detectPlateau).filter((p): p is Plateau => !!p);
  const base = { plateaus, prerequisites: input.missingPrerequisites, minutes: input.plannedMinutes, dataGaps, reasons };

  if (!input.checkIn) dataGaps.push("No check-in today, so your readiness is unknown. This suggestion follows your plan — it doesn't assume you're recovered.");
  if (!input.recent.length) dataGaps.push("No completed workouts yet, so there's no effort history to adapt to. Starting from your planned level.");
  const unrated = input.recent.slice(0, 3).filter((r) => r.rpe == null).length;
  if (unrated) dataGaps.push(`Effort (RPE) wasn't recorded for ${unrated} of your last ${Math.min(3, input.recent.length)} workouts, so difficulty can't fully adapt to how hard they felt.`);

  if (input.doneToday) {
    return { ...base, kind: "done", title: "Today's workout is done", difficulty: "as_planned", volumeScale: 1, reasons: ["You've already completed a workout today."], alternatives: [{ label: "Gentle mobility routine", href: "/recovery" }] };
  }

  if (input.checkIn && (input.checkIn.pain || input.checkIn.band === "rest")) {
    reasons.push(input.checkIn.pain ? "Your check-in today reported pain (not normal soreness)." : `Your readiness today is ${input.checkIn.readiness}/100.`);
    reasons.push("A recovery session or rest is the safer choice. This is a training suggestion, not a medical assessment — for persistent or sharp pain, see a qualified professional.");
    return { ...base, kind: "recover", title: "Recovery today", difficulty: "easier", volumeScale: 0.5, alternatives: [{ label: "Gentle mobility routine", href: "/recovery" }] };
  }

  if (!input.isTrainingDay) {
    reasons.push("Today is a planned rest day in your schedule. Rest is part of training.");
    return { ...base, kind: "rest", title: "Planned rest day", difficulty: "as_planned", volumeScale: 1, alternatives: [{ label: "Gentle mobility routine", href: "/recovery" }, { label: "Train anyway (as planned)" }] };
  }

  let scale = 1;
  const easier = (s: number, why: string) => {
    scale = Math.min(scale, s);
    reasons.push(why);
  };
  if (input.checkIn?.band === "easy") reasons.push(`Your readiness today is ${input.checkIn.readiness}/100, so the plan already lowers volume.`);
  const rated = input.recent.slice(0, 2).filter((r) => r.rpe != null);
  if (rated.length === 2 && rated.every((r) => (r.rpe ?? 0) >= 9)) easier(0.8, `Your last two workouts were rated very hard (RPE ${rated.map((r) => r.rpe).join(" and ")}), so today is a little lighter.`);
  const last2 = input.recent.slice(0, 2);
  const done = last2.reduce((s, r) => s + r.setsDone, 0);
  const skipped = last2.reduce((s, r) => s + r.setsSkipped, 0);
  if (last2.length === 2 && done + skipped > 0 && skipped / (done + skipped) >= 0.4) easier(0.8, `You skipped ${skipped} of ${done + skipped} sets in your last two workouts, so today has fewer sets.`);
  if (input.lastActiveDate) {
    const gap = diffDays(input.today, input.lastActiveDate);
    if (gap >= 10) easier(0.75, `It's been ${gap} days since your last logged workout or activity, so today eases you back in.`);
  } else if (input.recent.length === 0) {
    // already noted in dataGaps
  }
  if (!reasons.length) reasons.push(input.checkIn ? `Readiness ${input.checkIn.readiness}/100 and your recent workouts don't call for changes.` : "Nothing in your logged data calls for a change, so this is your planned session.");
  const alternatives: Recommendation["alternatives"] = [
    { label: "Shorter session (20 min)", minutes: 20 },
    { label: "Mobility routine instead", href: "/recovery" },
  ];
  if (scale < 1) alternatives.unshift({ label: "Keep my planned difficulty", volumeScale: 1 });
  return { ...base, kind: "train", title: scale < 1 ? "Train — a bit lighter today" : "Train as planned", difficulty: scale < 1 ? "easier" : "as_planned", volumeScale: scale, alternatives };
}
