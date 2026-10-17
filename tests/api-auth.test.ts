import { beforeAll, describe, expect, it } from "vitest";
import { call, newUser } from "./helpers";
import { seed } from "../prisma/seed";
import { db } from "@/lib/server/db";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as me from "@/app/api/auth/me/route";
import * as profile from "@/app/api/profile/route";
import * as onboarding from "@/app/api/onboarding/route";
import * as plan from "@/app/api/plans/[id]/route";
import * as today from "@/app/api/workouts/today/route";
import * as entry from "@/app/api/nutrition/entries/[id]/route";
import * as entries from "@/app/api/nutrition/entries/route";
import * as adminEx from "@/app/api/admin/exercises/route";
import { resetRateLimits } from "@/lib/server/rate-limit";

beforeAll(async () => {
  await seed(db);
});

describe("authentication", () => {
  it("registers, logs in, reads the profile and logs out", async () => {
    resetRateLimits();
    const reg = await call(register.POST, { body: { email: "Alice@Example.com", password: "password123", displayName: "Alice" } });
    expect(reg.status).toBe(201);
    const setCookie = reg.res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);

    const dup = await call(register.POST, { body: { email: "alice@example.com", password: "password123", displayName: "A" } });
    expect(dup.status).toBe(409);

    const bad = await call(login.POST, { body: { email: "alice@example.com", password: "wrongpass123" } });
    expect(bad.status).toBe(401);

    const ok = await call(login.POST, { body: { email: "alice@example.com", password: "password123" } });
    expect(ok.status).toBe(200);
    const cookie = ok.res.headers.get("set-cookie")!.split(";")[0];
    const m = await call(me.GET, { cookie });
    expect(m.status).toBe(200);
    expect(m.json.user.email).toBe("alice@example.com");
    expect(m.json.user.passwordHash).toBeUndefined();

    await call(logout.POST, { cookie });
    expect((await call(me.GET, { cookie })).status).toBe(401);
  });

  it("rejects weak passwords and invalid emails", async () => {
    resetRateLimits();
    expect((await call(register.POST, { body: { email: "x@y.com", password: "short", displayName: "X" } })).status).toBe(400);
    expect((await call(register.POST, { body: { email: "nope", password: "password123", displayName: "X" } })).status).toBe(400);
  });

  it("rate limits repeated login attempts", async () => {
    resetRateLimits();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await call(login.POST, { body: { email: "nobody@example.com", password: "password123" } })).status;
    expect(last).toBe(429);
  });

  it("requires a session for private endpoints", async () => {
    expect((await call(profile.GET)).status).toBe(401);
    expect((await call(today.GET)).status).toBe(401);
    expect((await call(me.GET, { cookie: "apex_session=forged-token" })).status).toBe(401);
  });

  it("rejects cross-origin mutations", async () => {
    const { cookie } = await newUser();
    const r = await call(profile.PATCH, { method: "PATCH", cookie, body: { bio: "hi" }, headers: { origin: "https://evil.example", host: "localhost" } });
    expect(r.status).toBe(403);
  });

  it("restricts exercise management to administrators", async () => {
    const { cookie } = await newUser();
    const r = await call(adminEx.POST, { cookie, body: {} });
    expect(r.status).toBe(403);
  });
});

describe("onboarding & profile persistence", () => {
  it("persists onboarding answers and creates a starting measurement", async () => {
    const { cookie, userId } = await newUser({ equipment: ["pullup_bar", "resistance_band"], limitations: ["wrist"], daysPerWeek: 4, trainingDays: [] });
    const p = await call(profile.GET, { cookie });
    expect(p.json.profile.onboardingCompleted).toBe(true);
    expect(p.json.profile.equipment).toEqual(["pullup_bar", "resistance_band"]);
    expect(p.json.profile.limitations).toEqual(["wrist"]);
    expect(p.json.profile.trainingDays).toHaveLength(4); // defaults distributed
    expect(await db.bodyMeasurement.count({ where: { userId } })).toBe(1);
  });

  it("validates onboarding input", async () => {
    const { cookie } = await newUser({}, false);
    const r = await call(onboarding.POST, { cookie, body: { experience: "wizard", goals: [] } });
    expect(r.status).toBe(400);
    expect(r.json.error.details).toBeTruthy();
  });

  it("allows editing answers later", async () => {
    const { cookie } = await newUser();
    const r = await call(profile.PATCH, { method: "PATCH", cookie, body: { sessionMinutes: 45, equipment: [], units: "imperial", locale: "ar" } });
    expect(r.status).toBe(200);
    expect(r.json.profile.sessionMinutes).toBe(45);
    expect(r.json.profile.locale).toBe("ar");
  });
});

describe("ownership checks", () => {
  it("prevents access to another user's plans and food entries", async () => {
    const a = await newUser();
    const b = await newUser();
    const t = await call(today.GET, { cookie: a.cookie });
    const planId = t.json.plan.id;
    expect((await call(plan.GET, { cookie: b.cookie, params: { id: planId } })).status).toBe(404);
    expect((await call(plan.PUT, { method: "PUT", cookie: b.cookie, params: { id: planId }, body: { workout: t.json.workout } })).status).toBe(404);

    const e = await call(entries.POST, { cookie: a.cookie, body: { dateKey: "2026-10-12", meal: "lunch", name: "Soup", grams: 300, kcal: 200, source: "custom" } });
    expect(e.status).toBe(200);
    expect((await call(entry.DELETE, { method: "DELETE", cookie: b.cookie, params: { id: e.json.entry.id } })).status).toBe(404);
    expect((await call(entry.DELETE, { method: "DELETE", cookie: a.cookie, params: { id: e.json.entry.id } })).status).toBe(200);
  });
});
