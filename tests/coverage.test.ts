import { describe, expect, it } from "vitest";
import { topicCoverage, topicGapSummary } from "@/lib/domain/coverage";
import { coverage } from "@/lib/services/research";

const base = { categorySlug: "individual", profile: {}, lessons: [], drills: [], rulesets: 0 };

describe("per-topic coverage", () => {
  it("reports each missing topic for a learning sport, and marks non-applicable topics", () => {
    const r = topicCoverage({ ...base, availability: "full", lessons: [{ level: "beginner" }], profile: { introduction: "x", safety: ["y"], tactics: [] } });
    const state = (k: string) => r.topics.find((t) => t.key === k)!.state;
    expect(state("introduction")).toBe("present");
    expect(state("lessons.beginner")).toBe("present");
    expect(state("lessons.advanced")).toBe("missing");
    expect(state("tactics")).toBe("missing"); // empty list is not coverage
    expect(state("positions")).toBe("n/a"); // individual sport
    expect(state("supervision")).toBe("n/a");
    expect(r.missing).toContain("Advanced lessons");
    expect(r.covered).toBe(3);
  });

  it("instructor-only activities need a supervision note and pointers, not lessons", () => {
    const r = topicCoverage({ ...base, availability: "external", profile: { supervisionNote: "Learn with a certified instructor." } });
    const state = (k: string) => r.topics.find((t) => t.key === k)!.state;
    expect(state("lessons.beginner")).toBe("n/a");
    expect(state("drills")).toBe("n/a");
    expect(state("supervision")).toBe("present");
    expect(state("externalResources")).toBe("missing");
  });

  it("team sports are checked for positions", () => {
    const r = topicCoverage({ ...base, availability: "full", categorySlug: "team" });
    expect(r.topics.find((t) => t.key === "positions")!.state).toBe("missing");
  });

  it("summarises gaps per topic over the seeded catalogue", async () => {
    const rows = await coverage();
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) expect(r.topicsCovered).toBeLessThanOrEqual(r.topicsApplicable);
    const football = rows.find((r) => r.slug === "football")!;
    expect(football.topics.find((t) => t.key === "positions")!.state).toBe("present");
    const gaps = topicGapSummary(rows);
    expect(gaps.every((g) => g.missing <= g.applicable)).toBe(true);
    expect(gaps.find((g) => g.key === "positions")!.applicable).toBeLessThan(rows.length);
  });
});
