import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { cleanDecimal, parseBody, switchUnits, type BodyFields } from "@/lib/body-input";
import { call, newUser } from "./helpers";
import * as onboarding from "@/app/api/onboarding/route";
import * as today from "@/app/api/workouts/today/route";
import * as roadmap from "@/app/api/roadmap/route";

beforeAll(async () => {
  await seed(db);
});

/** The production report: Intermediate · Full Body · all seven goals · 6×75 min · a mix · box/stairs + pull-up bar. */
const reported = {
  experience: "intermediate",
  startFromZero: false,
  goals: ["general_fitness", "calisthenics", "muscle", "strength", "sport_conditioning", "posture", "mobility"],
  emphasis: "full_body",
  sports: [],
  location: "mixed",
  equipment: ["box", "pullup_bar"],
  daysPerWeek: 6,
  trainingDays: [],
  sessionMinutes: 75,
  activityLevel: "moderate",
  limitations: [],
  exercisePrefs: [],
  dietPrefs: [],
  allergies: [],
  units: "metric",
  timezone: "UTC",
};
const fresh = () => newUser({}, false);

describe("onboarding: the reported configuration", () => {
  it("creates the profile, today's plan and the 24-week roadmap with the right units", async () => {
    const { cookie, userId } = await fresh();
    const r = await call(onboarding.POST, { cookie, body: { ...reported, heightCm: 178.5, weightKg: 72.5 } });
    expect(r.status).toBe(200);
    const p = await db.profile.findUniqueOrThrow({ where: { userId } });
    expect(p).toMatchObject({ experience: "intermediate", emphasis: "full_body", daysPerWeek: 6, sessionMinutes: 75, location: "mixed", heightCm: 178.5, weightKg: 72.5, onboardingCompleted: true });
    expect(JSON.parse(p.goals)).toHaveLength(7);
    expect(JSON.parse(p.equipment)).toEqual(["box", "pullup_bar"]);
    expect(JSON.parse(p.trainingDays)).toHaveLength(6); // six sessions → six training days, not minutes or weeks

    const t = await call(today.GET, { cookie });
    expect(t.status).toBe(200);
    const w = t.json.workout;
    const slugs = [...w.warmup, ...w.main, ...w.cooldown].map((b: { exercise: string }) => b.exercise);
    const ex = await db.exercise.findMany({ where: { slug: { in: slugs } }, select: { slug: true, equipment: true } });
    for (const e of ex) for (const need of JSON.parse(e.equipment) as string[]) expect(["box", "pullup_bar"], `${e.slug} needs ${need}`).toContain(need);
    expect(w.estimatedMinutes).toBeGreaterThan(0);
    expect(w.estimatedMinutes).toBeLessThanOrEqual(75 + 10);

    const rm = (await call(roadmap.GET, { cookie })).json;
    expect(rm.state.week).toBe(1); // weeks, starting today
    expect(rm.state.phase.index).toBe(1);
    expect(rm.phases).toHaveLength(6);
    expect(rm.phases[rm.phases.length - 1].weeks).toEqual([21, 24]); // a 24-week roadmap
    expect(rm.thisWeek.planned).toBe(6); // sessions per week
  });

  it("the production failure: a height mis-converted to over 250 cm is refused with a field message and nothing is saved", async () => {
    const { cookie, userId } = await fresh();
    for (const heightCm of [457.2, 1785, 1297.9]) {
      const r = await call(onboarding.POST, { cookie, body: { ...reported, heightCm } });
      expect(r.status).toBe(400);
      expect(r.json.error.details).toEqual({ heightCm: ["Height must be between 100 and 250 cm"] });
    }
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).onboardingCompleted).toBe(false);
    expect(await db.bodyMeasurement.count({ where: { userId } })).toBe(0);
    expect(await db.workoutPlan.count({ where: { userId } })).toBe(0);
  });

  it("retrying (or double-clicking) creates no duplicates", async () => {
    const { cookie, userId } = await fresh();
    const body = { ...reported, heightCm: 180, weightKg: 80 };
    const results = await Promise.all([1, 2].map(() => call(onboarding.POST, { cookie, body })));
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await call(onboarding.POST, { cookie, body })).status).toBe(200);
    expect(await db.bodyMeasurement.count({ where: { userId } })).toBe(1);
    await Promise.all([1, 2, 3].map(() => call(today.GET, { cookie })));
    expect(await db.workoutPlan.count({ where: { userId, status: { not: "archived" } } })).toBe(1);
  });
});

describe("onboarding: field validation and boundaries", () => {
  const status = async (patch: Record<string, unknown>) => {
    const { cookie } = await fresh();
    const r = await call(onboarding.POST, { cookie, body: { ...reported, ...patch } });
    return { status: r.status, details: r.json.error?.details as Record<string, string[]> | undefined };
  };
  it.each([
    [{ heightCm: 100 }, 200],
    [{ heightCm: 250 }, 200],
    [{ weightKg: 25 }, 200],
    [{ weightKg: 350 }, 200],
    [{ sessionMinutes: 10 }, 200],
    [{ sessionMinutes: 120 }, 200],
    [{ daysPerWeek: 1 }, 200],
    [{ daysPerWeek: 7 }, 200],
    [{ heightCm: null, weightKg: null }, 200],
  ])("accepts %o", async (patch, code) => {
    expect((await status(patch)).status).toBe(code);
  });
  it.each([
    [{ heightCm: 99.9 }, "heightCm", /Height must be between 100 and 250 cm/],
    [{ heightCm: 250.1 }, "heightCm", /Height must be between 100 and 250 cm/],
    [{ heightCm: "180" }, "heightCm", /Height must be a number/],
    [{ weightKg: 24.9 }, "weightKg", /Weight must be between 25 and 350 kg/],
    [{ weightKg: 350.1 }, "weightKg", /Weight must be between 25 and 350 kg/],
    [{ sessionMinutes: 9 }, "sessionMinutes", /Session length must be between 10 and 120 minutes/],
    [{ sessionMinutes: 121 }, "sessionMinutes", /Session length must be between 10 and 120 minutes/],
    [{ sessionMinutes: 75.5 }, "sessionMinutes", /whole minutes/],
    [{ daysPerWeek: 0 }, "daysPerWeek", /between 1 and 7/],
    [{ daysPerWeek: 8 }, "daysPerWeek", /between 1 and 7/],
  ])("refuses %o with a message on %s", async (patch, field, message) => {
    const r = await status(patch);
    expect(r.status).toBe(400);
    expect(Object.keys(r.details ?? {})).toEqual([field]);
    expect(r.details![field][0]).toMatch(message);
  });
});

describe("height and weight entry (what the wizard sends)", () => {
  const f = (o: Partial<BodyFields>): BodyFields => ({ units: "metric", height: "", heightFt: "", heightIn: "", weight: "", ...o });
  it("keeps a decimal comma as a decimal, never as an extra digit", () => {
    expect(cleanDecimal("178,5")).toBe("178.5");
    expect(cleanDecimal("72,5 kg")).toBe("72.5");
    expect(cleanDecimal("1.7.8")).toBe("1.78");
    expect(parseBody(f({ height: "178,5", weight: "72,5" }))).toEqual({ heightCm: 178.5, weightKg: 72.5, errors: {} });
  });
  it("imperial height is feet + inches; inches 12+ are refused", () => {
    expect(parseBody(f({ units: "imperial", heightFt: "5", heightIn: "11", weight: "160" }))).toEqual({ heightCm: 180.3, weightKg: 72.6, errors: {} });
    expect(parseBody(f({ units: "imperial", heightFt: "5", heightIn: "13" })).errors.height).toMatch(/Inches must be 0–11/);
  });
  it("switching units converts what was typed (the production bug: 180 cm became 180 inches)", () => {
    const imperial = switchUnits(f({ height: "180", weight: "80" }), "imperial");
    expect(imperial).toMatchObject({ units: "imperial", heightFt: "5", heightIn: "11", weight: "176" });
    expect(parseBody(imperial).heightCm).toBeGreaterThan(179);
    expect(parseBody(imperial).heightCm).toBeLessThan(181);
    const back = switchUnits(imperial, "metric");
    expect(Number(back.height)).toBeCloseTo(180.3, 1);
  });
  it("out-of-range entries are explained in the user's units, not sent", () => {
    expect(parseBody(f({ height: "1785" }))).toMatchObject({ heightCm: null, errors: { height: "Height must be 100–250 cm." } });
    expect(parseBody(f({ units: "imperial", heightFt: "15" })).errors.height).toMatch(/ft .* in – .* ft/);
    expect(parseBody(f({ weight: "720" })).errors.weight).toMatch(/25–350 kg/);
    expect(parseBody(f({}))).toEqual({ heightCm: null, weightKg: null, errors: {} });
  });
});

describe("energy ranges", () => {
  it("a small estimate stays a range rather than collapsing to a single number", async () => {
    const { exerciseKcal } = await import("@/lib/domain/energy");
    const e = exerciseKcal(4, 0.5, 70); // half a minute of moderate work ≈ 2 kcal
    expect(e.mid).toBeGreaterThan(0);
    expect(e.low).toBeLessThan(e.high);
    expect(exerciseKcal(4, 0, 70)).toMatchObject({ low: 0, high: 0 }); // nothing done → nothing estimated
  });
});
