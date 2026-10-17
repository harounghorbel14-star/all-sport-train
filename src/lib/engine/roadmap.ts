import { addDays, diffDays } from "../domain/dates";

export interface Phase {
  index: number;
  name: string;
  weeks: [number, number];
  focus: string;
  goals: string[];
  volume: number;
  milestones: string[];
}

export const PHASES: Phase[] = [
  {
    index: 1,
    name: "Foundation",
    weeks: [1, 4],
    focus: "Technique, consistency and habits",
    goals: ["Learn movement technique", "Establish a consistent schedule", "Build basic strength and mobility", "Learn to log workouts"],
    volume: 0.8,
    milestones: ["Complete 8 sessions", "Hold a 30 s plank", "Log your first weekly review"],
  },
  {
    index: 2,
    name: "Base Strength",
    weeks: [5, 8],
    focus: "Push-ups, rows, squats, lunges and core control",
    goals: ["Improve core movement patterns", "Introduce progressions", "Increase volume gradually"],
    volume: 0.9,
    milestones: ["Progress one variation on a pushing exercise", "20 bodyweight squats", "45 s plank"],
  },
  {
    index: 3,
    name: "Strength Development",
    weeks: [9, 12],
    focus: "Harder bodyweight variations and structured tracking",
    goals: ["Progress pulling and pushing", "Lower-body strength", "Core stability", "Track performance"],
    volume: 1,
    milestones: ["Your first pull-up or 12 inverted rows", "10 push-ups", "Bulgarian split squats"],
  },
  {
    index: 4,
    name: "Athletic Development",
    weeks: [13, 16],
    focus: "Work capacity, balance, mobility and intermediate skills",
    goals: ["Develop work capacity", "Introduce suitable skills", "Balance and mobility"],
    volume: 1,
    milestones: ["Start an Academy skill", "60 s plank", "Single-leg balance 30 s"],
  },
  {
    index: 5,
    name: "Advanced Progressions",
    weeks: [17, 20],
    focus: "Individualised skill and strength progressions",
    goals: ["Individualise progressions", "Adjust difficulty from performance"],
    volume: 1.05,
    milestones: ["Advance a skill step", "Set new personal records"],
  },
  {
    index: 6,
    name: "Consolidation",
    weeks: [21, 24],
    focus: "Review, retest and plan the next block",
    goals: ["Compare against your baseline", "Identify strengths and weaknesses", "Create the next training block"],
    volume: 0.9,
    milestones: ["Retest baseline exercises", "Complete your 24-week review"],
  },
];

export interface RoadmapState {
  week: number; // 1-based, may exceed 24 (new block)
  phase: Phase;
  dayInWeek: number;
  deload: boolean;
  volume: number;
  progressPercent: number;
  weekStartKey: string;
}

/**
 * Current position in the 24-week framework. Repeated phases (from weekly
 * reviews) shift the timeline via `repeatOffsetWeeks`.
 */
export function roadmapState(startKey: string, today: string, repeatOffsetWeeks = 0, deloadsEnabled = true): RoadmapState {
  const days = Math.max(0, diffDays(today, startKey));
  const rawWeek = Math.floor(days / 7) + 1;
  const week = Math.max(1, rawWeek - repeatOffsetWeeks);
  const cycleWeek = ((week - 1) % 24) + 1;
  const phase = PHASES.find((p) => cycleWeek >= p.weeks[0] && cycleWeek <= p.weeks[1]) ?? PHASES[0];
  const deload = deloadsEnabled && cycleWeek % 4 === 0 && cycleWeek > 4;
  return {
    week,
    phase,
    dayInWeek: (days % 7) + 1,
    deload,
    volume: phase.volume * (deload ? 0.7 : 1),
    progressPercent: Math.min(100, Math.round((Math.min(week, 24) / 24) * 100)),
    weekStartKey: addDays(startKey, (rawWeek - 1) * 7),
  };
}

export type ReviewDifficulty = "too_easy" | "right" | "too_hard";

export interface ReviewInput {
  feeling: number; // 1..5
  difficulty: ReviewDifficulty;
  sessionsDone: number;
  sessionsPlanned: number;
  painReported: boolean;
}

export interface ReviewAdjustment {
  action: "progress" | "continue" | "repeat_week" | "deload";
  message: string;
  repeatWeeks: number;
}

/** Weekly review → sensible adjustment. Never escalates when recovery is poor. */
export function reviewAdjustment(r: ReviewInput): ReviewAdjustment {
  const adherence = r.sessionsPlanned > 0 ? r.sessionsDone / r.sessionsPlanned : 0;
  if (r.painReported || r.feeling <= 1) {
    return {
      action: "deload",
      message: "Next week is a lighter deload week. If pain persists, reduce or stop the aggravating exercises and consider seeing a qualified professional.",
      repeatWeeks: 1,
    };
  }
  if (r.difficulty === "too_hard" || r.feeling === 2) {
    return { action: "repeat_week", message: "We'll repeat this week's level so you can consolidate before moving on. That's normal and smart training.", repeatWeeks: 1 };
  }
  if (adherence < 0.5) {
    return {
      action: "repeat_week",
      message: "Life happens. We'll repeat this week rather than skipping ahead — consider fewer, shorter sessions if your schedule is tight.",
      repeatWeeks: 1,
    };
  }
  if (r.difficulty === "too_easy" && r.feeling >= 4 && adherence >= 0.75) {
    return { action: "progress", message: "Great week. Progressions will unlock as your logged sets show you're ready — keep logging every set.", repeatWeeks: 0 };
  }
  return { action: "continue", message: "Keep going with the plan. Consistency is doing the heavy lifting.", repeatWeeks: 0 };
}
