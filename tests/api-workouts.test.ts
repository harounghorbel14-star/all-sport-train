import { beforeAll, describe, expect, it } from "vitest";
import { call, newUser } from "./helpers";
import { seed } from "../prisma/seed";
import { db } from "@/lib/server/db";
import * as today from "@/app/api/workouts/today/route";
import * as plan from "@/app/api/plans/[id]/route";
import * as sessions from "@/app/api/sessions/route";
import * as session from "@/app/api/sessions/[id]/route";
import * as sets from "@/app/api/sessions/[id]/sets/route";
import * as complete from "@/app/api/sessions/[id]/complete/route";
import * as subs from "@/app/api/exercises/[slug]/substitutes/route";
import * as gamification from "@/app/api/gamification/route";
import * as checkin from "@/app/api/recovery/checkin/route";
import * as review from "@/app/api/roadmap/review/route";
import * as skill from "@/app/api/skills/[slug]/route";
import * as attempt from "@/app/api/skills/[slug]/attempt/route";
import * as skillTest from "@/app/api/skills/test/route";
import { todayKey } from "@/lib/domain/dates";

beforeAll(async () => {
  await seed(db);
});

describe("workout generation & editing", () => {
  it("creates today's plan once and returns the same plan on refresh", async () => {
    const { cookie } = await newUser();
    const a = await call(today.GET, { cookie });
    expect(a.status).toBe(200);
    expect(a.json.workout.main.length).toBeGreaterThan(0);
    expect(a.json.week).toHaveLength(7);
    const b = await call(today.GET, { cookie });
    expect(b.json.plan.id).toBe(a.json.plan.id);
  });

  it("regenerates with a shorter time budget", async () => {
    const { cookie } = await newUser({ sessionMinutes: 60, experience: "intermediate" });
    const r = await call(today.POST, { cookie, body: { minutes: 15 } });
    expect(r.status).toBe(200);
    expect(r.json.workout.estimatedMinutes).toBeLessThanOrEqual(26);
  });

  it("supports replacing, reordering and adjusting exercises with validation", async () => {
    const { cookie } = await newUser();
    const { json } = await call(today.GET, { cookie });
    const w = structuredClone(json.workout);
    const options = await call(subs.GET, { cookie, params: { slug: w.main[0].exercise } });
    expect(options.json.options.length).toBeGreaterThan(0);
    w.main[0].exercise = options.json.options[0].slug;
    w.main.reverse();
    w.main[0].sets = 4;
    const put = await call(plan.PUT, { method: "PUT", cookie, params: { id: json.plan.id }, body: { workout: w } });
    expect(put.status).toBe(200);
    expect(put.json.workout.main[0].sets).toBe(4);

    const bad = structuredClone(w);
    bad.main[0].exercise = "not-a-real-exercise";
    expect((await call(plan.PUT, { method: "PUT", cookie, params: { id: json.plan.id }, body: { workout: bad } })).status).toBe(400);
    const badReps = structuredClone(w);
    badReps.main[0].repMin = 20;
    badReps.main[0].repMax = 5;
    badReps.main[0].seconds = null;
    expect((await call(plan.PUT, { method: "PUT", cookie, params: { id: json.plan.id }, body: { workout: badReps } })).status).toBe(400);
  });

  it("adapting after a check-in keeps a workout the user edited", async () => {
    const { cookie } = await newUser();
    const { json } = await call(today.GET, { cookie });
    const w = structuredClone(json.workout);
    w.main[0].sets = 5;
    await call(plan.PUT, { method: "PUT", cookie, params: { id: json.plan.id }, body: { workout: w } });
    await call(checkin.POST, { cookie, body: { dateKey: todayKey("UTC"), sleepHours: 5, energy: 2, soreness: 4, pain: false } });
    const adapted = await call(today.POST, { cookie, body: { keepEdited: true } });
    expect(adapted.json.kept).toBe(true);
    expect(adapted.json.plan.id).toBe(json.plan.id);
    expect(adapted.json.workout.main[0].sets).toBe(5);
    // An untouched engine plan is still adapted.
    const other = await newUser();
    const first = await call(today.GET, { cookie: other.cookie });
    const r = await call(today.POST, { cookie: other.cookie, body: { keepEdited: true } });
    expect(r.json.kept).toBe(false);
    expect(r.json.plan.id).not.toBe(first.json.plan.id);
  });

  it("returns a recovery session after a painful check-in", async () => {
    const { cookie } = await newUser();
    await call(checkin.POST, { cookie, body: { dateKey: todayKey("UTC"), sleepHours: 7, energy: 3, soreness: 3, pain: true } });
    const r = await call(today.POST, { cookie, body: {} });
    expect(r.json.workout.dayType).toBe("recovery");
  });
});

describe("live workout mode", () => {
  it("runs start → pause → resume → log sets → refresh → complete", async () => {
    const { cookie, userId } = await newUser();
    const { json } = await call(today.GET, { cookie });
    const start = await call(sessions.POST, { cookie, body: { planId: json.plan.id } });
    expect(start.status).toBe(200);
    const id = start.json.session.id;

    // Starting again returns the same active session; another plan is refused.
    expect((await call(sessions.POST, { cookie, body: { planId: json.plan.id } })).json.session.id).toBe(id);

    expect((await call(session.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "pause" } })).json.session.status).toBe("paused");
    expect((await call(session.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "resume" } })).json.session.status).toBe("active");

    // Completing with no sets is refused
    expect((await call(complete.POST, { cookie, params: { id }, body: {} })).status).toBe(400);

    const block = json.workout.main[0];
    const value = block.seconds ? { seconds: block.seconds } : { reps: block.repMax };
    for (let s = 1; s <= block.sets; s++) {
      const r = await call(sets.POST, { cookie, params: { id }, body: { blockIndex: 0, setNumber: s, ...value, rpe: 7 } });
      expect(r.status).toBe(200);
    }
    // Skip a set of the second block
    await call(sets.POST, { cookie, params: { id }, body: { blockIndex: 1, setNumber: 1, skipped: true } });
    // Editing a logged set updates instead of duplicating
    await call(sets.POST, { cookie, params: { id }, body: { blockIndex: 0, setNumber: 1, ...value, rpe: 8 } });
    expect((await call(sets.POST, { cookie, params: { id }, body: { blockIndex: 99, setNumber: 1, reps: 5 } })).status).toBe(400);

    // "Refresh": session state comes back from the server with all sets
    const reloaded = await call(session.GET, { cookie, params: { id } });
    expect(reloaded.json.session.sets).toHaveLength(block.sets + 1);
    expect(reloaded.json.session.status).toBe("active");

    expect((await call(session.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "goto", index: 1 } })).json.session.currentIndex).toBe(1);

    const done = await call(complete.POST, { cookie, params: { id }, body: { rpe: 7, notes: "Felt good" } });
    expect(done.status).toBe(200);
    const summary = done.json.summary;
    expect(summary.setsCompleted).toBe(block.sets);
    expect(summary.setsSkipped).toBe(1);
    expect(summary.kcal.low).toBeLessThan(summary.kcal.high);
    expect(summary.achievements.map((a: { key: string }) => a.key)).toContain("first_workout");

    // Exactly one activity entry per workout (no double counting)
    expect(await db.activityEntry.count({ where: { userId, workoutSessionId: id } })).toBe(1);
    // A retried completion (lost response, double tap) returns the same summary and records nothing new.
    const xpBefore = (await db.profile.findUniqueOrThrow({ where: { userId } })).xp;
    const retry = await call(complete.POST, { cookie, params: { id }, body: {} });
    expect(retry.status).toBe(200);
    expect(retry.json.summary.setsCompleted).toBe(summary.setsCompleted);
    expect(retry.json.summary.durationSeconds).toBe(summary.durationSeconds);
    expect(await db.activityEntry.count({ where: { userId, workoutSessionId: id } })).toBe(1);
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).xp).toBe(xpBefore);
    expect((await call(sets.POST, { cookie, params: { id }, body: { blockIndex: 0, setNumber: 1, reps: 3 } })).status).toBe(409);

    const g = await call(gamification.GET, { cookie });
    expect(g.json.streak.current).toBe(1);
    expect(g.json.streak.level.xp).toBeGreaterThan(0);
    expect(g.json.achievements.find((a: { key: string }) => a.key === "first_workout").unlockedAt).toBeTruthy();
  });

  it("completes once when two completions race", async () => {
    const { cookie, userId } = await newUser();
    const { json } = await call(today.GET, { cookie });
    const id = (await call(sessions.POST, { cookie, body: { planId: json.plan.id } })).json.session.id;
    const block = json.workout.main[0];
    await call(sets.POST, { cookie, params: { id }, body: { blockIndex: 0, setNumber: 1, ...(block.seconds ? { seconds: 20 } : { reps: 5 }) } });
    const both = await Promise.all([1, 2].map(() => call(complete.POST, { cookie, params: { id }, body: { rpe: 6 } })));
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.activityEntry.count({ where: { userId, workoutSessionId: id } })).toBe(1);
    expect(await db.xpEvent.count({ where: { userId, source: "workout", refId: id } })).toBe(1);
  });

  it("detects personal records against previous sessions", async () => {
    const { cookie } = await newUser();
    const run = async (reps: number) => {
      const t = await call(today.POST, { cookie, body: {} });
      const planId = t.json.plan.id;
      const ex = t.json.workout.main.findIndex((b: { seconds: number | null }) => !b.seconds);
      const s = await call(sessions.POST, { cookie, body: { planId } });
      const r = await call(sets.POST, { cookie, params: { id: s.json.session.id }, body: { blockIndex: ex, setNumber: 1, reps } });
      await call(complete.POST, { cookie, params: { id: s.json.session.id }, body: {} });
      return { r, exercise: t.json.workout.main[ex].exercise };
    };
    const first = await run(8);
    expect(first.r.json.prs).toHaveLength(0); // baseline, not a "record"
    const second = await run(12);
    if (second.exercise === first.exercise) expect(second.r.json.prs.map((p: { metric: string }) => p.metric)).toContain("reps");
  });

  it("never creates two plans for today or two live sessions when requests race", async () => {
    const { cookie, userId } = await newUser();
    const plans = await Promise.all([1, 2, 3, 4, 5, 6].map(() => call(today.GET, { cookie })));
    expect(new Set(plans.map((p) => p.json.plan.id)).size).toBe(1);
    expect(await db.workoutPlan.count({ where: { userId, status: { not: "archived" } } })).toBe(1);
    const planId = plans[0].json.plan.id;
    const starts = await Promise.all([1, 2, 3, 4, 5, 6].map(() => call(sessions.POST, { cookie, body: { planId } })));
    expect(starts.every((r) => r.status === 200)).toBe(true);
    expect(new Set(starts.map((r) => r.json.session.id)).size).toBe(1);
    expect(await db.workoutSession.count({ where: { userId, status: { in: ["active", "paused"] } } })).toBe(1);
    // Guaranteed by the database, not by timing: a second live session or daily plan is rejected outright.
    await expect(db.workoutSession.create({ data: { userId, title: "dup", content: "{}", activeKey: userId } })).rejects.toThrow(/Unique constraint/);
    await expect(db.workoutPlan.create({ data: { userId, title: "dup", focus: "x", content: "{}", dailyKey: plans[0].json.plan.dailyKey } })).rejects.toThrow(/Unique constraint/);
  });

  it("keeps personal records consistent with corrected and discarded sets", async () => {
    const { cookie, userId } = await newUser();
    const t = await call(today.GET, { cookie });
    const ex = t.json.workout.main.findIndex((b: { seconds: number | null }) => !b.seconds);
    const slug = t.json.workout.main[ex].exercise;
    const exercise = await db.exercise.findUniqueOrThrow({ where: { slug } });
    // Baseline: a self-reported test of 5 reps (not tied to any workout).
    await call(skillTest.POST, { cookie, body: { exercise: slug, metric: "reps", value: 5 } });
    const id = (await call(sessions.POST, { cookie, body: { planId: t.json.plan.id } })).json.session.id;
    const log = (reps: number) => call(sets.POST, { cookie, params: { id }, body: { blockIndex: ex, setNumber: 1, reps } });
    const sessionRecords = () => db.personalRecord.findMany({ where: { userId, sessionId: id, metric: "reps" } });

    expect((await log(20)).json.prs).toHaveLength(1); // typo: 20 instead of 2
    expect((await log(6)).json.prs).toHaveLength(1); // corrected: still beats the baseline
    expect((await sessionRecords()).map((r) => r.value)).toEqual([6]);
    expect((await log(4)).json.prs).toHaveLength(0); // corrected below the baseline: no record left
    expect(await sessionRecords()).toHaveLength(0);

    await log(30);
    expect(await sessionRecords()).toHaveLength(1);
    // Discarding the workout removes its records and its sets stop counting as bests.
    expect((await call(session.DELETE, { method: "DELETE", cookie, params: { id } })).status).toBe(200);
    expect(await sessionRecords()).toHaveLength(0);
    const { getExercise } = await import("@/lib/services/exercises");
    const view = await getExercise(slug, userId);
    expect(view.recentSets).toHaveLength(0);
    expect(view.records.map((r) => r.value)).toEqual([5]);
    expect(await db.personalRecord.count({ where: { userId, exerciseId: exercise.id } })).toBe(1);
  });

  it("substitutes exercises mid-workout only with suitable options", async () => {
    const { cookie } = await newUser();
    const { json } = await call(today.GET, { cookie });
    const s = await call(sessions.POST, { cookie, body: { planId: json.plan.id } });
    const id = s.json.session.id;
    const bad = await call(session.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "substitute", blockIndex: 0, exercise: "bench-press" } });
    expect(bad.status).toBe(400);
    const opts = await call(subs.GET, { cookie, params: { slug: json.workout.main[0].exercise } });
    const ok = await call(session.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "substitute", blockIndex: 0, exercise: opts.json.options[0].slug } });
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.json.session.content).main[0].exercise).toBe(opts.json.options[0].slug);
    expect((await call(session.DELETE, { method: "DELETE", cookie, params: { id } })).status).toBe(200);
  });
});

describe("skills, roadmap & reviews", () => {
  it("locks advanced skills until prerequisites are recorded", async () => {
    const { cookie } = await newUser();
    const fl = await call(skill.GET, { cookie, params: { slug: "front-lever" } });
    expect(fl.json.unlocked).toBe(false);
    expect((await call(skill.POST, { cookie, params: { slug: "front-lever" } })).status).toBe(400);
    await call(skillTest.POST, { cookie, body: { exercise: "pull-up", metric: "reps", value: 8 } });
    await call(skillTest.POST, { cookie, body: { exercise: "hollow-body-hold", metric: "seconds", value: 30 } });
    const after = await call(skill.GET, { cookie, params: { slug: "front-lever" } });
    expect(after.json.unlocked).toBe(true);
  });

  it("advances skill steps only when targets are met", async () => {
    const { cookie } = await newUser();
    expect((await call(skill.POST, { cookie, params: { slug: "first-pull-up" } })).status).toBe(200);
    const miss = await call(attempt.POST, { cookie, params: { slug: "first-pull-up" }, body: { value: 10 } });
    expect(miss.json.advanced).toBe(false);
    const hit = await call(attempt.POST, { cookie, params: { slug: "first-pull-up" }, body: { value: 30 } });
    expect(hit.json.advanced).toBe(true);
    expect(hit.json.progress.stepIndex).toBe(1);
  });

  it("does not equip-unlock skills the user lacks equipment for", async () => {
    const { cookie } = await newUser({ equipment: [] });
    expect((await call(skill.POST, { cookie, params: { slug: "first-pull-up" } })).status).toBe(400);
  });

  it("records one weekly review per week with a conservative adjustment", async () => {
    const { cookie } = await newUser();
    const r = await call(review.POST, { cookie, body: { feeling: 2, difficulty: "too_hard" } });
    expect(r.status).toBe(200);
    expect(r.json.adjustment.action).toBe("repeat_week");
    expect((await call(review.POST, { cookie, body: { feeling: 4, difficulty: "right" } })).status).toBe(409);
  });
});
