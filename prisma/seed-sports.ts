import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, SOURCES, SPORT_SEEDS, metricSeedSchema, sportProfileSchema, lessonContentSchema, drillContentSchema } from "../src/lib/content/sports";

/**
 * Seeds the sports knowledge base. Re-running is safe and additive, so existing
 * deployments receive new content:
 * - sports an admin has edited (isCustom) are never touched;
 * - other sports get updated catalog fields and any *missing* metrics, rules,
 *   lessons and drills (existing ones are kept as they are);
 * - SEED_OVERWRITE=1 re-applies everything from the seed files.
 * Nothing is marked as reviewed: review dates are set when an admin publishes.
 */
export async function seedSports(db: PrismaClient) {
  const overwrite = process.env.SEED_OVERWRITE === "1";
  for (const [i, c] of CATEGORIES.entries()) {
    await db.sportCategory.upsert({ where: { slug: c.slug }, create: { ...c, order: i }, update: overwrite ? { ...c, order: i } : {} });
  }
  for (const src of SOURCES) {
    await db.contentSource.upsert({ where: { slug: src.slug }, create: src, update: overwrite ? src : {} });
  }
  let created = 0;
  for (const s of SPORT_SEEDS) {
    const profile = sportProfileSchema.parse(s.profile ?? {});
    const base = {
      name: s.name,
      categorySlug: s.category,
      parentSlug: s.parent ?? null,
      summary: s.summary,
      aliases: JSON.stringify(s.aliases ?? []),
      availability: s.availability,
      metLight: s.met[0],
      metModerate: s.met[1],
      metVigorous: s.met[2],
      distanceUnit: s.distance ?? null,
      workoutBased: s.workoutBased ?? false,
      profile: JSON.stringify(profile),
    };
    const existing = await db.sport.findUnique({ where: { slug: s.slug } });
    if (existing?.isCustom && !overwrite) continue; // admin-edited: leave alone
    const sport = await db.sport.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...base }, update: base });
    created++;
    // Children: bulk-create what's missing; only overwrite existing rows when asked to.
    const [haveMetrics, haveRules, haveLessons, haveDrills] = await Promise.all([
      db.sportMetric.findMany({ where: { sportId: sport.id }, select: { key: true } }).then((r) => new Set(r.map((x) => x.key))),
      db.ruleset.findMany({ where: { sportId: sport.id }, select: { slug: true } }).then((r) => new Set(r.map((x) => x.slug))),
      db.lesson.findMany({ where: { sportId: sport.id }, select: { slug: true } }).then((r) => new Set(r.map((x) => x.slug))),
      db.drill.findMany({ where: { sportId: sport.id }, select: { slug: true } }).then((r) => new Set(r.map((x) => x.slug))),
    ]);
    const metrics = (s.metrics ?? []).map((m, order) => {
      const metric = metricSeedSchema.parse(m);
      return { key: metric.key, data: { label: metric.label, unit: metric.unit ?? null, kind: metric.kind, scope: metric.scope, direction: metric.direction, options: JSON.stringify(metric.options ?? []), min: metric.min ?? null, max: metric.max ?? null, minAttempts: metric.minAttempts ?? null, description: metric.description ?? null, measurement: metric.measurement ?? null, order } };
    });
    const rules = (s.rulesets ?? []).map((r) => ({ slug: r.slug, data: { name: r.name, governingBody: r.governingBody, scope: r.scope, editionNote: r.editionNote, points: JSON.stringify(r.points), verification: r.verification, sources: JSON.stringify(r.sources), reviewedAt: null } }));
    const lessons = (s.lessons ?? []).map((l, order) => ({ slug: l.slug, data: { title: l.title, level: l.level, order, summary: l.summary, content: JSON.stringify(lessonContentSchema.parse(l.content)), prerequisites: JSON.stringify(l.prerequisites ?? []), drillSlugs: JSON.stringify(l.drills ?? []), requiresSupervision: l.requiresSupervision ?? false, sources: JSON.stringify(l.sources ?? []) } }));
    const drills = (s.drills ?? []).map((d) => ({ slug: d.slug, data: { title: d.title, purpose: d.purpose, level: d.level, focus: d.focus, durationMin: d.durationMin, setting: d.setting, minPlayers: d.minPlayers ?? (d.setting === "solo" ? 1 : 2), equipment: JSON.stringify(d.equipment ?? []), contact: d.contact ?? "none", requiresSupervision: d.requiresSupervision ?? false, metricKey: d.metricKey ?? null, content: JSON.stringify(drillContentSchema.parse(d.content)) } }));
    const sportId = sport.id;
    await db.sportMetric.createMany({ data: metrics.filter((m) => !haveMetrics.has(m.key)).map((m) => ({ sportId, key: m.key, ...m.data })) });
    await db.ruleset.createMany({ data: rules.filter((r) => !haveRules.has(r.slug)).map((r) => ({ sportId, slug: r.slug, ...r.data })) });
    await db.lesson.createMany({ data: lessons.filter((l) => !haveLessons.has(l.slug)).map((l) => ({ sportId, slug: l.slug, ...l.data })) });
    await db.drill.createMany({ data: drills.filter((d) => !haveDrills.has(d.slug)).map((d) => ({ sportId, slug: d.slug, ...d.data })) });
    if (overwrite) {
      for (const m of metrics.filter((x) => haveMetrics.has(x.key))) await db.sportMetric.update({ where: { sportId_key: { sportId, key: m.key } }, data: m.data });
      for (const r of rules.filter((x) => haveRules.has(x.slug))) await db.ruleset.update({ where: { sportId_slug: { sportId, slug: r.slug } }, data: r.data });
      for (const l of lessons.filter((x) => haveLessons.has(x.slug))) await db.lesson.update({ where: { sportId_slug: { sportId, slug: l.slug } }, data: l.data });
      for (const d of drills.filter((x) => haveDrills.has(x.slug))) await db.drill.update({ where: { sportId_slug: { sportId, slug: d.slug } }, data: d.data });
    }
  }
  return { sports: SPORT_SEEDS.length, createdOrUpdated: created, sources: SOURCES.length };
}
