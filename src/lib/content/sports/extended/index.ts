import type { EnrichmentGroup } from "../enrichment";
import { COMBAT } from "./combat";
import { ENDURANCE } from "./endurance";
import { FITNESS } from "./fitness";
import { OUTDOOR } from "./outdoor";
import { RACKET_ADAPTIVE } from "./racket";
import { TEAM_A } from "./teamA";
import { TEAM_B } from "./teamB";
import { TRACK } from "./track";
import { ACRO } from "./acro";
import { AQUATIC } from "./aquatic";
import { BOARD } from "./board";
import { VERTICAL } from "./vertical";
import { THROWS } from "./throws";
import { BARBELL } from "./barbell";
import { CONDITIONING } from "./conditioning";

export const ENRICHMENT_GROUPS: EnrichmentGroup[] = [TRACK, ENDURANCE, COMBAT, TEAM_A, TEAM_B, RACKET_ADAPTIVE, OUTDOOR, FITNESS, ACRO, AQUATIC, BOARD, VERTICAL, THROWS, BARBELL, CONDITIONING];

/** Group file name → group, for the content validator. */
export const GROUPS_BY_FILE: Record<string, EnrichmentGroup> = { track: TRACK, endurance: ENDURANCE, combat: COMBAT, teamA: TEAM_A, teamB: TEAM_B, racket: RACKET_ADAPTIVE, outdoor: OUTDOOR, fitness: FITNESS, acro: ACRO, aquatic: AQUATIC, board: BOARD, vertical: VERTICAL, throws: THROWS, barbell: BARBELL, conditioning: CONDITIONING };
