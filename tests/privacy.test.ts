import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { todayKey } from "@/lib/domain/dates";
import { privacySummary } from "@/lib/services/account";
import { call, newUser } from "./helpers";
import * as coach from "@/app/api/coach/route";
import * as goals from "@/app/api/goals/route";
import * as activity from "@/app/api/activity/route";

beforeAll(async () => {
  await seed(db);
});

describe("privacy center", () => {
  it("counts only the user's own records, and clearing the AI conversation empties it", async () => {
    const a = await newUser();
    const b = await newUser();
    await call(coach.POST, { cookie: a.cookie, body: { message: "How should I warm up?" } });
    await call(goals.POST, { cookie: a.cookie, body: { kind: "consistency", target: 2 } });
    await call(activity.POST, { cookie: a.cookie, body: { sport: "running", dateKey: todayKey("UTC"), durationMin: 20, intensity: "light" } });
    const sa = await privacySummary(a.userId);
    expect(sa.counts.coachMessages).toBeGreaterThanOrEqual(2); // question + answer
    expect(sa.counts.goals).toBe(1);
    expect(sa.counts.activities).toBe(1);
    expect(sa.sharing.nutritionInCoach).toBe(false);
    expect(sa.connected).toEqual({ google: false, healthServices: [] });
    const sb = await privacySummary(b.userId);
    // B has only what onboarding stored for B (the starting weight) — nothing of A's.
    expect(sb.counts).toMatchObject({ coachMessages: 0, goals: 0, activities: 0, measurements: await db.bodyMeasurement.count({ where: { userId: b.userId } }) });

    expect((await call(coach.DELETE, { method: "DELETE", cookie: a.cookie })).status).toBe(200);
    expect((await privacySummary(a.userId)).counts.coachMessages).toBe(0);
  });
});
