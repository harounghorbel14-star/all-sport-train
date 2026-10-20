import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { invalidateSportsCache } from "@/lib/services/sports";
import { addDays, todayKey, weekStart } from "@/lib/domain/dates";
import { evaluateConsistency, evaluateMeasured, type GoalSpec } from "@/lib/domain/goals";
import { call, newUser, passQuiz } from "./helpers";
import * as goals from "@/app/api/goals/route";
import * as goalItem from "@/app/api/goals/[id]/route";
import * as metrics from "@/app/api/sports/[slug]/metrics/route";
import * as metricItem from "@/app/api/sport-metrics/[id]/route";
import * as lesson from "@/app/api/sports/[slug]/lessons/[lesson]/route";
import * as account from "@/app/api/account/export/route";

beforeAll(async () => {
  await seed(db);
  invalidateSportsCache();
});

const T = todayKey("UTC");
const spec = (o: Partial<GoalSpec> = {}): GoalSpec => ({ kind: "exercise", direction: "higher", baseline: 10, baselineSource: "logged", baselineDate: "2026-01-01", target: 20, createdOn: "2026-01-01", ...o });

describe("goal evaluation (pure)", () => {
  it("tracks milestones between the starting point and the target, from logged bests only", () => {
    const e = evaluateMeasured(spec(), [{ dateKey: "2026-01-05", value: 12, source: "logged" }, { dateKey: "2026-01-12", value: 15, source: "logged" }, { dateKey: "2026-01-19", value: 14, source: "logged" }], "2026-01-20");
    expect(e.current).toBe(15);
    expect(e.progress).toBe(0.5);
    expect(e.milestones.map((m) => m.reachedOn)).toEqual(["2026-01-12", "2026-01-12", null, null]);
    expect(e.achieved).toBe(false);
  });

  it("handles lower-is-better results and never invents a starting point", () => {
    const none = evaluateMeasured(spec({ direction: "lower", baseline: null, baselineSource: null, baselineDate: null, target: 1500 }), [], "2026-01-02");
    expect(none.progress).toBeNull();
    expect(none.notes.map((n) => n.code)).toEqual(expect.arrayContaining(["no_baseline", "no_data"]));
    const first = evaluateMeasured(spec({ direction: "lower", baseline: null, baselineSource: null, baselineDate: null, target: 1500 }), [{ dateKey: "2026-01-03", value: 1800, source: "self_reported" }, { dateKey: "2026-01-10", value: 1650, source: "self_reported" }], "2026-01-11");
    expect(first.baseline).toBe(1800);
    expect(first.baselineSource).toBe("first_logged");
    expect(first.progress).toBe(0.5);
    expect(first.notes.map((n) => n.code)).toEqual(expect.arrayContaining(["baseline_first_logged", "self_reported", "few_results"]));
  });

  it("says when a target date passed instead of predicting anything", () => {
    const e = evaluateMeasured(spec({ targetDate: "2026-01-10" }), [{ dateKey: "2026-01-05", value: 11, source: "logged" }], "2026-02-01");
    expect(e.notes).toContainEqual({ code: "target_date_passed", dateKey: "2026-01-10" });
  });

  it("consistency counts only finished weeks, in a row", () => {
    const weeks = [
      { weekStart: "2026-01-05", sessions: 3 },
      { weekStart: "2026-01-12", sessions: 1 },
      { weekStart: "2026-01-19", sessions: 3 },
      { weekStart: "2026-01-26", sessions: 4 },
      { weekStart: "2026-02-02", sessions: 5 }, // current week: shown, not counted
    ];
    const e = evaluateConsistency(spec({ kind: "consistency", target: 3, periodWeeks: 3, baseline: null }), weeks, "2026-02-02", "2026-02-03");
    expect(e.current).toBe(2);
    expect(e.achieved).toBe(false);
    expect(e.notes).toContainEqual({ code: "this_week_partial", count: 5 });
  });
});

describe("goals API", () => {
  it("measures a sport goal from logged results, and follows corrections both ways", async () => {
    const { cookie, userId } = await newUser();
    const log = (value: number) => call(metrics.POST, { cookie, params: { slug: "running" }, body: { metricKey: "time_5k", value, dateKey: T } });
    await log(1800);
    const created = await call(goals.POST, { cookie, body: { kind: "sport_metric", sportSlug: "running", metricKey: "time_5k", target: 1500 } });
    expect(created.status).toBe(200);
    expect(created.json.goal.baseline).toBe(1800);
    expect(created.json.goal.baselineSource).toBe("logged");
    expect(created.json.goal.direction).toBe("lower");

    const entry = await log(1650);
    let list = await call(goals.GET, { cookie });
    let g = list.json.goals[0];
    expect(g.evaluation.progress).toBe(0.5);
    expect(g.evaluation.notes.map((n: { code: string }) => n.code)).toContain("self_reported");

    await call(metricItem.PATCH, { method: "PATCH", cookie, params: { id: entry.json.entry.id }, body: { value: 1490 } });
    list = await call(goals.GET, { cookie });
    g = list.json.goals[0];
    expect(g.evaluation.achieved).toBe(true);
    expect(g.achievedAt).not.toBeNull();

    // A correction that undoes the result also undoes the achievement.
    await call(metricItem.PATCH, { method: "PATCH", cookie, params: { id: entry.json.entry.id }, body: { value: 1700 } });
    g = (await call(goals.GET, { cookie })).json.goals[0];
    expect(g.evaluation.achieved).toBe(false);
    expect((await db.goal.findUniqueOrThrow({ where: { id: g.id } })).achievedAt).toBeNull();
    expect(await db.goal.count({ where: { userId } })).toBe(1);
  });

  it("validates goals against real definitions", async () => {
    const { cookie } = await newUser();
    const bad = async (body: unknown) => (await call(goals.POST, { cookie, body })).status;
    expect(await bad({ kind: "sport_metric", sportSlug: "running", metricKey: "time_5k", target: 100 })).toBe(400); // below the metric's range
    expect(await bad({ kind: "sport_metric", sportSlug: "running", metricKey: "sessionType", target: 1 })).toBe(400); // not measurable
    expect(await bad({ kind: "exercise", exerciseSlug: "no-such-exercise", metric: "reps", target: 10 })).toBe(400);
    expect(await bad({ kind: "consistency", target: 3, targetDate: addDays(T, -1) })).toBe(400);
    expect(await bad({ kind: "lesson", sportSlug: "running", lessonSlug: "nope" })).toBe(400);
  });

  it("starts exercise goals without a baseline until one is logged, and labels a reported one", async () => {
    const { cookie } = await newUser();
    const ex = await db.exercise.findFirstOrThrow({ select: { slug: true } });
    const none = await call(goals.POST, { cookie, body: { kind: "exercise", exerciseSlug: ex.slug, metric: "reps", target: 20 } });
    expect(none.json.goal.baseline).toBeNull();
    const reported = await call(goals.POST, { cookie, body: { kind: "exercise", exerciseSlug: ex.slug, metric: "reps", target: 20, baseline: 8 } });
    expect(reported.json.goal.baselineSource).toBe("self_reported");
    const list = (await call(goals.GET, { cookie })).json.goals;
    const withNone = list.find((g: { id: string }) => g.id === none.json.goal.id);
    expect(withNone.evaluation.progress).toBeNull();
    expect(withNone.evaluation.notes.map((n: { code: string }) => n.code)).toContain("no_baseline");
  });

  it("abandons and restores goals without losing them, with an audit trail", async () => {
    const { cookie, userId } = await newUser();
    const g = (await call(goals.POST, { cookie, body: { kind: "consistency", target: 3, periodWeeks: 4 } })).json.goal;
    expect(g.title).toMatch(/3× a week/);
    const fresh = (await call(goals.GET, { cookie })).json.goals[0];
    expect(fresh.evaluation.notes).toContainEqual({ code: "this_week_partial", count: 0 });
    expect(fresh.evaluation.history[0].dateKey).toBe(weekStart(T));

    expect((await call(goalItem.PATCH, { method: "PATCH", cookie, params: { id: g.id }, body: { status: "abandoned", reason: "injury break" } })).status).toBe(200);
    expect((await call(goals.GET, { cookie })).json.goals).toHaveLength(0);
    expect((await call(goals.GET, { cookie, path: "/api/goals?all=1" })).json.goals).toHaveLength(1);
    await call(goalItem.PATCH, { method: "PATCH", cookie, params: { id: g.id }, body: { status: "active", target: 2 } });
    const log = await db.recordCorrection.findMany({ where: { userId, recordType: "goal", recordId: g.id }, orderBy: { createdAt: "asc" } });
    expect(log).toHaveLength(2);
    expect(JSON.parse(log[1].before)).toEqual({ status: "abandoned", target: 3 });
    expect((await call(goalItem.PATCH, { method: "PATCH", cookie, params: { id: g.id }, body: { target: 2.5 } })).status).toBe(400);
    expect((await call(goalItem.PATCH, { method: "PATCH", cookie, params: { id: g.id }, body: {} })).status).toBe(400);
  });

  it("lesson goals complete only when the lesson does, and say how it was completed", async () => {
    const { cookie } = await newUser();
    const g = (await call(goals.POST, { cookie, body: { kind: "lesson", sportSlug: "running", lessonSlug: "run-walk-start" } })).json.goal;
    expect((await call(goalItem.GET, { cookie, params: { id: g.id } })).json.goal.evaluation.achieved).toBe(false);
    await call(lesson.POST, { cookie, params: { slug: "running", lesson: "run-walk-start" }, body: { status: "completed" } });
    // The lesson has a progress test (run 1 km), so marking it done isn't enough.
    let e = (await call(goalItem.GET, { cookie, params: { id: g.id } })).json.goal.evaluation;
    expect(e.achieved).toBe(false);
    expect(e.notes.map((n: { code: string }) => n.code)).toContain("lesson_awaiting_assessment");
    expect((await passQuiz(cookie, "running", "run-walk-start")).json.lesson).toBe("awaiting_assessment"); // the run is still needed
    await call(metrics.POST, { cookie, params: { slug: "running" }, body: { metricKey: "longest_run", value: 1.2, dateKey: T } });
    e = (await call(goalItem.GET, { cookie, params: { id: g.id } })).json.goal.evaluation;
    expect(e.achieved).toBe(true);
    expect(e.notes.map((n: { code: string }) => n.code)).not.toContain("self_reported"); // assessed by the logged result
  });

  it("never shows or changes another user's goals, and includes goals in the export", async () => {
    const a = await newUser();
    const b = await newUser();
    const g = (await call(goals.POST, { cookie: a.cookie, body: { kind: "consistency", target: 2 } })).json.goal;
    expect((await call(goalItem.GET, { cookie: b.cookie, params: { id: g.id } })).status).toBe(404);
    expect((await call(goalItem.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: g.id }, body: { status: "abandoned" } })).status).toBe(404);
    expect((await call(goals.GET, { cookie: b.cookie })).json.goals).toHaveLength(0);
    const exp = await call(account.GET, { cookie: a.cookie });
    expect(JSON.stringify(exp.json)).toContain(g.id);
  });
});
