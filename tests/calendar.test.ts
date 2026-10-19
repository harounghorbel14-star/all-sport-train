import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { addDays, todayKey, weekday } from "@/lib/domain/dates";
import { call, newUser } from "./helpers";
import * as cal from "@/app/api/calendar/route";
import * as plan from "@/app/api/plans/[id]/route";
import * as today from "@/app/api/workouts/today/route";
import * as sessions from "@/app/api/sessions/route";
import * as sessionItem from "@/app/api/sessions/[id]/route";
import * as sets from "@/app/api/sessions/[id]/sets/route";
import * as complete from "@/app/api/sessions/[id]/complete/route";
import * as activity from "@/app/api/activity/route";

beforeAll(async () => {
  await seed(db);
});

const T = todayKey("UTC");
const day = (cookie: string, d: string) => call(cal.GET, { cookie, path: `/api/calendar?from=${d}&days=1` }).then((r) => r.json.days[0]);

describe("training calendar", () => {
  it("schedules, reschedules, cancels and restores — one workout per day, never in the past", async () => {
    const { cookie } = await newUser();
    const d3 = addDays(T, 3);
    const s = await call(cal.POST, { cookie, body: { dateKey: d3 } });
    expect(s.status).toBe(200);
    expect((await call(cal.POST, { cookie, body: { dateKey: d3 } })).status).toBe(409); // already a workout that day
    expect((await call(cal.POST, { cookie, body: { dateKey: addDays(T, -1) } })).status).toBe(400); // past
    expect((await day(cookie, d3)).plans[0].status).toBe("scheduled");

    const id = s.json.plan.id;
    const d5 = addDays(T, 5);
    const moved = await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "reschedule", dateKey: d5 } });
    expect(moved.status).toBe(200);
    expect((await day(cookie, d3)).plans).toHaveLength(0);
    expect((await day(cookie, d5)).plans[0].id).toBe(id);

    expect((await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "cancel" } })).status).toBe(200);
    expect((await day(cookie, d5)).plans[0].status).toBe("cancelled");
    expect(await db.workoutPlan.count({ where: { id } })).toBe(1); // nothing deleted
    expect((await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "restore" } })).json.plan.status).toBe("planned");
  });

  it("never moves or cancels a completed workout, and won't start a cancelled one", async () => {
    const { cookie } = await newUser();
    const t = await call(today.GET, { cookie });
    const id = t.json.plan.id;
    expect((await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "cancel" } })).status).toBe(200);
    expect((await call(sessions.POST, { cookie, body: { planId: id } })).status).toBe(409);
    await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "restore" } });
    const sid = (await call(sessions.POST, { cookie, body: { planId: id } })).json.session.id;
    const b = t.json.workout.main[0];
    await call(sets.POST, { cookie, params: { id: sid }, body: { blockIndex: 0, setNumber: 1, ...(b.seconds ? { seconds: 20 } : { reps: 5 }) } });
    await call(complete.POST, { cookie, params: { id: sid }, body: {} });
    expect((await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "reschedule", dateKey: addDays(T, 2) } })).status).toBe(409);
    expect((await call(plan.PATCH, { method: "PATCH", cookie, params: { id }, body: { action: "cancel" } })).status).toBe(409);
    expect((await day(cookie, T)).plans[0].status).toBe("completed");
    void sessionItem;
  });

  it("moving today's automatic workout away lets today get a fresh one (no unique-key clash)", async () => {
    const { cookie, userId } = await newUser();
    const first = await call(today.GET, { cookie });
    await call(plan.PATCH, { method: "PATCH", cookie, params: { id: first.json.plan.id }, body: { action: "reschedule", dateKey: addDays(T, 1) } });
    const again = await call(today.GET, { cookie });
    expect(again.status).toBe(200);
    expect(again.json.plan.id).not.toBe(first.json.plan.id);
    expect(await db.workoutPlan.count({ where: { userId, status: { not: "archived" } } })).toBe(2);
  });

  it("derives skipped workouts and recurring-sport status from what was actually logged", async () => {
    const { cookie, userId } = await newUser();
    const past = addDays(T, -2);
    await db.workoutPlan.create({ data: { userId, title: "Old plan", focus: "full_body", scheduledOn: past, content: "{}" } });
    await db.profile.update({ where: { userId }, data: { sportSchedule: JSON.stringify({ [String(weekday(past))]: ["running"], [String(weekday(addDays(T, -1)))]: ["cycling"] }) } });
    await call(activity.POST, { cookie, body: { sport: "running", dateKey: past, durationMin: 30, intensity: "moderate" } });
    const d = await day(cookie, past);
    expect(d.plans[0].status).toBe("skipped"); // derived, not stored
    expect(d.recurring.find((r: { sport: string }) => r.sport === "running").status).toBe("done");
    const y = await day(cookie, addDays(T, -1));
    expect(y.recurring.find((r: { sport: string }) => r.sport === "cycling").status).toBe("missed");
  });

  it("warns (without blocking) when a week gets more workouts than usual", async () => {
    const { cookie, userId } = await newUser();
    await db.profile.update({ where: { userId }, data: { daysPerWeek: 2 } });
    const warnings: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const r = await call(cal.POST, { cookie, body: { dateKey: addDays(T, i) } });
      expect(r.status).toBe(200);
      warnings.push(...r.json.warnings);
    }
    expect(warnings.some((w) => /more than your usual 2/.test(w))).toBe(true);
    // Filling the gap between two scheduled days makes three in a row.
    const other = await newUser();
    await call(cal.POST, { cookie: other.cookie, body: { dateKey: addDays(T, 10) } });
    await call(cal.POST, { cookie: other.cookie, body: { dateKey: addDays(T, 12) } });
    const middle = await call(cal.POST, { cookie: other.cookie, body: { dateKey: addDays(T, 11) } });
    expect(middle.status).toBe(200);
    expect(middle.json.warnings.some((w: string) => /three training days in a row/.test(w))).toBe(true);
  });

  it("never lets another user move or cancel someone's workout", async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await call(cal.POST, { cookie: a.cookie, body: { dateKey: addDays(T, 2) } });
    for (const body of [{ action: "reschedule", dateKey: addDays(T, 4) }, { action: "cancel" }, { action: "restore" }])
      expect((await call(plan.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: s.json.plan.id }, body })).status).toBe(404);
  });
});
