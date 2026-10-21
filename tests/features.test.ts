import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { invalidateSportsCache } from "@/lib/services/sports";
import { addDays, todayKey } from "@/lib/domain/dates";
import { call, newUser } from "./helpers";
import * as goals from "@/app/api/goals/route";
import * as quiz from "@/app/api/sports/[slug]/lessons/[lesson]/quiz/route";
import * as lesson from "@/app/api/sports/[slug]/lessons/[lesson]/route";
import * as templates from "@/app/api/templates/route";
import * as travel from "@/app/api/travel/route";
import * as catchUp from "@/app/api/calendar/catch-up/route";
import * as health from "@/app/api/health/route";
import { generateForUser } from "@/lib/services/workouts";

beforeAll(async () => {
  await seed(db);
  invalidateSportsCache();
});
afterEach(() => {
  delete process.env.FEATURES_DISABLED;
});

const T = todayKey("UTC");

describe("feature switches", () => {
  it("a switched-off feature refuses its API but keeps its data; switching back on shows it again", async () => {
    const { cookie, userId } = await newUser();
    await call(goals.POST, { cookie, body: { kind: "consistency", target: 2 } });
    process.env.FEATURES_DISABLED = "goals, templates ,travel,catch_up";
    const off = await call(goals.GET, { cookie });
    expect(off.status).toBe(404);
    expect(off.json.error.code).toBe("feature_disabled");
    expect((await call(templates.GET, { cookie })).status).toBe(404);
    expect((await call(travel.GET, { cookie })).status).toBe(404);
    expect((await call(catchUp.GET, { cookie })).status).toBe(404);
    expect(await db.goal.count({ where: { userId } })).toBe(1); // nothing deleted
    delete process.env.FEATURES_DISABLED;
    expect((await call(goals.GET, { cookie })).json.goals).toHaveLength(1);
  });

  it("with knowledge checks off, lessons don't wait on them", async () => {
    const { cookie } = await newUser();
    process.env.FEATURES_DISABLED = "quizzes";
    expect((await call(quiz.GET, { cookie, params: { slug: "boxing", lesson: "stance-guard" } })).status).toBe(404);
    const r = await call(lesson.POST, { cookie, params: { slug: "boxing", lesson: "stance-guard" }, body: { status: "completed" } });
    expect(r.json.status).toBe("completed");
    expect(r.json.evidence).toBe("self_reported");
    delete process.env.FEATURES_DISABLED;
    const { cookie: c2 } = await newUser();
    expect((await call(lesson.POST, { cookie: c2, params: { slug: "boxing", lesson: "stance-guard" }, body: { status: "completed" } })).json.status).toBe("awaiting_assessment");
  });

  it("with travel off, trips no longer change generated workouts", async () => {
    const { cookie, userId } = await newUser();
    await db.profile.update({ where: { userId }, data: { equipment: JSON.stringify(["dumbbells", "barbell", "bench"]), location: "gym" } });
    await call(travel.POST, { cookie, body: { startDate: T, endDate: addDays(T, 2), equipment: [], location: "home" } });
    expect((await generateForUser(userId, {}, T)).travel).not.toBeNull();
    process.env.FEATURES_DISABLED = "travel";
    expect((await generateForUser(userId, {}, T)).travel).toBeNull();
  });

  it("health reports switched-off and misspelt features without failing", async () => {
    process.env.FEATURES_DISABLED = "quizzes,quizes";
    const r = await call(health.GET as never, {});
    expect(r.json.features).toEqual({ disabled: ["quizzes"], unknown: ["quizes"] });
  });
});
