export interface AchievementStats {
  workoutsCompleted: number;
  pushupRepsTotal: number;
  maxPullupReps: number;
  maxPlankSeconds: number;
  longestStreak: number;
  bestWeeklyStreak: number;
  skillsUnlocked: number;
  weeklyReviews: number;
  mobilitySessions: number;
  personalRecords: number;
  activitiesLogged: number;
  sportsTried: number;
}

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  check: (s: AchievementStats) => boolean;
  progress: (s: AchievementStats) => [number, number];
}

const def = (
  key: string,
  title: string,
  description: string,
  icon: string,
  xp: number,
  value: (s: AchievementStats) => number,
  target: number,
): AchievementDef => ({
  key,
  title,
  description,
  icon,
  xp,
  check: (s) => value(s) >= target,
  progress: (s) => [Math.min(value(s), target), target],
});

/** Achievements are unlocked only from recorded data (see services/gamification). */
export const ACHIEVEMENTS: AchievementDef[] = [
  def("first_workout", "First Workout", "Completed your first logged workout.", "flame", 50, (s) => s.workoutsCompleted, 1),
  def("streak_7", "Seven-Day Consistency", "Kept a 7-day consistency streak (rest days count).", "calendar", 75, (s) => s.longestStreak, 7),
  def("pushups_100", "100 Push-Ups", "Logged 100 push-up reps across your sessions.", "zap", 75, (s) => s.pushupRepsTotal, 100),
  def("first_pullup", "First Pull-Up", "Logged a strict pull-up or chin-up.", "arrow-up", 100, (s) => s.maxPullupReps, 1),
  def("plank_60", "60-Second Plank", "Held a front plank for 60 seconds.", "timer", 60, (s) => s.maxPlankSeconds, 60),
  def("month_consistency", "First Month of Consistency", "Hit your weekly target four weeks in a row.", "trophy", 150, (s) => s.bestWeeklyStreak, 4),
  def("first_skill", "First Calisthenics Skill", "Completed every step of an Academy skill.", "star", 150, (s) => s.skillsUnlocked, 1),
  def("journey_24", "24-Week Journey", "Completed 24 weekly reviews on your roadmap.", "mountain", 500, (s) => s.weeklyReviews, 24),
  def("workouts_10", "Ten Sessions", "Completed 10 workouts.", "dumbbell", 75, (s) => s.workoutsCompleted, 10),
  def("workouts_50", "Fifty Sessions", "Completed 50 workouts.", "medal", 200, (s) => s.workoutsCompleted, 50),
  def("mobility_10", "Mobility Habit", "Completed 10 mobility sessions.", "stretch", 60, (s) => s.mobilitySessions, 10),
  def("first_pr", "Personal Best", "Set your first personal record.", "award", 40, (s) => s.personalRecords, 1),
  def("multisport", "Multisport Explorer", "Logged three different sports.", "compass", 60, (s) => s.sportsTried, 3),
];

export function newlyUnlocked(stats: AchievementStats, alreadyUnlocked: Set<string>) {
  return ACHIEVEMENTS.filter((a) => !alreadyUnlocked.has(a.key) && a.check(stats));
}
