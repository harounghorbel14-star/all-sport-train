import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { call, newUser } from "./helpers";
import { seed } from "../prisma/seed";
import { db } from "@/lib/server/db";
import * as foods from "@/app/api/nutrition/foods/route";
import * as entries from "@/app/api/nutrition/entries/route";
import * as entry from "@/app/api/nutrition/entries/[id]/route";
import * as day from "@/app/api/nutrition/day/route";
import * as water from "@/app/api/nutrition/water/route";
import * as estimate from "@/app/api/nutrition/estimate/route";
import * as meals from "@/app/api/nutrition/meals/route";
import * as meal from "@/app/api/nutrition/meals/[id]/route";
import * as activity from "@/app/api/activity/route";
import * as activityItem from "@/app/api/activity/[id]/route";
import * as coach from "@/app/api/coach/route";
import * as photos from "@/app/api/progress/photos/route";
import * as media from "@/app/api/media/[id]/route";
import * as formCheck from "@/app/api/form-check/route";
import * as formCheckItem from "@/app/api/form-check/[id]/route";
import * as exportRoute from "@/app/api/account/export/route";
import * as account from "@/app/api/account/route";
import * as measurements from "@/app/api/progress/measurements/route";
import * as analytics from "@/app/api/progress/analytics/route";
import * as posts from "@/app/api/community/posts/route";
import * as feed from "@/app/api/community/feed/route";
import * as friends from "@/app/api/community/friends/route";
import * as friend from "@/app/api/community/friends/[id]/route";
import * as block from "@/app/api/community/block/route";
import * as react from "@/app/api/community/posts/[id]/react/route";
import * as athlete from "@/app/api/community/athletes/[handle]/route";
import * as challenges from "@/app/api/challenges/route";
import * as challenge from "@/app/api/challenges/[id]/route";
import * as notifications from "@/app/api/notifications/route";
import * as mobility from "@/app/api/recovery/mobility/route";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const D = "2026-10-12";

beforeAll(async () => {
  await seed(db);
});

describe("nutrition", () => {
  it("searches foods, logs servings with correct maths, edits and removes entries", async () => {
    const { cookie } = await newUser();
    const s = await call(foods.GET, { cookie, path: "/api/nutrition/foods?q=rice" });
    const rice = s.json.foods.find((f: { name: string }) => f.name === "White rice, cooked");
    expect(rice).toBeTruthy();
    const add = await call(entries.POST, { cookie, body: { dateKey: D, meal: "lunch", foodId: rice.id, grams: 158, servingLabel: "1 cup (158 g)" } });
    expect(add.json.entry.kcal).toBe(205);
    expect(add.json.entry.carbsG).toBeCloseTo(44.6, 1);
    const edit = await call(entry.PATCH, { method: "PATCH", cookie, params: { id: add.json.entry.id }, body: { grams: 316 } });
    expect(edit.json.entry.kcal).toBe(411);
    const d = await call(day.GET, { cookie, path: `/api/nutrition/day?date=${D}` });
    expect(d.json.summary.total.kcal).toBe(411);
    expect(d.json.summary.byMeal.lunch.kcal).toBe(411);
    await call(entry.DELETE, { method: "DELETE", cookie, params: { id: add.json.entry.id } });
    expect((await call(day.GET, { cookie, path: `/api/nutrition/day?date=${D}` })).json.summary.total.kcal).toBe(0);
  });

  it("tracks water and saved meals", async () => {
    const { cookie } = await newUser();
    await call(water.POST, { cookie, body: { dateKey: D, ml: 250 } });
    await call(water.POST, { cookie, body: { dateKey: D, ml: 500 } });
    expect((await call(day.GET, { cookie, path: `/api/nutrition/day?date=${D}` })).json.waterMl).toBe(750);
    const saved = await call(meals.POST, { cookie, body: { name: "Oats bowl", items: [{ name: "Oats", grams: 40, kcal: 152, proteinG: 5, carbsG: 27, fatG: 3 }] } });
    expect(saved.status).toBe(200);
    await call(meal.POST, { cookie, params: { id: saved.json.meal.id }, body: { dateKey: D, meal: "breakfast", portion: 2 } });
    expect((await call(day.GET, { cookie, path: `/api/nutrition/day?date=${D}` })).json.summary.byMeal.breakfast.kcal).toBe(304);
  });

  it("uses the local estimator (never 'high' confidence) when no AI is configured", async () => {
    const { cookie } = await newUser();
    const r = await call(estimate.POST, { cookie, body: { text: "2 boiled eggs and a banana" } });
    expect(r.status).toBe(200);
    expect(r.json.estimate.provider).toBe("local");
    expect(r.json.estimate.overallConfidence).toBe("low");
    expect(r.json.estimate.disclaimer).toMatch(/estimates/);
    expect(r.json.estimate.items.length).toBe(2);
    const photo = await call(estimate.POST, { cookie, body: { image: { data: JPEG.toString("base64"), mediaType: "image/jpeg" } } });
    expect(photo.status).toBe(400);
    expect(photo.json.error.message).toMatch(/AI provider/);
  });
});

describe("activity & calorie estimates", () => {
  it("estimates calories with a range and blocks duplicate imports", async () => {
    const { cookie } = await newUser();
    const run = await call(activity.POST, { cookie, body: { sport: "running", dateKey: D, durationMin: 30, intensity: "moderate", distanceKm: 5, metrics: { sessionType: "easy" } } });
    expect(run.status).toBe(200);
    expect(run.json.estimate.basis).toBe("pace");
    expect(run.json.entry.kcalLow).toBeLessThan(run.json.entry.kcalHigh);
    const imp = { sport: "cycling", dateKey: D, durationMin: 60, intensity: "moderate", distanceKm: 25, externalId: "strava-123" };
    expect((await call(activity.POST, { cookie, body: imp })).status).toBe(200);
    expect((await call(activity.POST, { cookie, body: imp })).status).toBe(409);
    expect((await call(activity.POST, { cookie, body: { sport: "swimming", dateKey: D, durationMin: 30, intensity: "light", metrics: { stroke: "doggy" } } })).status).toBe(400);
    expect((await call(activity.POST, { cookie, body: { sport: "quidditch", dateKey: D, durationMin: 30, intensity: "light" } })).status).toBe(400);
    const o = await call(activity.GET, { cookie });
    expect(o.json.tdee).toBeTruthy();
    await call(activityItem.DELETE, { method: "DELETE", cookie, params: { id: run.json.entry.id } });
  });
});

describe("AI coach fallback", () => {
  it("answers with rule-based coaching and real actions when no AI key is set", async () => {
    const { cookie } = await newUser();
    const r = await call(coach.POST, { cookie, body: { message: "I only have 20 minutes" } });
    expect(r.status).toBe(200);
    const last = r.json.messages.at(-1);
    expect(last.provider).toBe("rules");
    expect(last.action[0].type).toBe("workout");
    const planId = last.action[0].planId;
    expect(await db.workoutPlan.findUnique({ where: { id: planId } })).toBeTruthy();

    const teach = await call(coach.POST, { cookie, body: { message: "Teach me how to perform a proper push-up" } });
    expect(teach.json.messages.at(-1).action[0]).toMatchObject({ type: "exercise", slug: "push-up" });

    const pain = await call(coach.POST, { cookie, body: { message: "I felt a sharp pain in my shoulder, adapt my workout" } });
    expect(pain.json.messages.at(-1).content).toMatch(/can't diagnose/);

    const emergency = await call(coach.POST, { cookie, body: { message: "I have chest pain during workouts" } });
    expect(emergency.json.messages.at(-1).content).toMatch(/emergency/i);
    expect(emergency.json.messages.at(-1).action).toEqual([]);

    const status = await call(coach.GET, { cookie });
    expect(status.json.ai.configured).toBe(false);
  });
});

describe("uploads & private media", () => {
  it("validates file contents, requires consent and serves media only to the owner", async () => {
    const a = await newUser();
    const b = await newUser();
    const form = (file: Buffer, consent = "true") => {
      const f = new FormData();
      f.set("file", new Blob([file]), "photo.jpg");
      f.set("pose", "front");
      f.set("dateKey", D);
      f.set("consent", consent);
      return f;
    };
    expect((await call(photos.POST, { cookie: a.cookie, form: form(JPEG, "false") })).status).toBe(400);
    expect((await call(photos.POST, { cookie: a.cookie, form: form(Buffer.from("<script>alert(1)</script>xxxxxxxx")) })).status).toBe(400);
    const ok = await call(photos.POST, { cookie: a.cookie, form: form(JPEG) });
    expect(ok.status).toBe(200);
    const id = ok.json.photo.id;
    const own = await call(media.GET, { cookie: a.cookie, params: { id } });
    expect(own.status).toBe(200);
    expect(own.res.headers.get("cache-control")).toContain("private");
    expect((await call(media.GET, { cookie: b.cookie, params: { id } })).status).toBe(404);
    expect((await call(media.GET, { params: { id } })).status).toBe(401);
    expect((await call(media.DELETE, { method: "DELETE", cookie: b.cookie, params: { id } })).status).toBe(404);
    expect((await call(media.DELETE, { method: "DELETE", cookie: a.cookie, params: { id } })).status).toBe(200);
  });

  it("runs a guided form check without retaining media by default", async () => {
    const { cookie, userId } = await newUser();
    const f = new FormData();
    f.set("exercise", "push-up");
    f.set("mediaKind", "photo");
    f.set("consent", "true");
    f.append("frames", new Blob([JPEG]), "f.jpg");
    const r = await call(formCheck.POST, { cookie, form: f });
    expect(r.status).toBe(200);
    expect(r.json.result.provider).toBe("guided");
    expect(r.json.result.notAssessable.length).toBeGreaterThan(0);
    expect(r.json.mediaId).toBeNull();
    expect(await db.mediaUpload.count({ where: { userId } })).toBe(0);
    expect((await call(formCheckItem.DELETE, { method: "DELETE", cookie, params: { id: r.json.id } })).status).toBe(200);
  });
});

describe("export & deletion", () => {
  it("exports the user's data without secrets and deletes everything", async () => {
    const { cookie, userId } = await newUser();
    await call(measurements.POST, { cookie, body: { dateKey: D, weightKg: 74, waistCm: 80 } });
    const f = new FormData();
    f.set("file", new Blob([JPEG]), "p.jpg");
    f.set("pose", "side");
    f.set("dateKey", D);
    f.set("consent", "true");
    await call(photos.POST, { cookie, form: f });
    const dir = path.join(process.env.UPLOAD_DIR!, userId);
    expect(readdirSync(dir).length).toBe(1);

    const ex = await call(exportRoute.GET, { cookie });
    expect(ex.status).toBe(200);
    expect(ex.res.headers.get("content-disposition")).toContain("attachment");
    expect(ex.json.data.measurements).toHaveLength(2);
    expect(JSON.stringify(ex.json)).not.toContain("scrypt$");

    expect((await call(account.DELETE, { method: "DELETE", cookie, body: { password: "wrong-password1", confirm: "DELETE" } })).status).toBe(401);
    expect((await call(account.DELETE, { method: "DELETE", cookie, body: { password: "password123", confirm: "DELETE" } })).status).toBe(200);
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await db.bodyMeasurement.count({ where: { userId } })).toBe(0);
    expect(existsSync(dir)).toBe(false);
  });
});

describe("progress analytics", () => {
  it("returns empty-but-valid analytics for new users (no fabricated data)", async () => {
    const { cookie } = await newUser();
    const r = await call(analytics.GET, { cookie, path: "/api/progress/analytics?range=4w" });
    expect(r.json.perWeek).toHaveLength(4);
    expect(r.json.perWeek.every((w: { workouts: number }) => w.workouts === 0)).toBe(true);
    expect(r.json.totals.workouts).toBe(0);
  });
});

describe("community & privacy", () => {
  it("respects friends-only visibility, blocking and reactions", async () => {
    const a = await newUser();
    const b = await newUser();
    const c = await newUser();
    const handleOf = async (userId: string) => (await db.profile.findUnique({ where: { userId } }))!.handle;
    const hb = await handleOf(b.userId);

    const p = await call(posts.POST, { cookie: a.cookie, body: { body: "First week done!", kind: "text", visibility: "friends" } });
    expect(p.status).toBe(200);
    expect((await call(feed.GET, { cookie: b.cookie })).json.posts.some((x: { id: string }) => x.id === p.json.post.id)).toBe(false);

    const req = await call(friends.POST, { cookie: a.cookie, body: { handle: hb } });
    await call(friend.PATCH, { method: "PATCH", cookie: b.cookie, params: { id: req.json.request.id }, body: { accept: true } });
    expect((await call(feed.GET, { cookie: b.cookie })).json.posts.some((x: { id: string }) => x.id === p.json.post.id)).toBe(true);
    expect((await call(react.POST, { cookie: b.cookie, params: { id: p.json.post.id } })).json.reacted).toBe(true);
    expect((await call(react.POST, { cookie: c.cookie, params: { id: p.json.post.id } })).status).toBe(404);

    // Profiles never expose body data
    const prof = await call(athlete.GET, { cookie: b.cookie, params: { handle: await handleOf(a.userId) } });
    expect(prof.json.athlete.weightKg).toBeUndefined();

    await call(block.POST, { cookie: b.cookie, body: { handle: await handleOf(a.userId) } });
    expect((await call(feed.GET, { cookie: b.cookie })).json.posts.some((x: { id: string }) => x.id === p.json.post.id)).toBe(false);
    expect((await call(friends.POST, { cookie: a.cookie, body: { handle: hb } })).status).toBe(403);
  });

  it("rejects spammy posts", async () => {
    const { cookie } = await newUser();
    const r = await call(posts.POST, { cookie, body: { body: "buy http://a.com http://b.com http://c.com", kind: "text", visibility: "public" } });
    expect(r.status).toBe(400);
  });
});

describe("challenges & notifications", () => {
  it("computes challenge progress from logged data", async () => {
    const { cookie } = await newUser();
    const list = await call(challenges.GET, { cookie });
    const mob = list.json.challenges.find((c: { metric: string; active: boolean }) => c.metric === "mobility_sessions" && c.active);
    await call(challenge.POST, { cookie, params: { id: mob.id }, body: { join: true } });
    await call(mobility.POST, { cookie, body: { routine: "hip-opener", dateKey: mob.startsOn } });
    const after = await call(challenges.GET, { cookie });
    expect(after.json.challenges.find((c: { id: string }) => c.id === mob.id).progress).toBe(1);
  });

  it("lists notifications and marks them read", async () => {
    const { cookie } = await newUser();
    const n = await call(notifications.GET, { cookie });
    expect(n.status).toBe(200);
    expect(typeof n.json.unread).toBe("number");
    expect((await call(notifications.PATCH, { method: "PATCH", cookie, body: {} })).status).toBe(200);
  });
});
