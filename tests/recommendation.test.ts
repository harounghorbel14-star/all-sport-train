import { beforeAll, describe, expect, it } from "vitest";
import { detectPlateau, recommend, type RecommendationInput } from "@/lib/domain/recommendation";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { call, newUser } from "./helpers";
import * as rec from "@/app/api/recommendation/route";
import * as today from "@/app/api/workouts/today/route";
import * as checkin from "@/app/api/recovery/checkin/route";
import { todayKey } from "@/lib/domain/dates";

const base: RecommendationInput = { today: "2026-10-14", isTrainingDay: true, doneToday: false, checkIn: null, recent: [], lastActiveDate: null, plannedMinutes: 40, series: [], missingPrerequisites: [] };
const session = (dateKey: string, rpe: number | null, done = 10, skipped = 0) => ({ dateKey, rpe, setsDone: done, setsSkipped: skipped });

describe("recommendation rules", () => {
  it("never reads missing data as recovery or progress", () => {
    const r = recommend(base);
    expect(r.kind).toBe("train");
    expect(r.difficulty).toBe("as_planned");
    expect(r.dataGaps.join(" ")).toMatch(/readiness is unknown/);
    expect(r.dataGaps.join(" ")).toMatch(/no effort history/);
    expect(r.reasons.join(" ")).not.toMatch(/recovered|ready to push/i);
  });

  it("recommends recovery for pain and explains it isn't medical advice", () => {
    const r = recommend({ ...base, checkIn: { band: "rest", readiness: 70, pain: true } });
    expect(r.kind).toBe("recover");
    expect(r.reasons.join(" ")).toMatch(/pain/);
    expect(r.reasons.join(" ")).toMatch(/not a medical assessment/);
  });

  it("makes the session lighter after very hard sessions, many skipped sets or a long break — with the numbers", () => {
    const hard = recommend({ ...base, checkIn: { band: "normal", readiness: 70, pain: false }, recent: [session("2026-10-12", 9), session("2026-10-10", 10)], lastActiveDate: "2026-10-12" });
    expect(hard.difficulty).toBe("easier");
    expect(hard.reasons.join(" ")).toMatch(/RPE 9 and 10/);
    const skipped = recommend({ ...base, recent: [session("2026-10-12", 6, 4, 6), session("2026-10-10", 6, 5, 5)], lastActiveDate: "2026-10-12" });
    expect(skipped.reasons.join(" ")).toMatch(/skipped 11 of 20 sets/);
    const gap = recommend({ ...base, recent: [session("2026-09-30", 6)], lastActiveDate: "2026-09-30" });
    expect(gap.volumeScale).toBe(0.75);
    expect(gap.reasons.join(" ")).toMatch(/14 days/);
    // One unrated session is a gap, not a reason to change.
    const unrated = recommend({ ...base, recent: [session("2026-10-12", null), session("2026-10-10", 9)], lastActiveDate: "2026-10-12" });
    expect(unrated.difficulty).toBe("as_planned");
    expect(unrated.dataGaps.join(" ")).toMatch(/RPE\) wasn't recorded for 1/);
  });

  it("respects planned rest days and finished workouts", () => {
    expect(recommend({ ...base, isTrainingDay: false }).kind).toBe("rest");
    expect(recommend({ ...base, doneToday: true }).kind).toBe("done");
  });

  it("only flags a plateau with enough sessions over enough time, and offers variations", () => {
    const pts = (n: number, step: number, values: number[]) => values.slice(0, n).map((best, i) => ({ dateKey: `2026-09-${String(1 + i * step).padStart(2, "0")}`, best }));
    const s = { slug: "push-up", name: "Push-up", metric: "reps" as const, easier: { slug: "knee-push-up", name: "Knee push-up" }, harder: { slug: "decline-push-up", name: "Decline push-up" } };
    expect(detectPlateau({ ...s, points: pts(3, 7, [10, 10, 10]) })).toBeNull(); // too few sessions
    expect(detectPlateau({ ...s, points: pts(5, 2, [10, 10, 10, 10, 10]) })).toBeNull(); // under 3 weeks
    expect(detectPlateau({ ...s, points: pts(5, 6, [8, 10, 10, 11, 12]) })).toBeNull(); // still improving
    const p = detectPlateau({ ...s, points: pts(5, 6, [8, 12, 12, 11, 12]) })!;
    expect(p.message).toMatch(/hasn't gone up over your last 5 sessions \(best 12 reps\)/);
    expect(p.message).toMatch(/isn't a diagnosis/);
    expect(p.alternatives.map((a) => a.slug)).toEqual(["knee-push-up", "decline-push-up"]);
  });
});

describe("accept / modify / reject", () => {
  beforeAll(async () => {
    await seed(db);
  });

  it("changes nothing until accepted, applies the suggestion on accept, and records every response", async () => {
    const { cookie, userId } = await newUser();
    const first = await call(today.GET, { cookie });
    const r = await call(rec.GET, { cookie });
    expect(r.status).toBe(200);
    expect(r.json.recommendation.reasons.length).toBeGreaterThan(0);
    expect((await call(today.GET, { cookie })).json.plan.id).toBe(first.json.plan.id); // viewing changes nothing

    const rej = await call(rec.POST, { cookie, body: { action: "reject", reason: "Short on time" } });
    expect(rej.json.action).toBe("rejected");
    expect((await call(today.GET, { cookie })).json.plan.id).toBe(first.json.plan.id);
    expect((await call(rec.GET, { cookie })).json.recommendation.feedback.action).toBe("rejected");

    const mod = await call(rec.POST, { cookie, body: { action: "modify", minutes: 20 } });
    expect(mod.status).toBe(200);
    expect(mod.json.workout.estimatedMinutes).toBeLessThanOrEqual(30);
    expect(await db.recommendationFeedback.count({ where: { userId } })).toBe(2);
  });

  it("a painful check-in leads to a recovery suggestion that accept turns into a recovery session", async () => {
    const { cookie } = await newUser();
    await call(checkin.POST, { cookie, body: { dateKey: todayKey("UTC"), sleepHours: 7, energy: 3, soreness: 3, pain: true } });
    const r = await call(rec.GET, { cookie });
    expect(r.json.recommendation.kind).toBe("recover");
    const acc = await call(rec.POST, { cookie, body: { action: "accept" } });
    expect(acc.json.workout.dayType).toBe("recovery");
  });
});
