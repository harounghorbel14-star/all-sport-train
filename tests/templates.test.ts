import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { addDays, todayKey } from "@/lib/domain/dates";
import { call, newUser } from "./helpers";
import * as today from "@/app/api/workouts/today/route";
import * as plan from "@/app/api/plans/[id]/route";
import * as sessions from "@/app/api/sessions/route";
import * as templates from "@/app/api/templates/route";
import * as template from "@/app/api/templates/[id]/route";

beforeAll(async () => {
  await seed(db);
});

const T = todayKey("UTC");

async function withTemplate() {
  const u = await newUser();
  const t0 = await call(today.GET, { cookie: u.cookie });
  const saved = await call(templates.POST, { cookie: u.cookie, body: { planId: t0.json.plan.id, name: "My push day", folder: "Strength" } });
  return { ...u, todayPlan: t0.json.plan, workout: t0.json.workout, template: saved.json.template };
}

describe("workout templates", () => {
  it("saving a template records no training at all", async () => {
    const { userId, template: t } = await withTemplate();
    expect(t.name).toBe("My push day");
    expect(t.folder).toBe("Strength");
    expect(t.exercises).toBeGreaterThan(0);
    expect(await db.workoutSession.count({ where: { userId } })).toBe(0);
    expect(await db.activityEntry.count({ where: { userId } })).toBe(0);
    expect(await db.xpEvent.count({ where: { userId } })).toBe(0);
  });

  it("schedules on a free day, refuses a taken one, and replaces only today's untouched automatic plan", async () => {
    const { cookie, userId, template: t, todayPlan, workout } = await withTemplate();
    const tomorrow = addDays(T, 1);
    const s = await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: tomorrow } });
    expect(s.status).toBe(200);
    expect(s.json.plan.scheduledOn).toBe(tomorrow);
    expect(s.json.plan.source).toBe("custom");
    expect(JSON.parse(s.json.plan.content).main).toEqual(workout.main);
    expect((await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: tomorrow } })).status).toBe(409);
    expect((await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: addDays(T, -1) } })).status).toBe(400);

    // Today's automatic plan is untouched → replaced (archived, not deleted).
    const r = await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: T } });
    expect(r.json.replacedAutomatic).toBe(true);
    expect((await db.workoutPlan.findUniqueOrThrow({ where: { id: todayPlan.id } })).status).toBe("archived");
    expect((await call(today.GET, { cookie })).json.plan.id).toBe(r.json.plan.id);
    // …but a workout under way is never replaced.
    await call(sessions.POST, { cookie, body: { planId: r.json.plan.id } });
    expect((await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: T } })).status).toBe(409);
    expect((await db.workoutTemplate.findUniqueOrThrow({ where: { id: t.id } })).lastUsedAt).not.toBeNull();
    expect(await db.workoutPlan.count({ where: { userId, scheduledOn: T, status: { not: "archived" } } })).toBe(1);
  });

  it("edits, updates from a plan, duplicates, deletes and restores — scheduled plans keep their own copy", async () => {
    const { cookie, template: t, todayPlan, workout } = await withTemplate();
    const scheduled = (await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: addDays(T, 2) } })).json.plan;

    expect((await call(template.PATCH, { method: "PATCH", cookie, params: { id: t.id }, body: { name: "Push A", folder: "" } })).json.template).toMatchObject({ name: "Push A", folder: null });
    expect((await call(template.PATCH, { method: "PATCH", cookie, params: { id: t.id }, body: { workout: { ...workout, main: [{ ...workout.main[0], exercise: "no-such-exercise" }] } } })).status).toBe(400);
    expect((await call(template.PATCH, { method: "PATCH", cookie, params: { id: t.id }, body: {} })).status).toBe(400);

    // Update the template from an edited plan.
    const edited = { ...workout, title: "Shorter push", main: workout.main.slice(0, 1) };
    await call(plan.PUT, { method: "PUT", cookie, params: { id: todayPlan.id }, body: { workout: edited } });
    const updated = await call(templates.POST, { cookie, body: { planId: todayPlan.id, replaceId: t.id } });
    expect(updated.json.template.id).toBe(t.id);
    expect(updated.json.template.exercises).toBe(1);
    expect(JSON.parse((await db.workoutPlan.findUniqueOrThrow({ where: { id: scheduled.id } })).content).main).toHaveLength(workout.main.length); // unchanged

    const copy = (await call(template.POST, { cookie, params: { id: t.id }, body: { action: "duplicate" } })).json.template;
    expect(copy.name).toBe("Push A (copy)");
    expect((await call(template.DELETE, { method: "DELETE", cookie, params: { id: t.id } })).status).toBe(200);
    let list = (await call(templates.GET, { cookie })).json;
    expect(list.templates.map((x: { id: string }) => x.id)).toEqual([copy.id]);
    expect(list.deleted.map((x: { id: string }) => x.id)).toEqual([t.id]);
    expect((await call(template.POST, { cookie, params: { id: t.id }, body: { action: "schedule", dateKey: addDays(T, 3) } })).status).toBe(404);
    await call(template.POST, { cookie, params: { id: t.id }, body: { action: "restore" } });
    list = (await call(templates.GET, { cookie })).json;
    expect(list.templates).toHaveLength(2);
    expect(list.deleted).toHaveLength(0);
  });

  it("purges templates deleted more than 30 days ago", async () => {
    const { cookie, template: t } = await withTemplate();
    await db.workoutTemplate.update({ where: { id: t.id }, data: { deletedAt: new Date(Date.now() - 31 * 86_400_000) } });
    const list = (await call(templates.GET, { cookie })).json;
    expect(list.deleted).toHaveLength(0);
    expect(await db.workoutTemplate.count({ where: { id: t.id } })).toBe(0);
  });

  it("never exposes or uses another user's templates or plans", async () => {
    const a = await withTemplate();
    const b = await newUser();
    expect((await call(template.GET, { cookie: b.cookie, params: { id: a.template.id } })).status).toBe(404);
    expect((await call(template.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: a.template.id }, body: { name: "x" } })).status).toBe(404);
    expect((await call(template.DELETE, { method: "DELETE", cookie: b.cookie, params: { id: a.template.id } })).status).toBe(404);
    expect((await call(template.POST, { cookie: b.cookie, params: { id: a.template.id }, body: { action: "schedule", dateKey: addDays(T, 1) } })).status).toBe(404);
    expect((await call(templates.POST, { cookie: b.cookie, body: { planId: a.todayPlan.id } })).status).toBe(404);
    expect((await call(templates.POST, { cookie: b.cookie, body: { planId: (await call(today.GET, { cookie: b.cookie })).json.plan.id, replaceId: a.template.id } })).status).toBe(404);
    expect((await call(templates.GET, { cookie: b.cookie })).json.templates).toHaveLength(0);
  });
});

describe("template edits", () => {
  it("renaming keeps the folder", async () => {
    const { cookie, template: t } = await withTemplate();
    const r = await call(template.PATCH, { method: "PATCH", cookie, params: { id: t.id }, body: { name: "Renamed" } });
    expect(r.json.template).toMatchObject({ name: "Renamed", folder: "Strength" });
  });
});
