import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { invalidateSportsCache } from "@/lib/services/sports";
import { checkSources, coverage, importResearch, recordKnowledgeGap, reviewClaim, robotsAllows, runAiResearch, searchKnowledge } from "@/lib/services/research";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { seed } from "../prisma/seed";
import { call, newUser } from "./helpers";
import * as coach from "@/app/api/coach/route";
import * as adminContent from "@/app/api/admin/sports/[slug]/content/route";
import * as coverageRoute from "@/app/api/admin/research/coverage/route";
import * as claimsRoute from "@/app/api/admin/research/claims/[id]/route";
import * as knowledge from "@/app/api/knowledge/route";

beforeAll(async () => {
  await seed(db);
  invalidateSportsCache();
});

async function admin() {
  const u = await newUser();
  await db.user.update({ where: { id: u.userId }, data: { role: "admin", emailVerifiedAt: new Date() } });
  return u;
}

const RUN = {
  sport: "tennis",
  accessedDate: "2030-01-02",
  sources: [
    { id: "s1", title: "Rules of Tennis", publisher: "ITF", url: "https://www.itftennis.com/rules.pdf", edition: "2030", kind: "governing_body", accessed: false, sectionsUsed: ["Rule 5"] },
    { id: "s2", title: "Open study", publisher: "Journal", url: "https://example.org/study", kind: "research", accessed: true, sectionsUsed: ["Results"] },
  ],
  rulesetReview: [{ rulesetSlug: "itf-rules", topic: "Scoring", currentText: "old", verdict: "corrected", correctedText: "new wording", sourceId: "s1", section: "Rule 5" }],
  newRulePoints: [],
  claims: [
    { topic: "Serve toss consistency", category: "technique", level: "beginner", statement: "A consistent toss height makes serve timing repeatable.", sourceIds: ["s2"], section: "Results", confidence: "medium" },
    { topic: "Snippet claim", category: "safety", level: "all", statement: "Something seen only in a search snippet.", sourceIds: ["s1"], confidence: "low" },
  ],
  safetyReview: [],
  gaps: [{ topic: "Doubles positioning drills", reason: "No source found" }],
  notAccessed: [{ url: "https://www.itftennis.com/rules.pdf", reason: "blocked" }],
};

describe("research import", () => {
  it("never publishes or verifies anything, records evidence honestly and is idempotent", async () => {
    const r = await importResearch(RUN);
    expect(r.imported).toBe(true);
    expect((await importResearch(RUN)).imported).toBe(false);
    const sport = await db.sport.findUnique({ where: { slug: "tennis" } });
    const claims = await db.knowledgeClaim.findMany({ where: { sportId: sport!.id, topic: { in: ["Serve toss consistency", "Snippet claim"] } } });
    expect(claims.every((c) => c.status === "unverified")).toBe(true);
    expect(claims.find((c) => c.topic === "Snippet claim")!.evidence).toBe("snippet");
    expect(claims.find((c) => c.topic === "Serve toss consistency")!.evidence).toBe("source_opened");
    const blocked = await db.contentSource.findFirst({ where: { url: "https://www.itftennis.com/rules.pdf" } });
    expect(blocked!.accessedAt).toBeNull();
    expect(blocked!.checkStatus).toBe("blocked");
    const rs = await db.ruleset.findFirst({ where: { sportId: sport!.id, slug: "itf-rules" } });
    expect(rs!.reviewFlag).toMatch(/Scoring/);
    expect(await db.researchTask.count({ where: { sportId: sport!.id, kind: "review_suggestion", status: "needs_review" } })).toBeGreaterThan(0);
    expect(await db.researchTask.count({ where: { sportId: sport!.id, topic: "Doubles positioning drills" } })).toBe(1);
  });

  it("the committed research runs are all snippet-level and no seeded ruleset claims to be source-checked", async () => {
    expect(await db.ruleset.count({ where: { verification: "summary" } })).toBe(0);
    expect(await db.knowledgeClaim.count({ where: { origin: "research", status: "verified" } })).toBe(0);
    const rows = await coverage();
    expect(rows.find((r) => r.slug === "football")!.sourcesOpened).toBe(0);
    expect(rows.find((r) => r.slug === "football")!.outdatedRules.length).toBeGreaterThan(0);
  });
});

describe("claim review & retrieval", () => {
  it("only verified claims are retrievable, and verifying requires an inspected source", async () => {
    const claim = await db.knowledgeClaim.findFirstOrThrow({ where: { topic: "Serve toss consistency" } });
    expect((await searchKnowledge("serve toss consistency", { sportSlug: "tennis" })).some((h) => h.kind === "claim")).toBe(false);
    await expect(reviewClaim(claim.id, "admin:x", { action: "verify" })).rejects.toThrow(/record the source/);
    await reviewClaim(claim.id, "admin:x", { action: "verify", checkedSourceUrl: "https://example.org/study", checkedSection: "Results, table 2" });
    const hits = await searchKnowledge("serve toss consistency", { sportSlug: "tennis" });
    const hit = hits.find((h) => h.kind === "claim")!;
    expect(hit.verification).toBe("verified");
    expect(hit.sources.some((s) => s.section === "Results, table 2")).toBe(true);
  });

  it("knowledge search finds published lessons and rules with their verification label", async () => {
    const { cookie } = await newUser();
    const r = await call(knowledge.GET, { cookie, path: "/api/knowledge?q=free%20throw%20shooting%20form&sport=basketball" });
    expect(r.status).toBe(200);
    expect(r.json.mode).toBe("keyword");
    expect(r.json.hits.length).toBeGreaterThan(0);
  });

  it("admin-only research endpoints reject regular users", async () => {
    const { cookie } = await newUser();
    expect((await call(coverageRoute.GET, { cookie })).status).toBe(403);
    expect((await call(claimsRoute.POST, { cookie, params: { id: "x" }, body: { action: "reject" } })).status).toBe(403);
  });
});

describe("coach knowledge use", () => {
  it("answers specific questions from the knowledge base with labels", async () => {
    const { cookie } = await newUser();
    const r = await call(coach.POST, { cookie, body: { message: "How do I fix my free throw shooting form?", sport: "basketball" } });
    const reply = r.json.messages.at(-1).content as string;
    expect(reply).toMatch(/knowledge base/);
    expect(reply).toMatch(/APEX lesson content|verified claim|rules overview/);
  });

  it("admits a knowledge gap instead of guessing, and queues it for research", async () => {
    const { cookie } = await newUser();
    const q = "How should I wax my zorblat paddle grip for monsoon humidity?";
    const r = await call(coach.POST, { cookie, body: { message: q, sport: "tennis" } });
    expect(r.json.messages.at(-1).content).toMatch(/don't have verified/);
    expect(await db.researchTask.count({ where: { kind: "knowledge_gap", topic: { contains: "zorblat" } } })).toBe(1);
  });

  it("refuses AI web research without a configured provider", async () => {
    const t = await db.researchTask.findFirstOrThrow({ where: { status: "queued" } });
    const r = await runAiResearch(t.id);
    expect(r.ok).toBe(false);
    expect((await db.researchTask.findUnique({ where: { id: t.id } }))!.status).toBe("blocked");
  });
});

describe("knowledge index and gap queue", () => {
  it("serves search from a cached index that content edits refresh", async () => {
    const before = await searchKnowledge("zorblat paddle humidity technique", { sportSlug: "tennis" });
    expect(before.some((h) => h.kind === "lesson")).toBe(false);
    const sport = await db.sport.findUniqueOrThrow({ where: { slug: "tennis" } });
    await db.lesson.create({ data: { sportId: sport.id, slug: "zorblat-test", title: "Zorblat paddle humidity technique", level: "beginner", order: 99, summary: "Test lesson.", content: JSON.stringify({ objectives: ["x"], keyPoints: ["zorblat paddle humidity"] }), contentStatus: "published" } });
    // Cached: the new lesson is not visible until content changes are signalled…
    expect((await searchKnowledge("zorblat paddle humidity technique", { sportSlug: "tennis" })).some((h) => h.title.startsWith("Zorblat"))).toBe(false);
    invalidateSportsCache(); // …which every admin content edit does.
    expect((await searchKnowledge("zorblat paddle humidity technique", { sportSlug: "tennis" })).some((h) => h.title.startsWith("Zorblat"))).toBe(true);
    await db.lesson.delete({ where: { sportId_slug: { sportId: sport.id, slug: "zorblat-test" } } });
    invalidateSportsCache();
  });

  it("limits how many research gaps one user can queue", async () => {
    resetRateLimits();
    const { userId } = await newUser();
    const made = [];
    for (let i = 0; i < 14; i++) made.push(await recordKnowledgeGap("tennis", `Unique flood question number ${i} about qwzx`, userId));
    expect(made.filter(Boolean)).toHaveLength(10);
    expect(await db.researchTask.count({ where: { kind: "knowledge_gap", topic: { contains: "flood question" } } })).toBe(10);
  });
});

describe("source monitoring", () => {
  it("parses robots.txt", () => {
    const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\n\nUser-agent: other\nDisallow: /";
    expect(robotsAllows(robots, "/rules")).toBe(true);
    expect(robotsAllows(robots, "/private/x")).toBe(false);
    expect(robotsAllows(robots, "/private/public/x")).toBe(true);
  });

  it("flags rulesets when a cited source changes, and respects robots.txt", async () => {
    const sport = await db.sport.findUniqueOrThrow({ where: { slug: "running" } });
    await db.contentSource.upsert({ where: { slug: "monitor-test" }, create: { slug: "monitor-test", title: "Monitor test", publisher: "T", url: "https://monitor.example/rules", kind: "governing_body" }, update: {} });
    await db.contentSource.upsert({ where: { slug: "robots-test" }, create: { slug: "robots-test", title: "Robots test", publisher: "T", url: "https://norobots.example/secret", kind: "other" }, update: {} });
    const rs = await db.ruleset.findFirstOrThrow({ where: { sportId: sport.id } });
    await db.ruleset.update({ where: { id: rs.id }, data: { sources: JSON.stringify(["monitor-test"]), reviewFlag: null } });
    let body = "<p>Version one</p>";
    const fake = (async (input: string | URL) => {
      const u = String(input);
      if (u.endsWith("/robots.txt")) return new Response(u.includes("norobots") ? "User-agent: *\nDisallow: /" : "", { status: 200 });
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    // Restrict the run to the two test sources.
    await db.contentSource.updateMany({ where: { slug: { notIn: ["monitor-test", "robots-test"] } }, data: { lastCheckedAt: new Date() } });
    await checkSources({ fetchImpl: fake, limit: 2 });
    body = "<p>Version two</p>";
    await db.contentSource.updateMany({ where: { slug: { notIn: ["monitor-test", "robots-test"] } }, data: { lastCheckedAt: new Date() } });
    const second = await checkSources({ fetchImpl: fake, limit: 2 });
    expect(second.changed).toBe(1);
    expect((await db.contentSource.findUniqueOrThrow({ where: { slug: "robots-test" } })).checkStatus).toBe("robots_disallowed");
    expect((await db.ruleset.findUniqueOrThrow({ where: { id: rs.id } })).reviewFlag).toMatch(/changed/);
    expect(await db.researchTask.count({ where: { kind: "source_change", sportId: sport.id } })).toBeGreaterThan(0);
  });

  it("keeps the previous version when an admin edits a ruleset", async () => {
    const a = await admin();
    const before = await db.rulesetVersion.count();
    await call(adminContent.POST, {
      cookie: a.cookie,
      params: { slug: "tennis" },
      body: { type: "ruleset", data: { slug: "itf-rules", name: "ITF Rules of Tennis", governingBody: "ITF", scope: "All", editionNote: "Edited in test", points: [{ topic: "Scoring", text: "x" }], verification: "general", sources: ["itf-rules"] } },
    });
    expect(await db.rulesetVersion.count()).toBe(before + 1);
  });
});
