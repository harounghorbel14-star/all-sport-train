import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../server/db";
import { badRequest, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { log } from "../server/logger";
import { lessonContentSchema, rulePointSchema } from "../content/sports/types";

/**
 * Sports research & knowledge engine.
 *
 * Honesty rules enforced here:
 * - A source counts as "inspected" only when `accessedAt` is set (someone actually opened it).
 * - Claims start as `unverified`; only a reviewer can mark one `verified`, and only verified
 *   claims (plus published lessons/drills/rules) are retrieved for users and the coach.
 * - Research suggestions never change published content directly — they become review tasks.
 */

// ── Research import (output of a research run) ─────────────────────────
const sourceSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  publisher: z.string().max(200).default(""),
  url: z.string().max(500).nullable().optional(),
  edition: z.string().max(80).nullable().optional(),
  kind: z.string().max(40).default("other"),
  accessed: z.boolean().default(false),
  sectionsUsed: z.array(z.string().max(200)).max(20).default([]),
});
export const researchFileSchema = z.object({
  sport: z.string(),
  accessedDate: z.string().max(20),
  sources: z.array(sourceSchema).max(60),
  rulesetReview: z
    .array(z.object({ rulesetSlug: z.string(), topic: z.string(), currentText: z.string().default(""), verdict: z.enum(["confirmed", "corrected", "unverifiable"]), correctedText: z.string().optional(), sourceId: z.string().optional(), section: z.string().optional(), note: z.string().optional() }))
    .default([]),
  newRulePoints: z.array(z.object({ rulesetSlug: z.string(), topic: z.string(), text: z.string(), sourceId: z.string().optional(), section: z.string().optional() })).default([]),
  claims: z
    .array(z.object({ topic: z.string(), category: z.string(), level: z.string().default("all"), statement: z.string(), sourceIds: z.array(z.string()).default([]), section: z.string().optional(), confidence: z.enum(["high", "medium", "low"]).default("low") }))
    .default([]),
  safetyReview: z.array(z.object({ currentText: z.string().default(""), verdict: z.enum(["confirmed", "corrected", "unverifiable"]), correctedText: z.string().optional(), sourceId: z.string().optional(), section: z.string().optional() })).default([]),
  gaps: z.array(z.object({ topic: z.string(), reason: z.string() })).default([]),
  notAccessed: z.array(z.object({ url: z.string(), reason: z.string() })).default([]),
});
export type ResearchFile = z.infer<typeof researchFileSchema>;

const sourceSlug = (url: string | null | undefined, title: string) => {
  const base = url ? new URL(url).hostname.replace(/^www\./, "").split(".").slice(0, -1).join("-") : "src";
  return `${base.slice(0, 30)}-${createHash("sha1").update(url ?? title).digest("hex").slice(0, 8)}`.toLowerCase();
};

type SourceRef = { slug: string; url: string | null; title: string; publisher: string; section?: string; accessed: boolean };

/**
 * Imports a research run. Idempotent per (sport, accessedDate): re-importing the same run is a no-op.
 * Nothing is published: claims are unverified, suggested rule changes become review tasks and
 * flag the affected ruleset as possibly outdated.
 */
export async function importResearch(raw: unknown, opts: { origin?: string } = {}) {
  const data = researchFileSchema.parse(raw);
  const sport = await db.sport.findUnique({ where: { slug: data.sport }, include: { rulesets: true } });
  if (!sport) throw notFound(`Unknown sport ${data.sport}`);
  const marker = `research-run:${data.accessedDate}`;
  if (await db.researchTask.findFirst({ where: { sportId: sport.id, kind: "research_topic", topic: marker } })) return { imported: false, sport: sport.slug };

  const blocked = new Set(data.notAccessed.map((n) => n.url));
  const refs = new Map<string, SourceRef>();
  for (const s of data.sources) {
    const url = s.url && /^https:\/\//.test(s.url) ? s.url : null;
    const slug = sourceSlug(url, s.title);
    await db.contentSource.upsert({
      where: { slug },
      create: {
        slug,
        title: s.title,
        publisher: s.publisher || "Unknown",
        url,
        kind: ["governing_body", "education", "research"].includes(s.kind) ? s.kind : "other",
        edition: s.edition ?? null,
        notes: s.accessed ? null : "Found via search; not yet opened and read.",
        accessedAt: s.accessed ? new Date(`${data.accessedDate}T12:00:00Z`) : null,
        accessedBy: s.accessed ? (opts.origin ?? "research") : null,
        checkStatus: url && blocked.has(url) ? "blocked" : null,
        lastCheckedAt: url && blocked.has(url) ? new Date(`${data.accessedDate}T12:00:00Z`) : null,
      },
      update: s.accessed ? { accessedAt: new Date(`${data.accessedDate}T12:00:00Z`), accessedBy: opts.origin ?? "research" } : {},
    });
    refs.set(s.id, { slug, url, title: s.title, publisher: s.publisher, accessed: s.accessed });
  }
  const refsFor = (ids: (string | undefined)[], section?: string) =>
    ids
      .map((id) => (id ? refs.get(id) : undefined))
      .filter((r): r is SourceRef => Boolean(r))
      .map((r) => ({ ...r, section }));
  const evidenceOf = (rs: SourceRef[]) => (rs.some((r) => r.accessed) ? "source_opened" : "snippet");

  let claims = 0;
  for (const c of data.claims) {
    const rs = refsFor(c.sourceIds, c.section);
    await db.knowledgeClaim.create({
      data: { sportId: sport.id, topic: c.topic.slice(0, 120), category: c.category, level: c.level, statement: c.statement.slice(0, 800), sourceRefs: JSON.stringify(rs), confidence: c.confidence, status: "unverified", evidence: evidenceOf(rs), origin: opts.origin ?? "research" },
    });
    claims++;
  }

  // Rule review → tasks + "possibly outdated" flags. Confirmed-from-snippets doesn't upgrade anything.
  const flags = new Map<string, string[]>();
  let tasks = 0;
  for (const r of data.rulesetReview.filter((x) => x.verdict === "corrected" || (x.note && /20(2[5-9])|new|change|amend|replac/i.test(x.note)))) {
    const rs = refsFor([r.sourceId], r.section);
    await db.researchTask.create({
      data: {
        sportId: sport.id,
        kind: "review_suggestion",
        topic: `Rule: ${r.topic}`.slice(0, 160),
        detail: r.note ?? null,
        status: "needs_review",
        priority: r.verdict === "corrected" ? 1 : 2,
        result: JSON.stringify({ rulesetSlug: r.rulesetSlug, current: r.currentText, suggested: r.correctedText ?? null, sources: rs, evidence: evidenceOf(rs) }),
      },
    });
    tasks++;
    if (r.verdict === "corrected") flags.set(r.rulesetSlug, [...(flags.get(r.rulesetSlug) ?? []), r.topic]);
  }
  for (const p of data.newRulePoints) {
    const rs = refsFor([p.sourceId], p.section);
    await db.researchTask.create({
      data: { sportId: sport.id, kind: "review_suggestion", topic: `New rule point: ${p.topic}`.slice(0, 160), status: "needs_review", priority: 2, result: JSON.stringify({ rulesetSlug: p.rulesetSlug, current: null, suggested: p.text, sources: rs, evidence: evidenceOf(rs) }) },
    });
    tasks++;
    if (/20(2[5-9])|chang|new|replac/i.test(`${p.topic} ${p.text}`)) flags.set(p.rulesetSlug, [...(flags.get(p.rulesetSlug) ?? []), p.topic]);
  }
  for (const s of data.safetyReview.filter((x) => x.verdict === "corrected")) {
    const rs = refsFor([s.sourceId], s.section);
    await db.researchTask.create({
      data: { sportId: sport.id, kind: "review_suggestion", topic: `Safety: ${s.currentText.slice(0, 120)}`, status: "needs_review", priority: 1, result: JSON.stringify({ current: s.currentText, suggested: s.correctedText ?? null, sources: rs, evidence: evidenceOf(rs) }) },
    });
    tasks++;
  }
  for (const g of data.gaps) {
    await db.researchTask.create({ data: { sportId: sport.id, kind: "research_topic", topic: g.topic.slice(0, 160), detail: g.reason, status: "queued", priority: 2 } });
    tasks++;
  }
  for (const [slug, topics] of flags) {
    const rs = sport.rulesets.find((r) => r.slug === slug);
    if (!rs) continue;
    await db.ruleset.update({
      where: { id: rs.id },
      data: { reviewFlag: `Unverified research leads (${data.accessedDate}) suggest changes to: ${[...new Set(topics)].slice(0, 5).join(", ")}. Check the current official rulebook.`.slice(0, 500), flaggedAt: new Date() },
    });
  }
  const anyOpened = data.sources.some((s) => s.accessed);
  await db.researchTask.create({
    data: {
      sportId: sport.id,
      kind: "research_topic",
      topic: marker,
      detail: anyOpened ? "Research run imported." : "Research run imported, but no source could be opened (network policy) — all findings are snippet-level and need verification.",
      status: anyOpened ? "done" : "blocked",
      priority: 3,
      lastRunAt: new Date(`${data.accessedDate}T12:00:00Z`),
    },
  });
  return { imported: true, sport: sport.slug, claims, tasks, sourcesOpened: data.sources.filter((s) => s.accessed).length };
}

// ── Research queue ─────────────────────────────────────────────────────
const CORE_TOPICS = ["Governing bodies and official rules", "Fundamental techniques", "Beginner learning path", "Common mistakes and corrections", "Safety and injury prevention", "Conditioning for the sport"];
const ADVANCED_TOPICS = ["Advanced techniques and variations", "Tactics and decision-making", "Evidence-based training research", "Competition preparation"];

/** Makes sure every published sport has its baseline research tasks (idempotent). */
export async function initResearchQueue() {
  const sports = await db.sport.findMany({ where: { contentStatus: "published" }, select: { id: true, availability: true, rulesets: { select: { slug: true, name: true } } } });
  const existing = new Set((await db.researchTask.findMany({ select: { sportId: true, topic: true } })).map((t) => `${t.sportId}:${t.topic}`));
  const rows: { sportId: string; kind: string; topic: string; priority: number; detail?: string }[] = [];
  for (const s of sports) {
    const add = (kind: string, topic: string, priority: number, detail?: string) => {
      if (!existing.has(`${s.id}:${topic}`)) rows.push({ sportId: s.id, kind, topic, priority, detail });
    };
    for (const r of s.rulesets) add("verify_rules", `Verify ruleset: ${r.name}`, 1, "Open the current official rulebook, check every rule point and record the edition and sections.");
    if (s.availability === "external") add("research_topic", "Identify certified instruction and safety bodies", 2);
    else for (const t of CORE_TOPICS) add("research_topic", t, s.availability === "full" ? 2 : 3);
    if (s.availability === "full") for (const t of ADVANCED_TOPICS) add("research_topic", t, 3);
  }
  if (rows.length) await db.researchTask.createMany({ data: rows });
  return rows.length;
}

export async function listTasks(filters: { sportSlug?: string; status?: string; limit?: number } = {}) {
  const sport = filters.sportSlug ? await db.sport.findUnique({ where: { slug: filters.sportSlug }, select: { id: true } }) : null;
  const rows = await db.researchTask.findMany({
    where: { ...(sport ? { sportId: sport.id } : {}), ...(filters.status ? { status: filters.status } : { status: { notIn: ["done", "dismissed"] } }), NOT: { topic: { startsWith: "research-run:" } } },
    include: { sport: { select: { slug: true, name: true } } },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: Math.min(filters.limit ?? 100, 500),
  });
  return rows.map((t) => ({ ...t, result: parseJson(t.result, z.record(z.string(), z.unknown()), {}) }));
}

export async function setTaskStatus(id: string, status: "queued" | "in_progress" | "needs_review" | "done" | "blocked" | "dismissed") {
  return db.researchTask.update({ where: { id }, data: { status } });
}

// ── Claims review ──────────────────────────────────────────────────────
export const claimReviewSchema = z.object({
  action: z.enum(["verify", "reject", "dispute", "outdated"]),
  note: z.string().trim().max(500).optional(),
  // Verifying requires the reviewer to attest which source they opened.
  checkedSourceUrl: z.string().url().startsWith("https://").max(500).optional(),
  checkedSection: z.string().trim().max(200).optional(),
});

export async function reviewClaim(id: string, reviewer: string, input: z.infer<typeof claimReviewSchema>) {
  const claim = await db.knowledgeClaim.findUnique({ where: { id } });
  if (!claim) throw notFound("Claim not found");
  if (input.action === "verify") {
    if (!input.checkedSourceUrl || !input.checkedSection) throw badRequest("To verify, record the source you opened and the section that supports the claim");
    const refs = parseJson(claim.sourceRefs, z.array(z.record(z.string(), z.unknown())), []);
    refs.push({ url: input.checkedSourceUrl, title: "Checked by reviewer", publisher: "", section: input.checkedSection, accessed: true });
    return db.knowledgeClaim.update({ where: { id }, data: { status: "verified", evidence: "admin_checked", sourceRefs: JSON.stringify(refs), reviewedAt: new Date(), reviewedBy: reviewer, note: input.note ?? claim.note } });
  }
  const status = input.action === "reject" ? "rejected" : input.action === "dispute" ? "disputed" : "outdated";
  return db.knowledgeClaim.update({ where: { id }, data: { status, reviewedAt: new Date(), reviewedBy: reviewer, note: input.note ?? claim.note } });
}

export async function listClaims(filters: { sportSlug?: string; status?: string; limit?: number } = {}) {
  const sport = filters.sportSlug ? await db.sport.findUnique({ where: { slug: filters.sportSlug }, select: { id: true } }) : null;
  const rows = await db.knowledgeClaim.findMany({
    where: { ...(sport ? { sportId: sport.id } : {}), ...(filters.status ? { status: filters.status } : {}) },
    include: { sport: { select: { slug: true, name: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: Math.min(filters.limit ?? 100, 500),
  });
  return rows.map((c) => ({ ...c, sourceRefs: parseJson(c.sourceRefs, z.array(z.record(z.string(), z.unknown())), []) }));
}

// ── Coverage dashboard ─────────────────────────────────────────────────
export async function coverage() {
  const [sports, claimGroups, taskGroups, sources] = await Promise.all([
    db.sport.findMany({
      where: { contentStatus: "published" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        availability: true,
        reviewedAt: true,
        profile: true,
        lessons: { select: { level: true, contentStatus: true } },
        drills: { select: { level: true, contentStatus: true } },
        rulesets: { select: { name: true, verification: true, reviewedAt: true, reviewFlag: true, sources: true } },
      },
    }),
    db.knowledgeClaim.groupBy({ by: ["sportId", "status", "evidence"], _count: true }),
    db.researchTask.groupBy({ by: ["sportId", "status", "kind"], _count: true, where: { NOT: { topic: { startsWith: "research-run:" } } } }),
    db.contentSource.findMany({ select: { slug: true, accessedAt: true, checkStatus: true } }),
  ]);
  const opened = new Set(sources.filter((s) => s.accessedAt).map((s) => s.slug));
  const lastRuns = await db.researchTask.findMany({ where: { topic: { startsWith: "research-run:" } }, select: { sportId: true, lastRunAt: true, status: true } });
  return sports.map((s) => {
    const cl = claimGroups.filter((g) => g.sportId === s.id);
    const tk = taskGroups.filter((g) => g.sportId === s.id);
    const count = (list: { _count: number }[]) => list.reduce((n, g) => n + g._count, 0);
    const profile = parseJson(s.profile, z.record(z.string(), z.unknown()), {});
    const ruleSources = [...new Set(s.rulesets.flatMap((r) => parseJson(r.sources, z.array(z.string()), [])))];
    const pub = <T extends { contentStatus: string }>(l: T[]) => l.filter((x) => x.contentStatus === "published");
    const levels = new Set(pub(s.lessons).map((l) => l.level));
    const missing: string[] = [];
    if (s.availability !== "external") {
      if (!pub(s.lessons).length) missing.push("Lessons");
      else if (!levels.has("advanced")) missing.push("Advanced lessons");
      if (!pub(s.drills).length) missing.push("Drills");
      if (!s.rulesets.length) missing.push("Rules summary");
      if (!profile.techniqueAreas) missing.push("Technique breakdown");
      if (!profile.tactics) missing.push("Tactics");
      if (!profile.injuryPrevention) missing.push("Injury prevention");
    }
    const run = lastRuns.filter((r) => r.sportId === s.id).sort((a, b) => (b.lastRunAt?.getTime() ?? 0) - (a.lastRunAt?.getTime() ?? 0))[0];
    return {
      slug: s.slug,
      name: s.name,
      availability: s.availability,
      lessons: pub(s.lessons).length,
      drills: pub(s.drills).length,
      rulesets: s.rulesets.length,
      rulesetsVerified: s.rulesets.filter((r) => r.verification === "summary").length,
      outdatedRules: s.rulesets.filter((r) => r.reviewFlag).map((r) => ({ name: r.name, flag: r.reviewFlag })),
      sourcesCited: ruleSources.length,
      sourcesOpened: ruleSources.filter((x) => opened.has(x)).length,
      claimsVerified: count(cl.filter((g) => g.status === "verified")),
      claimsAwaiting: count(cl.filter((g) => g.status === "unverified" || g.status === "disputed")),
      claimsSourceOpened: count(cl.filter((g) => g.evidence !== "snippet")),
      tasksOpen: count(tk.filter((g) => !["done", "dismissed"].includes(g.status))),
      safetyReviews: count(tk.filter((g) => g.kind === "review_suggestion" && g.status === "needs_review")),
      gaps: count(tk.filter((g) => g.kind === "knowledge_gap" && g.status !== "done")),
      missing,
      lastReview: s.reviewedAt,
      lastResearch: run ? { at: run.lastRunAt, status: run.status } : null,
    };
  });
}

// ── Knowledge retrieval (keyword search; no embedding provider configured) ──
const STOP = new Set("the a an and or of to in on for with is are be how what when why do does i my me you your can should at as it this that from by about which".split(" "));
const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""));

export interface KnowledgeHit {
  kind: "lesson" | "drill" | "rule" | "claim";
  sport: { slug: string; name: string };
  title: string;
  text: string;
  href: string;
  score: number;
  verification: string;
  sources: { title: string; url?: string | null; section?: string }[];
}

/**
 * Retrieves the most relevant *published or verified* knowledge for a question.
 * Keyword scoring over titles (weighted) and bodies; returns at most `limit` hits.
 */
export async function searchKnowledge(query: string, opts: { sportSlug?: string; limit?: number } = {}): Promise<KnowledgeHit[]> {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const sportWhere = opts.sportSlug ? { slug: opts.sportSlug } : {};
  const [lessons, drills, rulesets, claims, sources] = await Promise.all([
    db.lesson.findMany({ where: { contentStatus: "published", sport: { contentStatus: "published", ...sportWhere } }, include: { sport: { select: { slug: true, name: true } } } }),
    db.drill.findMany({ where: { contentStatus: "published", sport: { contentStatus: "published", ...sportWhere } }, include: { sport: { select: { slug: true, name: true } } } }),
    db.ruleset.findMany({ where: { contentStatus: "published", sport: { contentStatus: "published", ...sportWhere } }, include: { sport: { select: { slug: true, name: true } } } }),
    db.knowledgeClaim.findMany({ where: { status: "verified", ...(opts.sportSlug ? { sport: sportWhere } : {}) }, include: { sport: { select: { slug: true, name: true } } } }),
    db.contentSource.findMany(),
  ]);
  // A hit must share enough of the question's key terms; one common word ("grip") is not relevance.
  const needed = Math.min(q.length, Math.max(2, Math.ceil(q.length * 0.5)));
  const score = (title: string, body: string) => {
    const t = new Set(tokens(title));
    const b = new Set(tokens(body));
    let s = 0;
    let matched = 0;
    for (const w of q) {
      if (t.has(w) || b.has(w)) matched++;
      s += (t.has(w) ? 3 : 0) + (b.has(w) ? 1 : 0);
    }
    return matched >= needed ? s / Math.sqrt(q.length) : 0;
  };
  const src = (slugs: string[]) => slugs.map((sl) => sources.find((x) => x.slug === sl)).filter(Boolean).map((x) => ({ title: x!.title, url: x!.url }));
  const hits: KnowledgeHit[] = [];
  for (const l of lessons) {
    const c = parseJson(l.content, lessonContentSchema, { objectives: [], keyPoints: [] });
    const body = [l.summary, ...c.keyPoints, ...(c.steps ?? []), ...(c.mistakes ?? []), ...(c.safety ?? [])].join(" ");
    hits.push({ kind: "lesson", sport: l.sport, title: l.title, text: [l.summary, ...c.keyPoints.slice(0, 4)].join(" "), href: `/sports/${l.sport.slug}/lessons/${l.slug}`, score: score(l.title, body), verification: "editorial", sources: src(parseJson(l.sources, z.array(z.string()), [])) });
  }
  for (const d of drills) {
    hits.push({ kind: "drill", sport: d.sport, title: d.title, text: d.purpose, href: `/sports/${d.sport.slug}?tab=drills#${d.slug}`, score: score(d.title, `${d.purpose} ${d.content}`), verification: "editorial", sources: [] });
  }
  for (const r of rulesets) {
    for (const p of parseJson(r.points, z.array(rulePointSchema), [])) {
      hits.push({ kind: "rule", sport: r.sport, title: `${r.name}: ${p.topic}`, text: p.text, href: `/sports/${r.sport.slug}?tab=rules`, score: score(`${p.topic} rule`, p.text), verification: r.reviewFlag ? `${r.verification} (flagged: possibly outdated)` : r.verification, sources: src(parseJson(r.sources, z.array(z.string()), [])) });
    }
  }
  for (const c of claims) {
    const refs = parseJson(c.sourceRefs, z.array(z.object({ title: z.string().optional(), url: z.string().nullable().optional(), section: z.string().optional() }).passthrough()), []);
    hits.push({ kind: "claim", sport: c.sport ?? { slug: "", name: "General" }, title: c.topic, text: c.statement, href: c.sport ? `/sports/${c.sport.slug}` : "/sports", score: score(c.topic, c.statement) * 1.2, verification: "verified", sources: refs.map((r) => ({ title: r.title ?? "Source", url: r.url, section: r.section })) });
  }
  return hits
    .filter((h) => h.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 6);
}

/** Records a question the knowledge base couldn't answer, so it gets researched (deduplicated). */
export async function recordKnowledgeGap(sportSlug: string | null, question: string) {
  const sport = sportSlug ? await db.sport.findUnique({ where: { slug: sportSlug }, select: { id: true } }) : null;
  const topic = `Question: ${question.trim().replace(/\s+/g, " ").slice(0, 140)}`;
  const existing = await db.researchTask.findFirst({ where: { sportId: sport?.id ?? null, kind: "knowledge_gap", topic } });
  if (existing) return existing;
  try {
    return await db.researchTask.create({ data: { sportId: sport?.id ?? null, kind: "knowledge_gap", topic, status: "queued", priority: 2, detail: "Asked by a user; no published or verified knowledge matched." } });
  } catch (e) {
    log.warn("gap_record_failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// ── AI web research (optional; requires ANTHROPIC_API_KEY) ─────────────
const aiClaimsSchema = z.object({
  claims: z
    .array(
      z.object({
        topic: z.string().max(120),
        category: z.enum(["technique", "tactics", "training", "safety", "science", "history", "rules", "equipment"]),
        level: z.enum(["beginner", "intermediate", "advanced", "all"]),
        statement: z.string().max(600),
        sourceUrl: z.string().max(500),
        section: z.string().max(200),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(12),
  unanswered: z.array(z.string().max(300)).max(5),
});

const RESEARCH_SYSTEM = `You research sports knowledge for a coaching app. Use web search, then open (web fetch) the most authoritative sources: official federation rulebooks first, then national federations, peer-reviewed reviews, sports-science institutions and qualified coaching education.
Write concise research notes in your own words (never copy paragraphs). For every fact give the exact URL you opened and the section/rule number. Say clearly when sources disagree, when rules differ between federations or levels, and when you could not confirm something. Never invent rule numbers, dates, statistics or URLs.`;

/**
 * Runs one research task with web search/fetch, then extracts claims. Claims are kept only when
 * their URL was actually returned by the tools; they're saved as unverified for human review.
 */
export async function runAiResearch(taskId: string) {
  const { aiConfigured } = await import("../server/env");
  const { webResearch, structured, AiUnavailableError } = await import("../ai/provider");
  const task = await db.researchTask.findUnique({ where: { id: taskId }, include: { sport: { select: { id: true, slug: true, name: true } } } });
  if (!task) throw notFound("Task not found");
  if (!aiConfigured()) {
    await db.researchTask.update({ where: { id: taskId }, data: { status: "blocked", detail: "AI web research needs ANTHROPIC_API_KEY on the server." } });
    return { ok: false, reason: "not_configured" as const };
  }
  await db.researchTask.update({ where: { id: taskId }, data: { status: "in_progress", lastRunAt: new Date() } });
  const subject = task.sport ? `${task.sport.name}: ${task.topic}` : task.topic;
  try {
    const notes = await webResearch({ system: RESEARCH_SYSTEM, prompt: `Research topic — ${subject}\n${task.detail ?? ""}\nFocus on details a superficial search would miss (technique cues, error corrections, rule differences, safety limits, evidence quality).` });
    const seen = new Set([...notes.searched.keys(), ...notes.fetched]);
    const out = await structured({
      system: "Extract verifiable claims from research notes. Use only URLs that appear in the notes. Do not add facts that aren't in the notes.",
      messages: [{ role: "user", content: `Notes:\n${notes.text}\n\nURLs available:\n${[...seen].join("\n")}` }],
      schema: aiClaimsSchema,
      maxTokens: 8000,
      effort: "low",
    });
    let kept = 0;
    let dropped = 0;
    for (const c of out.claims) {
      if (!seen.has(c.sourceUrl) || !c.sourceUrl.startsWith("https://")) {
        dropped++; // citation not backed by a real tool result
        continue;
      }
      const opened = notes.fetched.has(c.sourceUrl);
      await db.knowledgeClaim.create({
        data: {
          sportId: task.sport?.id ?? null,
          topic: c.topic,
          category: c.category,
          level: c.level,
          statement: c.statement,
          sourceRefs: JSON.stringify([{ url: c.sourceUrl, title: notes.searched.get(c.sourceUrl) ?? c.sourceUrl, section: c.section, accessed: opened }]),
          confidence: opened ? c.confidence : "low",
          status: "unverified",
          evidence: opened ? "source_opened" : "snippet",
          origin: "ai_web_research",
        },
      });
      kept++;
    }
    await db.researchTask.update({
      where: { id: taskId },
      data: { status: "needs_review", result: JSON.stringify({ kept, dropped, unanswered: out.unanswered, opened: [...notes.fetched] }) },
    });
    return { ok: true, kept, dropped };
  } catch (e) {
    const reason = e instanceof AiUnavailableError ? e.message : "Research failed";
    await db.researchTask.update({ where: { id: taskId }, data: { status: "blocked", detail: reason } });
    return { ok: false, reason: "error" as const };
  }
}

// ── Source change monitoring ───────────────────────────────────────────
const UA = "APEXFIT-SourceMonitor/1.0 (+contact: site admin)";

/** Minimal robots.txt check for the "*" and our user-agent groups. */
export function robotsAllows(robots: string, path: string) {
  let applies = false;
  const rules: { allow: boolean; prefix: string }[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...rest] = line.split(":");
    const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k)) applies = v === "*" || /apexfit/i.test(v);
    else if (applies && /^disallow$/i.test(k) && v) rules.push({ allow: false, prefix: v });
    else if (applies && /^allow$/i.test(k) && v) rules.push({ allow: true, prefix: v });
  }
  const match = rules.filter((r) => path.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? match.allow : true;
}

/**
 * Checks each registered source URL (respecting robots.txt, one request per source, politely spaced).
 * A changed page creates a review task and flags rulesets that cite it. Nothing is auto-published.
 */
export async function checkSources(opts: { fetchImpl?: typeof fetch; delayMs?: number; limit?: number } = {}) {
  const f = opts.fetchImpl ?? fetch;
  const list = await db.contentSource.findMany({ where: { url: { not: null } }, orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } }, take: opts.limit ?? 50 });
  const summary = { checked: 0, changed: 0, blocked: 0, errors: 0 };
  for (const s of list) {
    const url = new URL(s.url!);
    let status = "ok";
    let hash: string | null = s.contentHash;
    try {
      const robots = await f(`${url.origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) })
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "");
      if (!robotsAllows(robots, url.pathname)) status = "robots_disallowed";
      else {
        const res = await f(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) status = res.status === 403 ? "blocked" : "error";
        else {
          const body = (await res.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>|\s+/g, " ");
          hash = createHash("sha256").update(body).digest("hex");
          if (s.contentHash && s.contentHash !== hash) status = "changed";
        }
      }
    } catch {
      status = "blocked";
    }
    summary.checked++;
    if (status === "changed") {
      summary.changed++;
      const sports = await db.ruleset.findMany({ where: { sources: { contains: `"${s.slug}"` } }, select: { id: true, sportId: true } });
      for (const r of sports) {
        await db.ruleset.update({ where: { id: r.id }, data: { reviewFlag: `The cited source "${s.title}" changed on ${new Date().toISOString().slice(0, 10)}. Re-check this summary.`, flaggedAt: new Date() } });
        await db.researchTask.create({ data: { sportId: r.sportId, kind: "source_change", topic: `Source changed: ${s.title}`.slice(0, 160), status: "needs_review", priority: 1, detail: s.url } });
      }
    }
    if (status === "blocked" || status === "robots_disallowed") summary.blocked++;
    if (status === "error") summary.errors++;
    await db.contentSource.update({ where: { id: s.id }, data: { lastCheckedAt: new Date(), checkStatus: status, contentHash: hash } });
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
  }
  return summary;
}
