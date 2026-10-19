import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { invalidateSportsCache } from "@/lib/services/sports";
import { todayKey } from "@/lib/domain/dates";
import { call, newUser } from "./helpers";
import * as metrics from "@/app/api/sports/[slug]/metrics/route";
import * as metricItem from "@/app/api/sport-metrics/[id]/route";
import * as sport from "@/app/api/sports/[slug]/route";
import * as lesson from "@/app/api/sports/[slug]/lessons/[lesson]/route";
import * as activity from "@/app/api/activity/route";
import * as activityItem from "@/app/api/activity/[id]/route";
import * as measurements from "@/app/api/progress/measurements/route";
import * as measurementItem from "@/app/api/progress/measurements/[id]/route";

beforeAll(async () => {
  await seed(db);
  invalidateSportsCache();
});

const T = todayKey("UTC");

describe("correcting recorded results", () => {
  it("corrects a sport result with the same validation, keeps the original, and updates bests and lessons", async () => {
    const { cookie, userId } = await newUser();
    const log = (made: number) => call(metrics.POST, { cookie, params: { slug: "football" }, body: { metricKey: "pass_accuracy", made, attempts: 10, dateKey: T } });
    // A typo: 9/10 instead of 5/10 passes the first-touch test (target 70%).
    await call(lesson.POST, { cookie, params: { slug: "football", lesson: "first-touch" }, body: { status: "completed" } });
    const typo = await log(9);
    expect(typo.json.lessonsPassed).toHaveLength(1);
    const id = typo.json.entry.id;

    expect((await call(metricItem.PATCH, { method: "PATCH", cookie, params: { id }, body: { made: 11 } })).status).toBe(400); // 11/10 is invalid
    const fixed = await call(metricItem.PATCH, { method: "PATCH", cookie, params: { id }, body: { made: 5, reason: "typo" } });
    expect(fixed.status).toBe(200);
    expect(fixed.json.entry.value).toBe(50);

    const log2 = await db.recordCorrection.findMany({ where: { userId, recordType: "sport_metric", recordId: id } });
    expect(log2).toHaveLength(1);
    expect(JSON.parse(log2[0].before).made).toBe(9); // the original is kept
    expect(log2[0].reason).toBe("typo");

    const hub = await call(sport.GET, { cookie, params: { slug: "football" } });
    expect(hub.json.user.personalBests.pass_accuracy.value).toBe(50);
    expect(hub.json.user.lessonStates["first-touch"].state).toBe("awaiting_assessment"); // no longer passed
    expect(await db.xpEvent.count({ where: { userId, source: "lesson" } })).toBe(0); // and its XP was returned
  });

  it("re-estimates energy when an activity is corrected, and refuses workout entries", async () => {
    const { cookie, userId } = await newUser();
    const a = await call(activity.POST, { cookie, body: { sport: "running", dateKey: T, durationMin: 60, intensity: "moderate" } });
    const r = await call(activityItem.PATCH, { method: "PATCH", cookie, params: { id: a.json.entry.id }, body: { durationMin: 30, reason: "stopped the watch late" } });
    expect(r.status).toBe(200);
    expect(r.json.entry.durationMin).toBe(30);
    expect(r.json.entry.kcalHigh).toBeLessThan(a.json.entry.kcalHigh);
    expect(await db.recordCorrection.count({ where: { userId, recordType: "activity" } })).toBe(1);
  });

  it("keeps profile weight in step with a corrected latest measurement", async () => {
    const { cookie, userId } = await newUser();
    const m = await call(measurements.POST, { cookie, body: { dateKey: T, weightKg: 800 / 10 } });
    await call(measurementItem.PATCH, { method: "PATCH", cookie, params: { id: m.json.measurement.id }, body: { weightKg: 78 } });
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).weightKg).toBe(78);
    expect((await call(measurementItem.PATCH, { method: "PATCH", cookie, params: { id: m.json.measurement.id }, body: { weightKg: 5 } })).status).toBe(400);
  });

  it("never lets another user correct someone's records", async () => {
    const a = await newUser();
    const b = await newUser();
    const entry = await call(metrics.POST, { cookie: a.cookie, params: { slug: "running" }, body: { metricKey: "time_5k", value: 1800, dateKey: T } });
    const act = await call(activity.POST, { cookie: a.cookie, body: { sport: "running", dateKey: T, durationMin: 20, intensity: "light" } });
    const m = await call(measurements.POST, { cookie: a.cookie, body: { dateKey: T, waistCm: 80 } });
    expect((await call(metricItem.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: entry.json.entry.id }, body: { value: 1000 } })).status).toBe(404);
    expect((await call(activityItem.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: act.json.entry.id }, body: { durationMin: 1 } })).status).toBe(404);
    expect((await call(measurementItem.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: m.json.measurement.id }, body: { waistCm: 60 } })).status).toBe(404);
    expect(await db.recordCorrection.count({ where: { userId: b.userId } })).toBe(0);
  });
});
