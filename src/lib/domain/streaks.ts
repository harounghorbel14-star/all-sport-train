import { addDays, diffDays, weekday, weekStart } from "./dates";

export interface StreakInput {
  /** Days (YYYY-MM-DD, user's time zone) with a completed workout, logged activity or mobility session. */
  activeDays: Iterable<string>;
  /** Days the user explicitly logged as a rest / recovery day. */
  restDays?: Iterable<string>;
  /** Planned training weekdays (0 = Sunday). Other days are planned rest and never break a streak. */
  trainingDays: number[];
  today: string;
  /** Missed planned sessions forgiven per week. */
  graceDaysPerWeek?: number;
}

export interface StreakResult {
  current: number;
  longest: number;
  todayPending: boolean;
  graceUsedThisWeek: number;
}

/**
 * Sustainable streak: rest days and planned off-days keep the chain alive,
 * and one missed planned session per week is forgiven by default. A streak
 * only starts on a day with real activity.
 */
export function computeStreak(input: StreakInput): StreakResult {
  const active = new Set(input.activeDays);
  const rest = new Set(input.restDays ?? []);
  const planned = new Set(input.trainingDays.length ? input.trainingDays : [0, 1, 2, 3, 4, 5, 6]);
  const grace = input.graceDaysPerWeek ?? 1;
  const sorted = [...active].filter((d) => d <= input.today).sort();
  if (!sorted.length) return { current: 0, longest: 0, todayPending: planned.has(weekday(input.today)), graceUsedThisWeek: 0 };

  let run = 0;
  let longest = 0;
  let todayPending = false;
  const graceUsed = new Map<string, number>();

  for (let d = sorted[0]; d <= input.today; d = addDays(d, 1)) {
    const isActive = active.has(d);
    const isPlanned = planned.has(weekday(d));
    let kept = isActive || rest.has(d) || !isPlanned;

    if (!kept && d === input.today) {
      todayPending = true; // the day isn't over yet
      break;
    }
    if (!kept) {
      const wk = weekStart(d);
      const used = graceUsed.get(wk) ?? 0;
      if (used < grace && run > 0) {
        graceUsed.set(wk, used + 1);
        kept = true;
      }
    }

    if (kept && (run > 0 || isActive)) run += 1;
    else if (!kept) run = 0;
    longest = Math.max(longest, run);
  }

  return {
    current: run,
    longest,
    todayPending,
    graceUsedThisWeek: graceUsed.get(weekStart(input.today)) ?? 0,
  };
}

/** Weekly consistency: share of the weekly target reached (capped at 100%). */
export function weeklyConsistency(activeDays: Iterable<string>, today: string, target: number) {
  const start = weekStart(today);
  const days = [...new Set(activeDays)].filter((d) => d >= start && d <= addDays(start, 6));
  const done = days.length;
  return { done, target, percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0 };
}

/** Consecutive weeks (Monday-based) meeting the weekly target. The current week counts once met. */
export function weeklyStreak(activeDays: Iterable<string>, today: string, target: number): number {
  const byWeek = new Map<string, number>();
  for (const d of new Set(activeDays)) {
    if (d > today) continue;
    const wk = weekStart(d);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
  }
  let streak = 0;
  let wk = weekStart(today);
  if ((byWeek.get(wk) ?? 0) >= target) streak += 1;
  wk = addDays(wk, -7);
  while ((byWeek.get(wk) ?? 0) >= target) {
    streak += 1;
    wk = addDays(wk, -7);
  }
  return streak;
}

export const daysSince = (from: string, to: string) => diffDays(to, from);
