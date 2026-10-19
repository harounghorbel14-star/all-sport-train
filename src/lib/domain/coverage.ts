/**
 * Per-topic content coverage for one sport. Each topic is "present", "missing" or "n/a" (doesn't
 * apply to this kind of sport), so the admin report can show exactly which topics still need writing
 * — never a single score that hides gaps.
 */
export type TopicState = "present" | "missing" | "n/a";

export interface CoverageInput {
  availability: string; // full | basic | external
  categorySlug: string;
  profile: Record<string, unknown>;
  lessons: { level: string }[]; // published only
  drills: { level: string }[]; // published only
  rulesets: number;
}

type Rule = { key: string; label: string; applies: (s: CoverageInput) => boolean; present: (s: CoverageInput) => boolean };

const has = (k: string) => (s: CoverageInput) => {
  const v = s.profile[k];
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null && typeof v === "object";
};
const learning = (s: CoverageInput) => s.availability !== "external";
const instructorOnly = (s: CoverageInput) => s.availability === "external";
const lessonsAt = (level: string) => (s: CoverageInput) => s.lessons.some((l) => l.level === level);

export const COVERAGE_TOPICS: Rule[] = [
  { key: "introduction", label: "Introduction", applies: () => true, present: has("introduction") },
  { key: "equipment", label: "Equipment", applies: () => true, present: has("equipment") },
  { key: "safety", label: "Safety", applies: () => true, present: has("safety") },
  { key: "beginner", label: "Beginner guidance", applies: () => true, present: has("beginner") },
  { key: "supervision", label: "Supervision note", applies: instructorOnly, present: has("supervisionNote") },
  { key: "externalResources", label: "Where to find instruction", applies: instructorOnly, present: has("externalResources") },
  { key: "lessons.beginner", label: "Beginner lessons", applies: learning, present: lessonsAt("beginner") },
  { key: "lessons.intermediate", label: "Intermediate lessons", applies: learning, present: lessonsAt("intermediate") },
  { key: "lessons.advanced", label: "Advanced lessons", applies: learning, present: lessonsAt("advanced") },
  { key: "drills", label: "Drills", applies: learning, present: (s) => s.drills.length > 0 },
  { key: "rules", label: "Rules summary", applies: learning, present: (s) => s.rulesets > 0 },
  { key: "terminology", label: "Terminology", applies: learning, present: has("terminology") },
  { key: "technique", label: "Technique breakdown", applies: learning, present: has("techniqueAreas") },
  { key: "tactics", label: "Tactics", applies: learning, present: has("tactics") },
  { key: "positions", label: "Positions", applies: (s) => learning(s) && s.categorySlug === "team", present: has("positions") },
  { key: "conditioning", label: "Conditioning", applies: () => true, present: has("conditioning") },
  { key: "mobility", label: "Mobility", applies: learning, present: has("mobility") },
  { key: "injuryPrevention", label: "Injury prevention", applies: () => true, present: has("injuryPrevention") },
  { key: "recovery", label: "Recovery", applies: learning, present: has("recovery") },
  { key: "milestones", label: "Milestones", applies: learning, present: has("milestones") },
  { key: "weeklyStructure", label: "Weekly structure", applies: learning, present: has("weeklyStructure") },
  { key: "templates", label: "Session templates", applies: () => true, present: has("templates") },
];

export function topicCoverage(s: CoverageInput) {
  const topics = COVERAGE_TOPICS.map((t) => ({ key: t.key, label: t.label, state: (t.applies(s) ? (t.present(s) ? "present" : "missing") : "n/a") as TopicState }));
  const applicable = topics.filter((t) => t.state !== "n/a");
  return {
    topics,
    missing: topics.filter((t) => t.state === "missing").map((t) => t.label),
    covered: applicable.filter((t) => t.state === "present").length,
    applicable: applicable.length,
  };
}

/** How many sports miss each topic — tells writers which topic to work on next. */
export function topicGapSummary(rows: { topics: { key: string; label: string; state: TopicState }[] }[]) {
  return COVERAGE_TOPICS.map((t) => {
    const states = rows.map((r) => r.topics.find((x) => x.key === t.key)?.state);
    return { key: t.key, label: t.label, missing: states.filter((x) => x === "missing").length, applicable: states.filter((x) => x && x !== "n/a").length };
  }).filter((t) => t.applicable > 0);
}
