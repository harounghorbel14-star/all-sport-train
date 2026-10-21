import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { addDays, todayKey, weekStart } from "@/lib/domain/dates";
import { call, newUser } from "./helpers";
import * as catchUp from "@/app/api/calendar/catch-up/route";
import * as travel from "@/app/api/travel/route";
import * as trip from "@/app/api/travel/[id]/route";
import * as today from "@/app/api/workouts/today/route";
import * as plan from "@/app/api/plans/[id]/route";
import * as checkin from "@/app/api/recovery/checkin/route";

beforeAll(async () => {
  await seed(db);
});

const T = todayKey("UTC");
const WE = addDays(weekStart(T), 6);

/** A user who joined 10 days ago, with no fixed training days, so only scheduled plans matter. */
async function setup(daysPerWeek = 3) {
  const u = await newUser();
  await db.user.update({ where: { id: u.userId }, data: { createdAt: new Date(Date.now() - 10 * 86_400_000) } });
  await db.profile.update({ where: { userId: u.userId }, data: { trainingDays: "[]", daysPerWeek, timezone: "UTC" } });
  return u;
}
const missedPlan = (userId: string, d: string) => db.workoutPlan.create({ data: { userId, title: "Missed session", focus: "full", scheduledOn: d, source: "engine", content: "{}" } });

describe("missed workouts", () => {
  it("never counts days before the account existed", async () => {
    const { cookie, userId } = await newUser();
    await missedPlan(userId, addDays(T, -3));
    const r = await call(catchUp.GET, { cookie });
    expect(r.json.missed).toEqual([]);
    expect(r.json.notes).toContainEqual({ code: "none_missed" });
  });

  it("proposes at most two lighter sessions on free, non-adjacent days of this week — and only on request", async () => {
    const { cookie, userId } = await setup();
    await missedPlan(userId, addDays(T, -1));
    await missedPlan(userId, addDays(T, -2));
    const r = await call(catchUp.GET, { cookie });
    expect(r.json.missed.map((m: { kind: string }) => m.kind)).toEqual(["plan", "plan"]);
    const days: string[] = r.json.proposal.map((x: { dateKey: string }) => x.dateKey);
    expect(days.length).toBeGreaterThanOrEqual(1);
    expect(days.length).toBeLessThanOrEqual(2);
    expect(days[0]).toBe(T);
    for (const d of days) expect(d >= T && d <= WE).toBe(true);
    if (days.length === 2) expect(days[1]).not.toBe(addDays(days[0], 1));
    expect(r.json.proposal.every((x: { lighter: boolean }) => x.lighter)).toBe(true); // a long break (no workout yet) and two misses
    expect(r.json.notes).toContainEqual({ code: "after_break" });
    // The preview changed nothing.
    expect(await db.workoutPlan.count({ where: { userId, scheduledOn: { gte: T } } })).toBe(0);

    const applied = await call(catchUp.POST, { cookie, body: { dateKeys: days } });
    expect(applied.status).toBe(200);
    expect(applied.json.created.map((c: { dateKey: string }) => c.dateKey)).toEqual(days);
    // Applying again doesn't stack a second session on the same day.
    expect((await call(catchUp.POST, { cookie, body: { dateKeys: [days[0]] } })).status).toBe(409);
    expect(await db.workoutPlan.count({ where: { userId, scheduledOn: days[0], status: { not: "archived" } } })).toBe(1);
    // A day the preview never offered is refused.
    expect((await call(catchUp.POST, { cookie, body: { dateKeys: [addDays(T, 30)] } })).status).toBe(409);
  });

  it("never makes a third day in a row", async () => {
    const { cookie, userId } = await setup(5);
    await missedPlan(userId, addDays(T, -3));
    for (const d of [addDays(T, -1), addDays(T, -2)]) await db.activityEntry.create({ data: { userId, sport: "running", dateKey: d, durationMin: 30, intensity: "moderate", kcalLow: 100, kcalHigh: 200, source: "manual" } });
    const r = await call(catchUp.GET, { cookie });
    expect(r.json.missed).toHaveLength(1);
    expect(r.json.proposal.map((x: { dateKey: string }) => x.dateKey)).not.toContain(T);
  });

  it("doesn't make up for a miss when the week is already full", async () => {
    const { cookie, userId } = await setup(1);
    await missedPlan(userId, addDays(T, -1));
    await db.workoutPlan.create({ data: { userId, title: "Today's", focus: "full", scheduledOn: T, source: "engine", content: "{}" } });
    const r = await call(catchUp.GET, { cookie });
    expect(r.json.proposal).toEqual([]);
    expect(r.json.notes).toContainEqual({ code: "week_full", planned: 1, target: 1 });
  });

  it("proposes nothing after a check-in that reports pain, and a logged day isn't a miss", async () => {
    const { cookie, userId } = await setup();
    await missedPlan(userId, addDays(T, -1));
    await db.activityEntry.create({ data: { userId, sport: "running", dateKey: addDays(T, -1), durationMin: 30, intensity: "moderate", kcalLow: 100, kcalHigh: 200, source: "manual" } });
    expect((await call(catchUp.GET, { cookie })).json.missed).toEqual([]);
    await missedPlan(userId, addDays(T, -2));
    await call(checkin.POST, { cookie, body: { dateKey: T, energy: 2, soreness: 4, pain: true } });
    const r = await call(catchUp.GET, { cookie });
    expect(r.json.missed).toHaveLength(1);
    expect(r.json.proposal).toEqual([]);
    expect(r.json.notes).toContainEqual({ code: "check_in_rest" });
  });
});

describe("travel mode", () => {
  it("validates trips and never lengthens sessions", async () => {
    const { cookie } = await newUser();
    const bad = async (body: object) => (await call(travel.POST, { cookie, body })).status;
    expect(await bad({ startDate: addDays(T, 3), endDate: addDays(T, 1) })).toBe(400);
    expect(await bad({ startDate: addDays(T, -5), endDate: addDays(T, -1) })).toBe(400);
    expect(await bad({ startDate: T, endDate: addDays(T, 70) })).toBe(400);
    const ok = await call(travel.POST, { cookie, body: { startDate: T, endDate: addDays(T, 4), sessionMinutes: 120 } });
    expect(ok.status).toBe(200);
    expect(ok.json.trip.sessionMinutes).toBeLessThanOrEqual((await db.profile.findFirstOrThrow({ where: { userId: ok.json.trip.userId } })).sessionMinutes);
    expect(await bad({ startDate: addDays(T, 2), endDate: addDays(T, 6) })).toBe(409); // overlaps
  });

  it("workouts generated during a trip use only the trip's equipment", async () => {
    const { cookie, userId } = await newUser();
    await db.profile.update({ where: { userId }, data: { equipment: JSON.stringify(["dumbbells", "barbell", "bench", "pullup_bar"]), location: "gym" } });
    await call(travel.POST, { cookie, body: { startDate: T, endDate: addDays(T, 3), equipment: [], location: "home" } });
    const w = (await call(today.GET, { cookie })).json.workout;
    const slugs = [...w.warmup, ...w.main, ...w.cooldown].map((b: { exercise: string }) => b.exercise);
    const ex = await db.exercise.findMany({ where: { slug: { in: slugs } }, select: { slug: true, equipment: true } });
    for (const e of ex) expect(JSON.parse(e.equipment), e.slug).toEqual([]);
  });

  it("previews, adapts and restores scheduled workouts — edited ones are kept", async () => {
    const { cookie, userId } = await newUser();
    await db.profile.update({ where: { userId }, data: { equipment: JSON.stringify(["dumbbells", "barbell", "bench"]), location: "gym" } });
    const original = (await call(today.GET, { cookie })).json.plan;
    // An edited workout tomorrow.
    const tomorrow = await db.workoutPlan.create({ data: { userId, title: "My own", focus: "full", scheduledOn: addDays(T, 1), source: "custom", content: original.content } });
    const t = (await call(travel.POST, { cookie, body: { startDate: T, endDate: addDays(T, 2), equipment: ["resistance_band"], location: "home" } })).json.trip;

    const preview = await call(trip.GET, { cookie, params: { id: t.id } });
    const byId = Object.fromEntries(preview.json.changes.map((c: { planId: string }) => [c.planId, c]));
    expect(byId[original.id].change).toBe("adapt");
    expect(byId[tomorrow.id].change).toBe("keep");
    expect((await db.workoutPlan.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("planned"); // preview changes nothing

    await call(trip.POST, { cookie, params: { id: t.id }, body: { action: "apply", planIds: [original.id, tomorrow.id] } });
    expect((await db.workoutPlan.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("archived");
    expect((await db.workoutPlan.findUniqueOrThrow({ where: { id: tomorrow.id } })).status).toBe("planned"); // edited: untouched
    const adaptedToday = (await call(today.GET, { cookie })).json.plan;
    expect(adaptedToday.id).not.toBe(original.id);

    const cancelled = await call(trip.POST, { cookie, params: { id: t.id }, body: { action: "cancel" } });
    expect(cancelled.json.restored).toBe(1);
    expect((await call(today.GET, { cookie })).json.plan.id).toBe(original.id);
    expect((await db.workoutPlan.findUniqueOrThrow({ where: { id: adaptedToday.id } })).status).toBe("archived");
    expect((await call(plan.GET, { cookie, params: { id: original.id } })).status).toBe(200);
  });

  it("never shows or changes another user's trips", async () => {
    const a = await newUser();
    const b = await newUser();
    const t = (await call(travel.POST, { cookie: a.cookie, body: { startDate: T, endDate: addDays(T, 1) } })).json.trip;
    expect((await call(trip.GET, { cookie: b.cookie, params: { id: t.id } })).status).toBe(404);
    expect((await call(trip.POST, { cookie: b.cookie, params: { id: t.id }, body: { action: "cancel" } })).status).toBe(404);
    expect((await call(travel.GET, { cookie: b.cookie })).json.current).toHaveLength(0);
  });
});
