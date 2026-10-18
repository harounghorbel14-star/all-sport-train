import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { call, newUser } from "./helpers";
import { invalidateSportsCache } from "@/lib/services/sports";
import * as sports from "@/app/api/sports/route";
import * as sport from "@/app/api/sports/[slug]/route";
import * as lesson from "@/app/api/sports/[slug]/lessons/[lesson]/route";
import * as practice from "@/app/api/sports/[slug]/practice/route";
import * as metrics from "@/app/api/sports/[slug]/metrics/route";
import * as review from "@/app/api/sports/[slug]/review/route";
import * as practiceItem from "@/app/api/practice/[id]/route";
import * as practiceComplete from "@/app/api/practice/[id]/complete/route";
import * as metricItem from "@/app/api/sport-metrics/[id]/route";
import * as adminSports from "@/app/api/admin/sports/route";
import * as adminContent from "@/app/api/admin/sports/[slug]/content/route";
import * as adminStatus from "@/app/api/admin/content-status/route";
import * as coach from "@/app/api/coach/route";
import * as account from "@/app/api/account/export/route";

const D = "2026-10-01";

beforeAll(async () => {
  await seed(db);
  invalidateSportsCache();
});

async function admin() {
  const u = await newUser();
  await db.user.update({ where: { id: u.userId }, data: { role: "admin", emailVerifiedAt: new Date() } });
  return u;
}

describe("sports catalog & hub", () => {
  it("searches by name and alias, accent-insensitively, and filters by category", async () => {
    const { cookie } = await newUser();
    const soccer = await call(sports.GET, { cookie, path: "/api/sports?q=soccer" });
    expect(soccer.status).toBe(200);
    expect(soccer.json.sports[0].slug).toBe("football");
    const combat = await call(sports.GET, { cookie, path: "/api/sports?category=combat" });
    expect(combat.json.sports.length).toBeGreaterThan(10);
    expect(combat.json.sports.every((s: { categorySlug: string }) => s.categorySlug === "combat")).toBe(true);
    expect(combat.json.categories).toHaveLength(8);
  });

  it("returns a hub with lessons, drills, sourced rulesets and an unknown sport 404s", async () => {
    const { cookie } = await newUser();
    const hub = await call(sport.GET, { cookie, params: { slug: "basketball" } });
    expect(hub.status).toBe(200);
    expect(hub.json.lessons.length).toBeGreaterThan(4);
    expect(hub.json.rulesets.map((r: { slug: string }) => r.slug).sort()).toEqual(["fiba", "nba"]);
    expect(hub.json.sources.length).toBeGreaterThan(0);
    expect(hub.json.user.nextLesson).toBe("ball-handling");
    expect((await call(sport.GET, { cookie, params: { slug: "quidditch" } })).status).toBe(404);
  });
});

describe("learning path", () => {
  it("enrols, completes lessons and moves the next lesson forward", async () => {
    const { cookie } = await newUser();
    expect((await call(sport.POST, { cookie, params: { slug: "basketball" }, body: { level: "beginner", position: "Guard", supervised: false } })).status).toBe(200);
    const done = await call(lesson.POST, { cookie, params: { slug: "basketball", lesson: "ball-handling" }, body: { status: "completed" } });
    expect(done.status).toBe(200);
    expect(done.json.next).not.toBe("ball-handling");
    const hub = await call(sport.GET, { cookie, params: { slug: "basketball" } });
    expect(hub.json.user.completedLessons).toContain("ball-handling");
    expect(hub.json.user.enrollment.position).toBe("Guard");
  });
});

describe("practice plans", () => {
  it("never includes coach-only contact drills for an unsupervised boxer, and completing logs an activity + results", async () => {
    const { cookie, userId } = await newUser();
    await call(sport.POST, { cookie, params: { slug: "boxing" }, body: { level: "advanced", supervised: false } });
    const r = await call(practice.POST, { cookie, params: { slug: "boxing" }, body: { minutes: 45, focus: "balanced", setting: "partner", players: 2 } });
    expect(r.status).toBe(200);
    const plan = await call(practiceItem.GET, { cookie, params: { id: r.json.plan.id } });
    const slugs = plan.json.content.blocks.map((b: { drillSlug: string | null }) => b.drillSlug);
    expect(slugs).not.toContain("technical-sparring");
    expect(slugs).not.toContain("partner-jab-parry");
    expect(plan.json.content.excluded.map((e: { title: string }) => e.title)).toContain("Technical sparring (club only)");

    const c = await call(practiceComplete.POST, { cookie, params: { id: r.json.plan.id }, body: { durationMin: 40, intensity: "moderate", rpe: 7, results: [] } });
    expect(c.status).toBe(200);
    expect(await db.activityEntry.count({ where: { userId, sport: "boxing", source: "practice" } })).toBe(1);
    expect((await call(practiceComplete.POST, { cookie, params: { id: r.json.plan.id }, body: { durationMin: 40 } })).status).toBe(409);
  });

  it("logs a practice once even when completion is sent twice at the same time", async () => {
    const { cookie, userId } = await newUser();
    await call(sport.POST, { cookie, params: { slug: "boxing" }, body: { level: "beginner", supervised: false } });
    const r = await call(practice.POST, { cookie, params: { slug: "boxing" }, body: { minutes: 30, focus: "balanced", setting: "solo", players: 1 } });
    const body = { durationMin: 30, intensity: "moderate", results: [] };
    const both = await Promise.all([1, 2].map(() => call(practiceComplete.POST, { cookie, params: { id: r.json.plan.id }, body })));
    expect(both.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(await db.activityEntry.count({ where: { userId, sport: "boxing", source: "practice" } })).toBe(1);
  });

  it("refuses to build practices for sports without a drill library", async () => {
    const { cookie } = await newUser();
    const r = await call(practice.POST, { cookie, params: { slug: "kitesurfing" }, body: { minutes: 30 } });
    expect(r.status).toBe(400);
  });

  it("does not let users read another user's practice", async () => {
    const a = await newUser();
    const b = await newUser();
    const r = await call(practice.POST, { cookie: a.cookie, params: { slug: "running" }, body: { minutes: 30 } });
    expect((await call(practiceItem.GET, { cookie: b.cookie, params: { id: r.json.plan.id } })).status).toBe(404);
  });
});

describe("sport metrics", () => {
  it("validates ratios, applies the minimum-attempts rule for personal bests and handles time metrics", async () => {
    const { cookie } = await newUser();
    const base = { params: { slug: "basketball" }, cookie };
    expect((await call(metrics.POST, { ...base, body: { metricKey: "free_throw_pct", made: 11, attempts: 10, dateKey: D } })).status).toBe(400);
    const small = await call(metrics.POST, { ...base, body: { metricKey: "free_throw_pct", made: 5, attempts: 5, dateKey: D } });
    expect(small.status).toBe(200);
    expect(small.json.entry.value).toBe(100);
    expect(small.json.needsMoreAttempts).toBe(10);
    await call(metrics.POST, { ...base, body: { metricKey: "free_throw_pct", made: 12, attempts: 20, dateKey: D } });
    const better = await call(metrics.POST, { ...base, body: { metricKey: "free_throw_pct", made: 15, attempts: 20, dateKey: D } });
    expect(better.json.personalBest).toBe(true);
    expect(better.json.previousBest).toBe(60); // the 5/5 doesn't count
    expect((await call(metrics.POST, { ...base, body: { metricKey: "made_up", value: 1, dateKey: D } })).status).toBe(400);

    const run = { params: { slug: "running" }, cookie };
    await call(metrics.POST, { ...run, body: { metricKey: "time_5k", value: 1800, dateKey: D } });
    const faster = await call(metrics.POST, { ...run, body: { metricKey: "time_5k", value: 1750, dateKey: D } });
    expect(faster.json.personalBest).toBe(true);
    expect((await call(metrics.POST, { ...run, body: { metricKey: "time_5k", value: 60, dateKey: D } })).status).toBe(400); // implausible
    expect((await call(metricItem.DELETE, { method: "DELETE", cookie, params: { id: faster.json.entry.id } })).status).toBe(200);

    const rev = await call(review.GET, { cookie, params: { slug: "basketball" } });
    expect(rev.status).toBe(200);
    expect(rev.json.trends[0].key).toBe("free_throw_pct");
  });

  it("includes sports data in the account export", async () => {
    const { cookie } = await newUser();
    await call(sport.POST, { cookie, params: { slug: "tennis" }, body: { level: "beginner" } });
    const r = await call(account.GET, { cookie });
    const data = typeof r.json === "string" ? JSON.parse(r.json) : r.json;
    expect(JSON.stringify(data)).toContain("tennis");
  });
});

describe("admin content workflow", () => {
  it("rejects non-admins", async () => {
    const { cookie } = await newUser();
    expect((await call(adminSports.GET, { cookie })).status).toBe(403);
    expect((await call(adminStatus.POST, { cookie, body: { type: "sport", id: "x", status: "published" } })).status).toBe(403);
  });

  it("keeps new sports and lessons hidden until published, and requires sources for rules", async () => {
    const a = await admin();
    const user = await newUser();
    const created = await call(adminSports.POST, {
      cookie: a.cookie,
      body: { slug: "test-ball", name: "Test ball", categorySlug: "team", summary: "A sport created in tests.", availability: "basic", metLight: 3, metModerate: 5, metVigorous: 7, profile: { beginner: ["Have fun."] } },
    });
    expect(created.status).toBe(200);
    expect((await call(sport.GET, { cookie: user.cookie, params: { slug: "test-ball" } })).status).toBe(404);

    const noSource = await call(adminContent.POST, { cookie: a.cookie, params: { slug: "test-ball" }, body: { type: "ruleset", data: { slug: "r", name: "Rules", governingBody: "Body", scope: "All", editionNote: "Test edition", points: [{ topic: "Scoring", text: "x" }], verification: "summary", sources: ["no-such-source"] } } });
    expect(noSource.status).toBe(400);

    const l = await call(adminContent.POST, { cookie: a.cookie, params: { slug: "test-ball" }, body: { type: "lesson", data: { slug: "basics", title: "Basics", level: "beginner", summary: "The basics.", content: { objectives: ["Learn"], keyPoints: ["Point"] } } } });
    expect(l.status).toBe(200);

    await call(adminStatus.POST, { cookie: a.cookie, body: { type: "sport", id: created.json.sport.id, status: "published" } });
    const hub = await call(sport.GET, { cookie: user.cookie, params: { slug: "test-ball" } });
    expect(hub.status).toBe(200);
    expect(hub.json.lessons).toHaveLength(0); // lesson still a draft

    await call(adminStatus.POST, { cookie: a.cookie, body: { type: "lesson", id: l.json.item.id, status: "published" } });
    expect((await call(sport.GET, { cookie: user.cookie, params: { slug: "test-ball" } })).json.lessons).toHaveLength(1);
  });
});

describe("sport-aware coach (rule-based mode)", () => {
  it("labels official rules with their source and separates suggestions and uncertainty", async () => {
    const { cookie } = await newUser();
    const r = await call(coach.POST, { cookie, body: { message: "What are the offside rules in football?" } });
    expect(r.status).toBe(200);
    const reply = r.json.messages.at(-1);
    expect(reply.provider).toBe("rules");
    expect(reply.content).toMatch(/Official rules — /);
    expect(reply.content).toMatch(/Source: /);
    expect(reply.content).toMatch(/Uncertain \/ check locally/);
    expect(reply.action[0]).toMatchObject({ type: "sport", slug: "football" });
  });

  it("builds a practice for the selected sport and keeps calisthenics workouts on the workout engine", async () => {
    const { cookie } = await newUser();
    const r = await call(coach.POST, { cookie, body: { message: "Build me a 30 minute practice", sport: "tennis" } });
    const reply = r.json.messages.at(-1);
    expect(reply.content).toMatch(/Coaching suggestion/);
    expect(reply.action.some((a: { type: string }) => a.type === "practice")).toBe(true);

    const w = await call(coach.POST, { cookie, body: { message: "Create my calisthenics workout for today" } });
    expect(w.json.messages.at(-1).action[0].type).toBe("workout");
  });

  it("says it has no verified rules summary instead of inventing one", async () => {
    const { cookie } = await newUser();
    const r = await call(coach.POST, { cookie, body: { message: "What are the rules of kitesurfing?" } });
    expect(r.json.messages.at(-1).content).toMatch(/don't have a reviewed rules summary/);
  });
});

describe("additive seeding", () => {
  it("adds missing content to existing sports but never touches admin-edited ones", async () => {
    const { seedSports } = await import("../prisma/seed-sports");
    const tennis = await db.sport.findUniqueOrThrow({ where: { slug: "tennis" } });
    const lesson = await db.lesson.findFirstOrThrow({ where: { sportId: tennis.id } });
    await db.lesson.update({ where: { id: lesson.id }, data: { title: "Edited by admin" } });
    await db.lesson.deleteMany({ where: { sportId: tennis.id, NOT: { id: lesson.id }, order: { gte: 5 } } });
    const custom = await db.sport.update({ where: { slug: "golf" }, data: { isCustom: true, summary: "Custom summary" } });
    await seedSports(db);
    expect((await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).title).toBe("Edited by admin"); // existing rows kept
    expect(await db.lesson.count({ where: { sportId: tennis.id } })).toBeGreaterThanOrEqual(6); // missing ones re-created
    expect((await db.sport.findUniqueOrThrow({ where: { id: custom.id } })).summary).toBe("Custom summary");
    expect(await db.ruleset.count({ where: { reviewedAt: { not: null } } })).toBe(0); // nothing claims a review
  });
});
