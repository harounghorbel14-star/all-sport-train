import type { DrillSeed, LessonSeed, MetricSeed, RulesetSeed, SourceSeed, SportProfile, SportSeed } from "./types";

/**
 * Learning content added to a catalog sport (lessons, drills, rules overview,
 * extra metrics and profile sections). Applying it upgrades the sport to a
 * full learning system. Content is editorial; rules overviews are "general"
 * (not verified against the current rulebook) unless a reviewer upgrades them.
 */
export interface SportEnrichment {
  slug: string;
  profile: SportProfile;
  metrics?: MetricSeed[];
  lessons: LessonSeed[];
  drills: DrillSeed[];
  rulesets: RulesetSeed[];
}

export interface EnrichmentGroup {
  sources: SourceSeed[];
  sports: SportEnrichment[];
}

export function applyEnrichments(catalog: SportSeed[], groups: EnrichmentGroup[]): SportSeed[] {
  const bySlug = new Map(groups.flatMap((g) => g.sports).map((e) => [e.slug, e]));
  return catalog.map((s) => {
    const e = bySlug.get(s.slug);
    if (!e) return s;
    return {
      ...s,
      availability: "full",
      profile: { ...(s.profile ?? {}), ...e.profile },
      metrics: [...(s.metrics ?? []), ...(e.metrics ?? [])],
      lessons: e.lessons,
      drills: e.drills,
      rulesets: e.rulesets,
    };
  });
}
