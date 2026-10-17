import { describe, expect, it } from "vitest";
import { EXERCISE_BY_SLUG, EXERCISE_CATALOG } from "@/lib/content/exercises";
import { SKILLS } from "@/lib/content/skills";
import { MOBILITY_ROUTINES } from "@/lib/content/mobility";
import { SPORTS } from "@/lib/content/sports";
import { LOCAL_FOODS } from "@/lib/content/foods";
import { kcalFromMacros } from "@/lib/domain/nutrition";

describe("content catalog integrity", () => {
  it("has unique exercise slugs", () => {
    expect(new Set(EXERCISE_CATALOG.map((e) => e.slug)).size).toBe(EXERCISE_CATALOG.length);
  });

  it("only references existing exercises in variations", () => {
    for (const e of EXERCISE_CATALOG) {
      for (const ref of [...(e.easier ?? []), ...(e.harder ?? []), ...(e.related ?? [])]) {
        expect(EXERCISE_BY_SLUG.has(ref), `${e.slug} → ${ref}`).toBe(true);
      }
    }
  });

  it("gives every exercise technique steps and common mistakes", () => {
    for (const e of EXERCISE_CATALOG) {
      expect(e.steps.length, e.slug).toBeGreaterThan(0);
      expect(e.mistakes.length, e.slug).toBeGreaterThan(0);
      expect(e.breathing.length, e.slug).toBeGreaterThan(0);
    }
  });

  it("references real exercises from skills and mobility routines", () => {
    for (const s of SKILLS) {
      for (const step of s.steps) {
        expect(EXERCISE_BY_SLUG.has(step.exercise), `${s.slug} step ${step.exercise}`).toBe(true);
        step.alternatives?.forEach((a) => expect(EXERCISE_BY_SLUG.has(a), a).toBe(true));
      }
      s.prerequisites.forEach((p) => expect(EXERCISE_BY_SLUG.has(p.exercise), p.exercise).toBe(true));
      s.supporting.forEach((x) => expect(EXERCISE_BY_SLUG.has(x), x).toBe(true));
    }
    for (const r of MOBILITY_ROUTINES) r.items.forEach((i) => expect(EXERCISE_BY_SLUG.has(i.exercise), i.exercise).toBe(true));
  });

  it("requires prerequisites and safety notes for advanced skills", () => {
    for (const s of SKILLS.filter((x) => x.difficulty >= 4)) {
      expect(s.prerequisites.length, s.slug).toBeGreaterThan(0);
      expect(s.safety.length, s.slug).toBeGreaterThan(0);
    }
  });

  it("has sane MET values for every sport intensity", () => {
    for (const s of SPORTS) {
      expect(s.met.light).toBeLessThanOrEqual(s.met.moderate);
      expect(s.met.moderate).toBeLessThanOrEqual(s.met.vigorous);
    }
  });

  it("has local foods whose energy roughly matches their macros", () => {
    for (const f of LOCAL_FOODS) {
      const fromMacros = kcalFromMacros({ proteinG: f.protein, carbsG: f.carbs, fatG: f.fat });
      // Atwater factors + fibre/alcohol rounding: allow a generous tolerance
      expect(Math.abs(fromMacros - f.kcal), f.name).toBeLessThan(Math.max(40, f.kcal * 0.2));
    }
  });
});
