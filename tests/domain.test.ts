import { describe, expect, it } from "vitest";
import { computeStreak, weeklyConsistency, weeklyStreak } from "@/lib/domain/streaks";
import { addDays, dateKey, weekStart } from "@/lib/domain/dates";
import { exerciseKcal, estimateTdee, calorieGuidance, runningMetFromPace } from "@/lib/domain/energy";
import { scalePortion, daySummary, parseMealText } from "@/lib/domain/nutrition";
import { readinessScore, readinessBand } from "@/lib/domain/readiness";
import { levelFromXp, xpForLevel } from "@/lib/domain/levels";
import { ACHIEVEMENTS, newlyUnlocked, type AchievementStats } from "@/lib/domain/achievements";
import { LOCAL_FOODS } from "@/lib/content/foods";

const everyDay = [0, 1, 2, 3, 4, 5, 6];
const mwf = [1, 3, 5];

describe("dates & time zones", () => {
  it("maps the same instant to different calendar days by time zone", () => {
    const instant = new Date("2026-10-13T02:30:00Z");
    expect(dateKey(instant, "UTC")).toBe("2026-10-13");
    expect(dateKey(instant, "America/Los_Angeles")).toBe("2026-10-12");
    expect(dateKey(instant, "Asia/Tokyo")).toBe("2026-10-13");
  });
  it("falls back to UTC for invalid zones", () => {
    expect(dateKey(new Date("2026-10-13T02:30:00Z"), "Not/AZone")).toBe("2026-10-13");
  });
  it("computes Monday week starts", () => {
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // Sunday → previous Monday
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
  });
});

describe("streaks", () => {
  it("counts consecutive active days", () => {
    const r = computeStreak({ activeDays: ["2026-10-10", "2026-10-11", "2026-10-12"], trainingDays: everyDay, today: "2026-10-12" });
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });

  it("keeps the streak across planned rest days", () => {
    // Mon, Wed, Fri training; Tue/Thu are planned rest
    const r = computeStreak({ activeDays: ["2026-10-12", "2026-10-14", "2026-10-16"], trainingDays: mwf, today: "2026-10-16" });
    expect(r.current).toBe(5);
  });

  it("treats logged rest days as part of the streak", () => {
    const r = computeStreak({
      activeDays: ["2026-10-12", "2026-10-14"],
      restDays: ["2026-10-13"],
      trainingDays: everyDay,
      today: "2026-10-14",
      graceDaysPerWeek: 0,
    });
    expect(r.current).toBe(3);
  });

  it("forgives one missed planned day per week but not two", () => {
    const one = computeStreak({ activeDays: ["2026-10-12", "2026-10-14"], trainingDays: everyDay, today: "2026-10-14" });
    expect(one.current).toBe(3);
    expect(one.graceUsedThisWeek).toBe(1);
    const two = computeStreak({ activeDays: ["2026-10-12", "2026-10-15"], trainingDays: everyDay, today: "2026-10-15" });
    expect(two.current).toBe(1);
    expect(two.longest).toBe(2); // active day + forgiven day, then the second miss breaks it
  });

  it("does not break the streak for today before the day is over", () => {
    const r = computeStreak({ activeDays: ["2026-10-12", "2026-10-13"], trainingDays: everyDay, today: "2026-10-14", graceDaysPerWeek: 0 });
    expect(r.current).toBe(2);
    expect(r.todayPending).toBe(true);
  });

  it("does not start a streak on rest days before any activity", () => {
    const r = computeStreak({ activeDays: [], restDays: ["2026-10-12"], trainingDays: everyDay, today: "2026-10-12" });
    expect(r.current).toBe(0);
  });

  it("follows the user's time zone for late-night workouts", () => {
    // Workouts logged at 23:30 local time in Los Angeles on three consecutive evenings
    const instants = ["2026-10-13T06:30:00Z", "2026-10-14T06:30:00Z", "2026-10-15T06:30:00Z"].map((i) => new Date(i));
    const la = instants.map((i) => dateKey(i, "America/Los_Angeles"));
    expect(la).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    const r = computeStreak({ activeDays: la, trainingDays: everyDay, today: "2026-10-14", graceDaysPerWeek: 0 });
    expect(r.current).toBe(3);
  });

  it("computes weekly consistency and weekly streaks", () => {
    expect(weeklyConsistency(["2026-10-12", "2026-10-13", "2026-10-05"], "2026-10-14", 3)).toEqual({ done: 2, target: 3, percent: 67 });
    const days: string[] = [];
    for (let w = 0; w < 4; w++) for (let d = 0; d < 3; d++) days.push(addDays("2026-09-21", w * 7 + d * 2));
    expect(weeklyStreak(days, "2026-10-16", 3)).toBe(4);
    expect(weeklyStreak(days, "2026-10-20", 3)).toBe(4); // current week not met yet doesn't reset
  });
});

describe("energy estimates", () => {
  it("uses net MET × mass × time with an uncertainty band", () => {
    const e = exerciseKcal(8, 60, 80);
    expect(e.mid).toBe(560); // (8 - 1) × 80 × 1
    expect(e.low).toBeLessThan(e.mid);
    expect(e.high).toBeGreaterThan(e.mid);
    expect(e.assumedMass).toBe(false);
  });
  it("widens the range when body mass is unknown", () => {
    const e = exerciseKcal(4, 30);
    expect(e.assumedMass).toBe(true);
    expect((e.high - e.low) / e.mid).toBeGreaterThan(0.6);
  });
  it("derives running intensity from pace", () => {
    expect(runningMetFromPace(10, 60)).toBe(10);
    expect(runningMetFromPace(4, 60)).toBeNull(); // walking pace
  });
  it("estimates TDEE only when inputs are present", () => {
    expect(estimateTdee({ weightKg: 70 })).toBeNull();
    const t = estimateTdee({ weightKg: 70, heightCm: 175, ageRange: "25-34", sex: "male", activityLevel: "moderate" })!;
    // (10×70 + 6.25×175 − 5×30 + 5) × 1.55 ≈ 2549
    expect(t.mid).toBeGreaterThan(2500);
    expect(t.mid).toBeLessThan(2600);
  });
  it("never suggests a calorie deficit for under-18s", () => {
    const stats = { weightKg: 60, heightCm: 170, ageRange: "under18", sex: "male", activityLevel: "active" };
    const g = calorieGuidance(stats, ["fat_loss"]);
    expect(g.target).toBe(estimateTdee(stats)!.mid);
    expect(g.note).toMatch(/still growing/);
  });
  it("keeps fat-loss deficits modest", () => {
    const stats = { weightKg: 90, heightCm: 180, ageRange: "35-44", sex: "female", activityLevel: "light" };
    expect(calorieGuidance(stats, ["fat_loss"]).target!).toBeGreaterThanOrEqual(Math.round(estimateTdee(stats)!.mid * 0.85) - 1);
  });
});

describe("nutrition", () => {
  const rice = { kcalPer100g: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3 };
  it("scales nutrients by portion", () => {
    expect(scalePortion(rice, 158)).toEqual({ kcal: 205, proteinG: 4.3, carbsG: 44.6, fatG: 0.5 });
    expect(scalePortion(rice, 0).kcal).toBe(0);
  });
  it("summarises a day by meal", () => {
    const s = daySummary([
      { meal: "breakfast", kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 },
      { meal: "breakfast", kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 },
      { meal: "dinner", kcal: 600, proteinG: 40, carbsG: 50, fatG: 20 },
    ]);
    expect(s.total.kcal).toBe(1000);
    expect(s.byMeal.breakfast.proteinG).toBe(25);
    expect(s.byMeal.lunch.kcal).toBe(0);
  });
  it("parses free-text meals into low/medium confidence items", () => {
    const items = parseMealText("2 boiled eggs, 150g white rice and a banana", LOCAL_FOODS);
    expect(items).toHaveLength(3);
    expect(items[0].matchName).toMatch(/Egg/);
    expect(items[0].grams).toBe(100);
    expect(items[1].grams).toBe(150);
    expect(items[1].confidence).toBe("medium");
    expect(items[2].matchName).toBe("Banana");
    expect(items.every((i) => i.confidence !== ("high" as string))).toBe(true);
  });
});

describe("readiness", () => {
  it("scores well-rested users higher", () => {
    const good = readinessScore({ sleepHours: 8, energy: 5, soreness: 1, stress: 1 });
    const poor = readinessScore({ sleepHours: 4, energy: 1, soreness: 5, stress: 5 });
    expect(good).toBe(100);
    expect(poor).toBe(0);
  });
  it("recommends rest whenever pain is reported", () => {
    const s = readinessScore({ sleepHours: 8, energy: 5, soreness: 1, pain: true });
    expect(readinessBand(s, true)).toBe("rest");
  });
});

describe("levels & achievements", () => {
  it("computes levels from XP", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(3)).level).toBe(3);
    expect(levelFromXp(xpForLevel(3) - 1).level).toBe(2);
  });
  it("unlocks achievements only from recorded stats", () => {
    const zero: AchievementStats = {
      workoutsCompleted: 0, pushupRepsTotal: 0, maxPullupReps: 0, maxPlankSeconds: 0, longestStreak: 0, bestWeeklyStreak: 0,
      skillsUnlocked: 0, weeklyReviews: 0, mobilitySessions: 0, personalRecords: 0, activitiesLogged: 0, sportsTried: 0,
    };
    expect(newlyUnlocked(zero, new Set())).toHaveLength(0);
    const some = { ...zero, workoutsCompleted: 1, pushupRepsTotal: 120, maxPlankSeconds: 61 };
    expect(newlyUnlocked(some, new Set()).map((a) => a.key).sort()).toEqual(["first_workout", "plank_60", "pushups_100"]);
    expect(newlyUnlocked(some, new Set(["first_workout"])).map((a) => a.key)).not.toContain("first_workout");
    expect(ACHIEVEMENTS.find((a) => a.key === "pushups_100")!.progress({ ...zero, pushupRepsTotal: 40 })).toEqual([40, 100]);
  });
});
