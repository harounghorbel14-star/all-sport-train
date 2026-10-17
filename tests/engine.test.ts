import { describe, expect, it } from "vitest";
import { EXERCISE_BY_SLUG, EXERCISE_CATALOG } from "@/lib/content/exercises";
import { generateWorkout, substitutesFor, toEngineExercise, estimateMinutes, workingLevel } from "@/lib/engine/generator";
import type { EngineProfile } from "@/lib/engine/types";
import { roadmapState, reviewAdjustment } from "@/lib/engine/roadmap";

const exercises = EXERCISE_CATALOG.map(toEngineExercise);
const base: EngineProfile = {
  experience: "beginner",
  startFromZero: false,
  goals: ["general_fitness"],
  emphasis: "balanced_calisthenics",
  equipment: [],
  location: "home",
  sessionMinutes: 30,
  daysPerWeek: 3,
  trainingDays: [1, 3, 5],
  limitations: [],
  exercisePrefs: [],
};
const opts = { date: "2026-10-12", dayIndex: 0, history: {}, readinessVolume: 1 };

describe("workout generator", () => {
  it("produces a complete workout with warm-up, main work and cooldown", () => {
    const w = generateWorkout(exercises, base, opts);
    expect(w.warmup.length).toBeGreaterThan(0);
    expect(w.main.length).toBeGreaterThanOrEqual(3);
    expect(w.cooldown.length).toBeGreaterThan(0);
    for (const b of w.main) {
      expect(EXERCISE_BY_SLUG.has(b.exercise)).toBe(true);
      expect(b.sets).toBeGreaterThan(0);
      expect(b.restSeconds).toBeGreaterThanOrEqual(0);
      expect(b.seconds != null || (b.repMin != null && b.repMax != null)).toBe(true);
    }
  });

  it("never selects exercises that need equipment the user does not own", () => {
    for (let day = 0; day < 6; day++) {
      const w = generateWorkout(exercises, base, { ...opts, dayIndex: day });
      for (const b of [...w.warmup, ...w.main, ...w.cooldown]) {
        expect(EXERCISE_BY_SLUG.get(b.exercise)!.equipment ?? []).toEqual([]);
      }
    }
  });

  it("uses a pull-up bar only when selected", () => {
    const withBar = { ...base, equipment: ["pullup_bar"] };
    const all = [0, 1, 2].flatMap((d) => generateWorkout(exercises, withBar, { ...opts, dayIndex: d }).main);
    expect(all.some((b) => (EXERCISE_BY_SLUG.get(b.exercise)!.equipment ?? []).includes("pullup_bar"))).toBe(true);
  });

  it("excludes exercises contraindicated by the user's limitations", () => {
    const p = { ...base, limitations: ["wrist", "knee"] };
    for (let day = 0; day < 3; day++) {
      const w = generateWorkout(exercises, p, { ...opts, dayIndex: day });
      for (const b of w.main) {
        const c = EXERCISE_BY_SLUG.get(b.exercise)!.contraindications ?? [];
        expect(c.includes("wrist") || c.includes("knee")).toBe(false);
      }
    }
  });

  it("keeps start-from-zero sessions short, gentle and low difficulty", () => {
    const p = { ...base, experience: "zero" as const, startFromZero: true, sessionMinutes: 45 };
    const w = generateWorkout(exercises, p, opts);
    expect(w.estimatedMinutes).toBeLessThanOrEqual(28);
    for (const b of w.main) {
      expect(EXERCISE_BY_SLUG.get(b.exercise)!.difficulty).toBeLessThanOrEqual(2);
      expect(b.sets).toBeLessThanOrEqual(2);
    }
  });

  it("respects the session time budget", () => {
    for (const minutes of [15, 20, 30, 45]) {
      const w = generateWorkout(exercises, { ...base, sessionMinutes: minutes, experience: "intermediate" }, opts);
      expect(w.estimatedMinutes).toBeLessThanOrEqual(minutes + 3 + 8); // small blocks can't be trimmed further
      expect(estimateMinutes(w)).toBe(w.estimatedMinutes);
    }
  });

  it("returns a recovery session when readiness says rest", () => {
    const w = generateWorkout(exercises, base, { ...opts, readinessVolume: 0, readinessBand: "rest" });
    expect(w.dayType).toBe("recovery");
    expect(w.main.every((b) => EXERCISE_BY_SLUG.get(b.exercise)!.category === "mobility")).toBe(true);
  });

  it("reduces volume on easy readiness days", () => {
    const p = { ...base, experience: "advanced" as const };
    const normal = generateWorkout(exercises, p, opts);
    const easy = generateWorkout(exercises, p, { ...opts, readinessVolume: 0.6, readinessBand: "easy" });
    const sum = (w: typeof normal) => w.main.reduce((s, b) => s + b.sets, 0) / w.main.length;
    expect(sum(easy)).toBeLessThan(sum(normal));
  });

  it("is deterministic for the same day", () => {
    expect(generateWorkout(exercises, base, opts)).toEqual(generateWorkout(exercises, base, opts));
  });

  it("includes lower body in V-taper programs", () => {
    const p = { ...base, emphasis: "v_taper" as const, equipment: ["pullup_bar", "dumbbells"] };
    const week = [0, 1, 2].flatMap((d) => generateWorkout(exercises, p, { ...opts, dayIndex: d }).main);
    const patterns = week.map((b) => EXERCISE_BY_SLUG.get(b.exercise)!.movementPattern);
    expect(patterns.some((pt) => ["squat", "lunge", "hinge"].includes(pt))).toBe(true);
    expect(patterns).toContain("vertical_pull");
  });

  it("avoids muscles the user reports as tired", () => {
    const w = generateWorkout(exercises, { ...base, equipment: ["pullup_bar"] }, { ...opts, avoidMuscles: ["front_delts", "side_delts"] });
    for (const b of w.main) expect(EXERCISE_BY_SLUG.get(b.exercise)!.primaryMuscles).not.toContain("front_delts");
  });
});

describe("progression", () => {
  const pushGroup = exercises.filter((e) => e.progressionGroup === "push");
  it("progresses only after repeated top-of-range sessions with manageable effort", () => {
    const h = { "knee-push-up": { sessions: 4, recentTopHits: 2, recentMisses: 0, lastRpe: 7 } };
    expect(workingLevel(pushGroup, base, h, true)).toEqual({ level: 4, progression: "progress" });
  });
  it("does not progress when effort was very high", () => {
    const h = { "knee-push-up": { sessions: 4, recentTopHits: 2, recentMisses: 0, lastRpe: 9 } };
    expect(workingLevel(pushGroup, base, h, true).progression).toBe("hold");
  });
  it("does not progress on low-readiness days", () => {
    const h = { "knee-push-up": { sessions: 4, recentTopHits: 3, recentMisses: 0, lastRpe: 6 } };
    expect(workingLevel(pushGroup, base, h, false).progression).toBe("hold");
  });
  it("regresses after repeated misses", () => {
    const h = { "push-up": { sessions: 3, recentTopHits: 0, recentMisses: 2, lastRpe: 9 } };
    expect(workingLevel(pushGroup, base, h, true)).toEqual({ level: 3, progression: "regress" });
  });
  it("applies progression in the generated workout", () => {
    const history = { "knee-push-up": { sessions: 4, recentTopHits: 2, recentMisses: 0, lastRpe: 7, lastReps: 15 } };
    const w = generateWorkout(exercises, base, { ...opts, history });
    const push = w.main.find((b) => EXERCISE_BY_SLUG.get(b.exercise)!.progressionGroup === "push");
    expect(push?.exercise).toBe("push-up");
    expect(push?.progression).toBe("progress");
  });
});

describe("substitutions", () => {
  it("offers same-pattern alternatives that respect equipment", () => {
    const subs = substitutesFor("push-up", exercises, base);
    expect(subs.length).toBeGreaterThan(0);
    for (const s of subs) {
      expect(s.movementPattern).toBe("horizontal_push");
      expect(s.equipment).toEqual([]);
    }
  });
});

describe("roadmap", () => {
  it("maps weeks to phases and schedules deloads", () => {
    expect(roadmapState("2026-01-05", "2026-01-05").phase.index).toBe(1);
    expect(roadmapState("2026-01-05", "2026-02-02").week).toBe(5);
    expect(roadmapState("2026-01-05", "2026-02-02").phase.name).toBe("Base Strength");
    expect(roadmapState("2026-01-05", "2026-02-23").deload).toBe(true); // week 8
    expect(roadmapState("2026-01-05", "2026-01-26").deload).toBe(false); // week 4 (foundation) no deload
    expect(roadmapState("2026-01-05", "2026-02-02", 1).week).toBe(4); // repeated week
  });
  it("never escalates after a painful or very hard week", () => {
    expect(reviewAdjustment({ feeling: 3, difficulty: "right", sessionsDone: 3, sessionsPlanned: 3, painReported: true }).action).toBe("deload");
    expect(reviewAdjustment({ feeling: 4, difficulty: "too_hard", sessionsDone: 3, sessionsPlanned: 3, painReported: false }).action).toBe("repeat_week");
    expect(reviewAdjustment({ feeling: 5, difficulty: "too_easy", sessionsDone: 3, sessionsPlanned: 3, painReported: false }).action).toBe("progress");
    expect(reviewAdjustment({ feeling: 4, difficulty: "right", sessionsDone: 1, sessionsPlanned: 4, painReported: false }).action).toBe("repeat_week");
  });
});
