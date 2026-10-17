import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, SOURCES, SPORT_SEEDS, metricSeedSchema, sportProfileSchema, lessonContentSchema, drillContentSchema } from "../src/lib/content/sports";

/**
 * Seeds the sports knowledge base. Existing rows are left untouched (so admin
 * edits survive re-seeding) unless SEED_OVERWRITE=1 is set.
 */
export async function seedSports(db: PrismaClient) {
  const overwrite = process.env.SEED_OVERWRITE === "1";
  const now = new Date();
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
      reviewedAt: s.availability === "full" ? now : null,
    };
    const existing = await db.sport.findUnique({ where: { slug: s.slug } });
    if (existing && !overwrite) continue;
    const sport = await db.sport.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...base }, update: base });
    created++;
    for (const [order, m] of (s.metrics ?? []).entries()) {
      const metric = metricSeedSchema.parse(m);
      const data = { label: metric.label, unit: metric.unit ?? null, kind: metric.kind, scope: metric.scope, direction: metric.direction, options: JSON.stringify(metric.options ?? []), min: metric.min ?? null, max: metric.max ?? null, minAttempts: metric.minAttempts ?? null, description: metric.description ?? null, measurement: metric.measurement ?? null, order };
      await db.sportMetric.upsert({ where: { sportId_key: { sportId: sport.id, key: metric.key } }, create: { sportId: sport.id, key: metric.key, ...data }, update: data });
    }
    for (const r of s.rulesets ?? []) {
      const data = { name: r.name, governingBody: r.governingBody, scope: r.scope, editionNote: r.editionNote, points: JSON.stringify(r.points), verification: r.verification, sources: JSON.stringify(r.sources), reviewedAt: now };
      await db.ruleset.upsert({ where: { sportId_slug: { sportId: sport.id, slug: r.slug } }, create: { sportId: sport.id, slug: r.slug, ...data }, update: data });
    }
    for (const [order, l] of (s.lessons ?? []).entries()) {
      const data = { title: l.title, level: l.level, order, summary: l.summary, content: JSON.stringify(lessonContentSchema.parse(l.content)), prerequisites: JSON.stringify(l.prerequisites ?? []), drillSlugs: JSON.stringify(l.drills ?? []), requiresSupervision: l.requiresSupervision ?? false, sources: JSON.stringify(l.sources ?? []) };
      await db.lesson.upsert({ where: { sportId_slug: { sportId: sport.id, slug: l.slug } }, create: { sportId: sport.id, slug: l.slug, ...data }, update: data });
    }
    for (const d of s.drills ?? []) {
      const data = { title: d.title, purpose: d.purpose, level: d.level, focus: d.focus, durationMin: d.durationMin, setting: d.setting, minPlayers: d.minPlayers ?? (d.setting === "solo" ? 1 : 2), equipment: JSON.stringify(d.equipment ?? []), contact: d.contact ?? "none", requiresSupervision: d.requiresSupervision ?? false, metricKey: d.metricKey ?? null, content: JSON.stringify(drillContentSchema.parse(d.content)) };
      await db.drill.upsert({ where: { sportId_slug: { sportId: sport.id, slug: d.slug } }, create: { sportId: sport.id, slug: d.slug, ...data }, update: data });
    }
  }
  return { sports: SPORT_SEEDS.length, createdOrUpdated: created, sources: SOURCES.length };
}
