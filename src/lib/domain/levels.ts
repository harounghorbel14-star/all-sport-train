/** XP needed to reach level n (n ≥ 1): gently increasing curve. */
export const xpForLevel = (level: number) => Math.round(100 * (level - 1) ** 1.5);

export function levelFromXp(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, into: xp - floor, needed: next - floor, progress: (xp - floor) / (next - floor) };
}

export const XP = {
  workout: 50,
  workoutPerMinute: 1,
  activity: 20,
  mobility: 15,
  checkin: 5,
  weeklyReview: 25,
} as const;

export const LEVEL_TITLES = ["Starter", "Mover", "Builder", "Athlete", "Warrior", "Specialist", "Elite", "Apex"];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))];
