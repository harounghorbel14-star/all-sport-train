/**
 * Goal evaluation from the user's own records. Pure: the service loads the points, this decides
 * progress, milestones and what can't be said. Rules:
 * - progress needs a known starting point (logged, self-reported, or the first result after the goal was set);
 * - nothing is projected — a target date is a reminder, never a prediction;
 * - notes are codes so the UI can translate them.
 */
export type GoalKind = "exercise" | "sport_metric" | "consistency" | "lesson";
export type PointSource = "logged" | "self_reported" | "assessed";
export interface GoalPoint {
  dateKey: string;
  value: number;
  source: PointSource;
}
export interface GoalSpec {
  kind: GoalKind;
  direction: "higher" | "lower";
  baseline: number | null;
  baselineSource: string | null;
  baselineDate: string | null;
  target: number;
  periodWeeks?: number | null;
  targetDate?: string | null;
  createdOn: string; // YYYY-MM-DD in the user's time zone
}
export type GoalNote =
  | { code: "no_data" }
  | { code: "no_baseline" }
  | { code: "baseline_first_logged"; dateKey: string }
  | { code: "few_results"; count: number }
  | { code: "target_date_passed"; dateKey: string }
  | { code: "already_met_at_start" }
  | { code: "this_week_partial"; count: number }
  | { code: "lesson_awaiting_assessment" }
  | { code: "self_reported" };

export interface Milestone {
  fraction: number;
  value: number;
  reachedOn: string | null;
}
export interface GoalEvaluation {
  current: number | null;
  baseline: number | null;
  baselineSource: string | null;
  progress: number | null; // 0..1, null when it can't be computed honestly
  achieved: boolean;
  achievedOn: string | null;
  milestones: Milestone[];
  history: GoalPoint[];
  notes: GoalNote[];
}

const better = (dir: "higher" | "lower", a: number, b: number) => (dir === "lower" ? a < b : a > b);
const meets = (dir: "higher" | "lower", value: number, target: number) => (dir === "lower" ? value <= target : value >= target);
const round = (n: number) => Math.round(n * 100) / 100;

/** Measured goals (exercise bests, sport results): best result so far against the target. */
export function evaluateMeasured(spec: GoalSpec, points: GoalPoint[], today: string): GoalEvaluation {
  const sorted = [...points].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const notes: GoalNote[] = [];
  let baseline = spec.baseline;
  let baselineSource = spec.baselineSource;
  let baselineDate = spec.baselineDate ?? spec.createdOn;
  if (baseline == null) {
    const first = sorted.find((p) => p.dateKey >= spec.createdOn);
    if (first) {
      baseline = first.value;
      baselineSource = "first_logged";
      baselineDate = first.dateKey;
      notes.push({ code: "baseline_first_logged", dateKey: first.dateKey });
    } else notes.push({ code: "no_baseline" });
  }
  if (!sorted.length) notes.push({ code: "no_data" });
  else if (sorted.length < 3) notes.push({ code: "few_results", count: sorted.length });
  if (sorted.some((p) => p.source === "self_reported")) notes.push({ code: "self_reported" });

  let best: number | null = null;
  let achievedOn: string | null = null;
  const fractions = baseline != null && baseline !== spec.target && !meets(spec.direction, baseline, spec.target) ? [0.25, 0.5, 0.75, 1] : [1];
  const milestones: Milestone[] = fractions.map((f) => ({ fraction: f, value: round(baseline != null && fractions.length > 1 ? baseline + f * (spec.target - baseline) : spec.target), reachedOn: null }));
  for (const p of sorted) {
    if (best == null || better(spec.direction, p.value, best)) best = p.value;
    if (p.dateKey < baselineDate) continue; // milestones count from the starting point on
    for (const m of milestones) if (!m.reachedOn && meets(spec.direction, best, m.value)) m.reachedOn = p.dateKey;
  }
  const achieved = best != null && meets(spec.direction, best, spec.target);
  if (achieved) achievedOn = milestones[milestones.length - 1].reachedOn ?? sorted.find((p) => meets(spec.direction, p.value, spec.target))?.dateKey ?? null;
  if (baseline != null && meets(spec.direction, baseline, spec.target)) notes.push({ code: "already_met_at_start" });
  let progress: number | null = null;
  if (baseline != null && best != null) {
    const span = spec.target - baseline;
    progress = span === 0 ? 1 : Math.max(0, Math.min(1, (best - baseline) / span));
  }
  if (spec.targetDate && spec.targetDate < today && !achieved) notes.push({ code: "target_date_passed", dateKey: spec.targetDate });
  return { current: best, baseline, baselineSource, progress, achieved, achievedOn, milestones, history: sorted.slice(-30), notes };
}

/**
 * Consistency goals: sessions per week, held for `periodWeeks` full weeks in a row.
 * `weeks` are week-start keys (from the week the goal was set) with the number of sessions logged; weeks with nothing logged count as 0
 * (no session was recorded — the app doesn't guess). The current, unfinished week is shown but not counted.
 */
export function evaluateConsistency(spec: GoalSpec, weeks: { weekStart: string; sessions: number }[], currentWeek: string, today: string): GoalEvaluation {
  const need = Math.max(1, spec.periodWeeks ?? 4);
  const full = weeks.filter((w) => w.weekStart < currentWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  let run = 0;
  let bestRun = 0;
  let achievedOn: string | null = null;
  for (const w of full) {
    run = w.sessions >= spec.target ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
    if (!achievedOn && run >= need) achievedOn = w.weekStart;
  }
  const notes: GoalNote[] = [];
  if (!full.length) notes.push({ code: "no_data" });
  const thisWeek = weeks.find((w) => w.weekStart === currentWeek);
  notes.push({ code: "this_week_partial", count: thisWeek?.sessions ?? 0 });
  if (spec.targetDate && spec.targetDate < today && !achievedOn) notes.push({ code: "target_date_passed", dateKey: spec.targetDate });
  const milestones: Milestone[] = Array.from({ length: need }, (_, i) => ({ fraction: (i + 1) / need, value: i + 1, reachedOn: null }));
  run = 0;
  for (const w of full) {
    run = w.sessions >= spec.target ? run + 1 : 0;
    for (const m of milestones) if (!m.reachedOn && run >= m.value) m.reachedOn = w.weekStart;
  }
  return {
    current: run,
    baseline: 0,
    baselineSource: null,
    progress: Math.min(1, Math.max(run, achievedOn ? need : 0) / need),
    achieved: !!achievedOn,
    achievedOn,
    milestones,
    history: weeks.slice(-12).map((w) => ({ dateKey: w.weekStart, value: w.sessions, source: "logged" })),
    notes,
  };
}

/** Lesson goals: completed only when the lesson is completed (assessed or, where allowed, self-reported). */
export function evaluateLesson(state: "not_started" | "in_progress" | "awaiting_assessment" | "completed", evidence: string | null, completedOn: string | null): GoalEvaluation {
  const notes: GoalNote[] = [];
  if (state === "awaiting_assessment") notes.push({ code: "lesson_awaiting_assessment" });
  if (state === "completed" && evidence === "self_reported") notes.push({ code: "self_reported" });
  const progress = state === "completed" ? 1 : state === "awaiting_assessment" ? 0.75 : state === "in_progress" ? 0.25 : 0;
  return {
    current: progress,
    baseline: 0,
    baselineSource: null,
    progress,
    achieved: state === "completed",
    achievedOn: state === "completed" ? completedOn : null,
    milestones: [{ fraction: 1, value: 1, reachedOn: state === "completed" ? completedOn : null }],
    history: [],
    notes,
  };
}
