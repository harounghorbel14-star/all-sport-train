import { BASEBALL } from "./baseball";
import { BASKETBALL } from "./basketball";
import { BOXING } from "./boxing";
import { CALISTHENICS } from "./calisthenics";
import { CATALOG } from "./catalog";
import { FOOTBALL } from "./football";
import { RUNNING } from "./running";
import { SWIMMING } from "./swimming";
import { TENNIS } from "./tennis";
import { applyEnrichments } from "./enrichment";
import { ENRICHMENT_GROUPS } from "./extended";
import { SOURCES as BASE_SOURCES } from "./sources";
import type { SportSeed } from "./types";

export * from "./types";

/** Source registry: core sources plus those cited by extended sport content. */
export const SOURCES = [...BASE_SOURCES, ...ENRICHMENT_GROUPS.flatMap((g) => g.sources)];

/** Sports with a complete learning system (lessons, drills, rules, metrics). */
export const PRIORITY_SPORTS: SportSeed[] = [CALISTHENICS, BOXING, FOOTBALL, BASKETBALL, BASEBALL, SWIMMING, RUNNING, TENNIS];

/** Seed data for the sports knowledge base. The database is the runtime source of truth. */
export const SPORT_SEEDS: SportSeed[] = [...PRIORITY_SPORTS, ...applyEnrichments(CATALOG, ENRICHMENT_GROUPS)];
