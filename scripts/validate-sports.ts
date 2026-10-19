/**
 * Validates extended sport content. Usage:
 *   npx tsx scripts/validate-sports.ts            # every enriched sport
 *   npx tsx scripts/validate-sports.ts combat     # one group file (src/lib/content/sports/extended/<group>.ts)
 * Exits non-zero with a list of problems.
 */
import { EXERCISE_BY_SLUG } from "../src/lib/content/exercises";
import { findPrerequisiteCycle } from "../src/lib/engine/prerequisites";
import { CATALOG } from "../src/lib/content/sports/catalog";
import { ENRICHMENT_GROUPS, GROUPS_BY_FILE } from "../src/lib/content/sports/extended";
import { SOURCES, SPORT_SEEDS, drillContentSchema, lessonContentSchema, levelRank, metricSeedSchema, rulePointSchema, sportProfileSchema } from "../src/lib/content/sports";

const group = process.argv[2];
if (group && !GROUPS_BY_FILE[group]) throw new Error(`Unknown group ${group}; use one of ${Object.keys(GROUPS_BY_FILE).join(", ")}`);
const groups = group ? [GROUPS_BY_FILE[group]] : ENRICHMENT_GROUPS;
const problems: string[] = [];
const err = (where: string, msg: string) => problems.push(`${where}: ${msg}`);
const sourceSlugs = new Set(SOURCES.map((s) => s.slug));
const allSlugs = SPORT_SEEDS.map((s) => s.slug);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Source registry checks
const seenSources = new Set<string>();
const newSources = new Set(groups.flatMap((g) => g.sources.map((x) => x.slug)));
for (const s of SOURCES) {
  if (seenSources.has(s.slug)) err(`source ${s.slug}`, "duplicate source slug");
  seenSources.add(s.slug);
  if (s.url) {
    if (!s.url.startsWith("https://")) err(`source ${s.slug}`, "url must be https");
    try {
      const u = new URL(s.url);
      if (newSources.has(s.slug) && u.pathname !== "/" && u.pathname !== "") err(`source ${s.slug}`, "only official homepage URLs (no deep links) — they can't be verified from here");
    } catch {
      err(`source ${s.slug}`, "invalid url");
    }
  }
}

let count = 0;
for (const g of groups) {
  for (const e of g.sports) {
    count++;
    const w = e.slug;
    const base = CATALOG.find((s) => s.slug === e.slug);
    if (!base) {
      err(w, "not a catalog sport slug");
      continue;
    }
    // Instructor-only sports may teach theory, land/dry drills and conditioning, but anything done in
    // the activity itself (on the water, wall, horse, apparatus…) must be marked as needing supervision.
    if (base.availability === "external") {
      const prof = e.profile ?? {};
      if (!prof.supervisionNote || prof.supervisionNote.length < 60) err(w, "instructor-only sport: profile.supervisionNote must explain that the activity is learned with certified instructors");
      if (!e.lessons.some((l) => l.requiresSupervision)) err(w, "instructor-only sport: in-activity lessons must set requiresSupervision");
      for (const d of e.drills) if (d.setting !== "solo" && !d.requiresSupervision) err(`${w}/drill ${d.slug}`, "instructor-only sport: partner/team drills must require supervision");
      for (const d of e.drills.filter((x) => x.setting === "solo" && !x.requiresSupervision))
        if (!/\b(dry|land|floor|ground|off-?(water|wall|bike|horse|snow|ice)|at home|mat|simulat|visuali|theory|knot|chalk|bench|mirror)/i.test(`${d.title} ${d.purpose} ${d.content.setup.join(" ")}`))
          err(`${w}/drill ${d.slug}`, "instructor-only sport: unsupervised solo drills must be land/dry/theory drills (say so in title, purpose or setup)");
    }
    if (groups.flatMap((x) => x.sports).filter((x) => x.slug === e.slug).length > 1) err(w, "enriched twice");
    const merged = SPORT_SEEDS.find((s) => s.slug === e.slug)!;
    const profile = sportProfileSchema.safeParse(merged.profile ?? {});
    if (!profile.success) err(w, `profile invalid: ${profile.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    const metrics = merged.metrics ?? [];
    const keys = metrics.map((m) => m.key);
    if (new Set(keys).size !== keys.length) err(w, `duplicate metric keys (catalog already has: ${(base.metrics ?? []).map((m) => m.key).join(", ")})`);
    for (const m of e.metrics ?? []) {
      const r = metricSeedSchema.safeParse(m);
      if (!r.success) err(`${w} metric ${m.key}`, r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      if (m.kind === "ratio" && !m.minAttempts) err(`${w} metric ${m.key}`, "ratio metrics need minAttempts");
      if ((m.kind === "number" || m.kind === "time") && (m.min == null || m.max == null)) err(`${w} metric ${m.key}`, "number/time metrics need min and max");
    }
    if (metrics.filter((m) => m.scope === "performance").length < 4) err(w, "needs at least 4 performance metrics");
    // Lessons
    const L = e.lessons;
    if (L.length < 6) err(w, `needs ≥6 lessons (has ${L.length})`);
    const lv = (l: string) => L.filter((x) => x.level === l).length;
    if (lv("beginner") < 2 || lv("intermediate") < 2 || lv("advanced") < 1) err(w, "lessons need ≥2 beginner, ≥2 intermediate, ≥1 advanced");
    const lessonSlugs = new Set(L.map((l) => l.slug));
    if (lessonSlugs.size !== L.length) err(w, "duplicate lesson slugs");
    const drillSlugs = new Set(e.drills.map((d) => d.slug));
    if (drillSlugs.size !== e.drills.length) err(w, "duplicate drill slugs");
    for (const l of L) {
      const lw = `${w}/lesson ${l.slug}`;
      if (!SLUG.test(l.slug)) err(lw, "slug must be kebab-case");
      const c = lessonContentSchema.safeParse(l.content);
      if (!c.success) err(lw, c.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      if ((l.content.keyPoints ?? []).length < 3) err(lw, "needs ≥3 key points");
      if (!(l.content.steps ?? []).length && !(l.content.mistakes ?? []).length) err(lw, "needs steps or mistakes");
      if (l.summary.length < 20) err(lw, "summary too short");
      for (const p of l.prerequisites ?? []) {
        if (!lessonSlugs.has(p)) err(lw, `unknown prerequisite ${p}`);
        else if (levelRank(L.find((x) => x.slug === p)!.level) > levelRank(l.level)) err(lw, `prerequisite ${p} is harder than the lesson`);
      }
      for (const d of l.drills ?? []) if (!drillSlugs.has(d)) err(lw, `unknown drill ${d}`);
      for (const s of l.sources ?? []) if (!sourceSlugs.has(s)) err(lw, `unknown source ${s}`);
      if (l.content.progressTest?.metricKey && !keys.includes(l.content.progressTest.metricKey)) err(lw, `unknown test metric ${l.content.progressTest.metricKey}`);
    }
    // Prerequisite cycles would make lessons unreachable.
    const cycle = findPrerequisiteCycle(L.map((l) => ({ slug: l.slug, prerequisites: l.prerequisites ?? [] })));
    if (cycle) err(w, `circular lesson prerequisites: ${cycle.join(" → ")}`);
    // Drills
    const D = e.drills;
    if (D.length < 10) err(w, `needs ≥10 drills (has ${D.length})`);
    const f = (x: string) => D.filter((d) => d.focus === x).length;
    if (f("warmup") < 1 || f("cooldown") < 1) err(w, "needs ≥1 warmup and ≥1 cooldown drill");
    if (f("technique") < 3) err(w, "needs ≥3 technique drills");
    if (D.filter((d) => d.setting === "solo" && d.focus !== "warmup" && d.focus !== "cooldown").length < 2) err(w, "needs ≥2 solo main drills so solo practices work");
    for (const d of D) {
      const dw = `${w}/drill ${d.slug}`;
      if (!SLUG.test(d.slug)) err(dw, "slug must be kebab-case");
      const c = drillContentSchema.safeParse(d.content);
      if (!c.success) err(dw, c.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      if (d.metricKey && !keys.includes(d.metricKey)) err(dw, `unknown metric ${d.metricKey}`);
      if ((d.contact === "controlled" || d.contact === "full") && !d.requiresSupervision) err(dw, "controlled/full contact requires supervision");
      if (base.category === "combat" && d.setting !== "solo" && !d.requiresSupervision) err(dw, "combat partner/team drills must require supervision");
      if (d.contact === "full") err(dw, "full-contact drills are not allowed in app content");
      if (d.setting === "team" && (d.minPlayers ?? 0) < 3) err(dw, "team drills need minPlayers ≥3");
      if (d.setting === "partner" && (d.minPlayers ?? 0) < 2) err(dw, "partner drills need minPlayers ≥2");
      if (d.durationMin < 3 || d.durationMin > 45) err(dw, "duration should be 3–45 min");
    }
    // Rules
    if (e.rulesets.length < 1) err(w, "needs ≥1 ruleset overview");
    for (const r of e.rulesets) {
      const rw = `${w}/ruleset ${r.slug}`;
      if (r.verification === "summary") err(rw, "verification must be 'general' or 'unverified' — nothing was checked against the current rulebook");
      if (r.points.length < 4) err(rw, "needs ≥4 points");
      for (const p of r.points) if (!rulePointSchema.safeParse(p).success) err(rw, `invalid point ${p.topic}`);
      if (!r.sources.length) err(rw, "needs ≥1 source");
      for (const s of r.sources) if (!sourceSlugs.has(s)) err(rw, `unknown source ${s}`);
      if (!/not (been )?(checked|verified)|check the (current|official)/i.test(r.editionNote)) err(rw, "editionNote must say it wasn't checked against the current rulebook");
    }
    // Profile
    const p = merged.profile ?? {};
    if ((p.milestones ?? []).length < 4) err(w, "needs ≥4 milestones");
    for (const m of p.milestones ?? []) if (m.metricKey && !keys.includes(m.metricKey)) err(w, `milestone metric ${m.metricKey} unknown`);
    if (!(p.safety ?? []).length) err(w, "needs safety notes");
    if (!(p.beginner ?? []).length) err(w, "needs beginner tips");
    if (!p.introduction) err(w, "needs introduction");
    if (!(p.techniqueAreas ?? []).length) err(w, "needs technique areas");
    if (!(p.weeklyStructure ?? []).length) err(w, "needs weeklyStructure");
    for (const ex of [...(p.conditioning?.exercises ?? []), ...(p.mobility?.exercises ?? [])]) if (!EXERCISE_BY_SLUG.has(ex)) err(w, `unknown exercise ${ex}`);
    if (!p.conditioning) err(w, "needs conditioning");
  }
}
if (!allSlugs.length) err("catalog", "empty");
if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) in ${count} sport(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ ${count} enriched sport(s) valid`);
