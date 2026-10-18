import { describe, expect, it } from "vitest";
import { EXERCISE_BY_SLUG } from "@/lib/content/exercises";
import { CATEGORIES, PRIORITY_SPORTS, SOURCES, SPORT_SEEDS, levelRank } from "@/lib/content/sports";
import { drillExclusion, generatePractice, milestoneMet, nextLesson, personalBests, ratioValue, weeklyPlan, type EngineDrill } from "@/lib/engine/practice";

const sourceSlugs = new Set(SOURCES.map((s) => s.slug));
const categorySlugs = new Set<string>(CATEGORIES.map((c) => c.slug));

describe("sports catalog integrity", () => {
  it("has unique slugs, valid categories and parents", () => {
    const slugs = SPORT_SEEDS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of SPORT_SEEDS) {
      expect(categorySlugs.has(s.category), s.slug).toBe(true);
      if (s.parent) expect(slugs, `${s.slug} parent`).toContain(s.parent);
    }
  });

  it("covers every requested category with real entries", () => {
    for (const c of CATEGORIES) expect(SPORT_SEEDS.filter((s) => s.category === c.slug).length, c.slug).toBeGreaterThan(3);
    expect(SPORT_SEEDS.length).toBeGreaterThan(120);
  });

  it("only marks sports 'full' when they have a real learning system", () => {
    for (const s of SPORT_SEEDS.filter((x) => x.availability === "full")) {
      expect(s.lessons?.length ?? 0, s.slug).toBeGreaterThanOrEqual(6);
      expect(s.drills?.length ?? 0, s.slug).toBeGreaterThanOrEqual(10);
      expect(s.rulesets?.length ?? 0, s.slug).toBeGreaterThanOrEqual(1);
      expect((s.metrics ?? []).filter((m) => m.scope === "performance").length, s.slug).toBeGreaterThanOrEqual(4);
      expect(s.profile?.milestones?.length ?? 0, s.slug).toBeGreaterThanOrEqual(4);
      expect(s.profile?.safety?.length ?? 0, s.slug).toBeGreaterThan(0);
    }
    expect(PRIORITY_SPORTS.map((s) => s.slug).sort()).toEqual(["baseball", "basketball", "boxing", "calisthenics", "football", "running", "swimming", "tennis"]);
  });

  it("gives external sports an instruction note instead of lessons", () => {
    for (const s of SPORT_SEEDS.filter((x) => x.availability === "external")) {
      expect(s.lessons ?? [], s.slug).toHaveLength(0);
      expect(s.profile?.externalResources?.length ?? 0, s.slug).toBeGreaterThan(0);
    }
  });

  it("references only existing lessons, drills, metrics, sources and exercises", () => {
    for (const s of SPORT_SEEDS) {
      const lessons = new Set((s.lessons ?? []).map((l) => l.slug));
      const drills = new Set((s.drills ?? []).map((d) => d.slug));
      const metrics = new Set((s.metrics ?? []).map((m) => m.key));
      for (const l of s.lessons ?? []) {
        l.prerequisites?.forEach((p) => expect(lessons.has(p), `${s.slug}/${l.slug} prereq ${p}`).toBe(true));
        l.drills?.forEach((d) => expect(drills.has(d), `${s.slug}/${l.slug} drill ${d}`).toBe(true));
        l.sources?.forEach((x) => expect(sourceSlugs.has(x), x).toBe(true));
        if (l.content.progressTest?.metricKey) expect(metrics.has(l.content.progressTest.metricKey), `${s.slug}/${l.slug} test metric`).toBe(true);
        // Prerequisites must not be harder than the lesson itself
        l.prerequisites?.forEach((p) => {
          const pre = s.lessons!.find((x) => x.slug === p)!;
          expect(levelRank(pre.level), `${s.slug}/${l.slug}`).toBeLessThanOrEqual(levelRank(l.level));
        });
      }
      for (const d of s.drills ?? []) if (d.metricKey) expect(metrics.has(d.metricKey), `${s.slug}/${d.slug} metric`).toBe(true);
      for (const r of s.rulesets ?? []) {
        expect(r.sources.length, r.slug).toBeGreaterThan(0);
        r.sources.forEach((x) => expect(sourceSlugs.has(x), x).toBe(true));
      }
      for (const m of s.profile?.milestones ?? []) if (m.metricKey) expect(metrics.has(m.metricKey), `${s.slug} milestone ${m.metricKey}`).toBe(true);
      for (const ex of [...(s.profile?.conditioning?.exercises ?? []), ...(s.profile?.mobility?.exercises ?? [])]) expect(EXERCISE_BY_SLUG.has(ex), `${s.slug} exercise ${ex}`).toBe(true);
    }
  });

  it("never lets full-contact or sparring drills skip supervision", () => {
    for (const s of SPORT_SEEDS) for (const d of s.drills ?? []) if (d.contact === "controlled" || d.contact === "full") expect(d.requiresSupervision, `${s.slug}/${d.slug}`).toBe(true);
  });

  it("only uses https source URLs", () => {
    for (const s of SOURCES) if (s.url) expect(s.url.startsWith("https://"), s.slug).toBe(true);
  });
});

const boxing = PRIORITY_SPORTS.find((s) => s.slug === "boxing")!;
const football = PRIORITY_SPORTS.find((s) => s.slug === "football")!;
const toEngine = (sport: typeof boxing): EngineDrill[] =>
  (sport.drills ?? []).map((d) => ({ slug: d.slug, title: d.title, level: d.level, focus: d.focus, durationMin: d.durationMin, setting: d.setting, minPlayers: d.minPlayers ?? (d.setting === "solo" ? 1 : 2), contact: d.contact ?? "none", requiresSupervision: d.requiresSupervision ?? false, metricKey: d.metricKey ?? null, equipment: d.equipment ?? [] }));
const base = { sportName: "Boxing", conditioningExercises: ["burpee", "push-up", "side-plank"], level: "advanced" as const, minutes: 45, focus: "balanced" as const, setting: "partner" as const, players: 2, supervised: false, under18: false };

describe("practice builder", () => {
  it("never generates sparring, even for supervised advanced adults (full contact)", () => {
    const p = generatePractice({ ...base, drills: toEngine(boxing), supervised: true });
    const drills = new Map(toEngine(boxing).map((d) => [d.slug, d]));
    expect(p.blocks.every((b) => !b.drillSlug || drills.get(b.drillSlug)!.contact !== "full")).toBe(true);
  });

  it("excludes coach-only and contact drills without supervision", () => {
    const p = generatePractice({ ...base, drills: toEngine(boxing) });
    expect(p.blocks.map((b) => b.drillSlug)).not.toContain("partner-jab-parry");
    expect(p.blocks.map((b) => b.drillSlug)).not.toContain("technical-sparring");
    expect(p.excluded.find((e) => e.title.startsWith("Technical sparring"))?.reason).toMatch(/supervised|coach/i);
  });

  it("keeps under-18s away from partner contact and sparring even when supervised", () => {
    const drills = toEngine(boxing);
    const sparring = drills.find((d) => d.slug === "technical-sparring")!;
    expect(drillExclusion(sparring, { level: "advanced", setting: "partner", players: 2, supervised: true, under18: true })).toBeTruthy();
    const unsup = drills.find((d) => d.contact === "light")!;
    expect(drillExclusion(unsup, { level: "advanced", setting: "partner", players: 2, supervised: false, under18: true })).toBeTruthy();
  });

  it("respects level and setting", () => {
    const p = generatePractice({ ...base, sportName: "Football", drills: toEngine(football), level: "beginner", setting: "solo", players: 1 });
    const drills = new Map(toEngine(football).map((d) => [d.slug, d]));
    for (const b of p.blocks.filter((x) => x.drillSlug)) {
      const d = drills.get(b.drillSlug!)!;
      expect(d.setting).toBe("solo");
      expect(d.level).toBe("beginner");
    }
  });

  it("fits the requested time and includes warm-up and cooldown", () => {
    for (const minutes of [20, 45, 75]) {
      const p = generatePractice({ ...base, sportName: "Football", drills: toEngine(football), level: "intermediate", setting: "team", players: 10, minutes });
      expect(p.minutes).toBe(minutes);
      expect(p.blocks[0].focus).toBe("warmup");
      expect(p.blocks.at(-1)!.focus).toBe("cooldown");
    }
  });

  it("prefers drills from the next lesson", () => {
    const p = generatePractice({ ...base, sportName: "Football", drills: toEngine(football), level: "beginner", setting: "solo", players: 1, preferredDrills: ["cone-slalom"], focus: "technique" });
    expect(p.blocks.map((b) => b.drillSlug)).toContain("cone-slalom");
  });
});

describe("metrics, milestones, learning path", () => {
  const metrics = [
    { key: "ft", label: "FT", kind: "ratio", direction: "higher", minAttempts: 10, unit: null },
    { key: "t5k", label: "5k", kind: "time", direction: "lower", minAttempts: null, unit: "s" },
  ];
  it("computes personal bests respecting direction and minimum attempts", () => {
    const pbs = personalBests(metrics, [
      { metricKey: "ft", value: 100, attempts: 2, dateKey: "2026-10-01" }, // too few attempts
      { metricKey: "ft", value: 70, attempts: 10, dateKey: "2026-10-02" },
      { metricKey: "t5k", value: 1700, attempts: null, dateKey: "2026-10-01" },
      { metricKey: "t5k", value: 1650, attempts: null, dateKey: "2026-10-08" },
    ]);
    expect(pbs.ft?.value).toBe(70);
    expect(pbs.t5k?.value).toBe(1650);
  });
  it("calculates ratios and rejects invalid input", () => {
    expect(ratioValue(7, 10)).toBe(70);
    expect(() => ratioValue(11, 10)).toThrow();
  });
  it("checks milestones in the right direction", () => {
    expect(milestoneMet("lower", 1750, 1800)).toBe(true);
    expect(milestoneMet("higher", 15, 20)).toBe(false);
  });
  it("recommends the next unlocked lesson", () => {
    const lessons = [
      { slug: "a", level: "beginner", order: 0, prerequisites: [] },
      { slug: "b", level: "beginner", order: 1, prerequisites: ["a"] },
      { slug: "c", level: "advanced", order: 2, prerequisites: ["b"] },
    ];
    expect(nextLesson(lessons, new Set(), "beginner")?.slug).toBe("a");
    expect(nextLesson(lessons, new Set(["a"]), "beginner")?.slug).toBe("b");
    expect(nextLesson(lessons, new Set(["a", "b"]), "beginner")).toBeNull(); // advanced is two steps up
    expect(nextLesson(lessons, new Set(["a", "b"]), "intermediate")?.slug).toBe("c");
  });
  it("builds weekly plans on the user's training days", () => {
    const w = weeklyPlan(football.profile!.weeklyStructure as never, 3, [1, 3, 5]);
    expect(w.map((d) => d.weekday)).toEqual([1, 3, 5]);
    expect(w.map((d) => d.focus)).toEqual(["technique", "conditioning", "game"]);
  });
});

describe("coach intent & sport detection", () => {
  it("doesn't read 'create' as a meal request", async () => {
    const { detectIntent } = await import("@/lib/ai/intents");
    expect(detectIntent("Create my workout for today").intent).toBe("workout_today");
    expect(detectIntent("What should I eat after training?").intent).toBe("meal_suggestion");
  });

  it("classifies sport questions", async () => {
    const { detectSportIntent } = await import("@/lib/ai/sport-coach");
    expect(detectSportIntent("explain the offside rule").intent).toBe("rules");
    expect(detectSportIntent("build a 30 min practice").minutes).toBe(30);
    expect(detectSportIntent("is sparring safe for me?").intent).toBe("safety");
    expect(detectSportIntent("what positions are there").intent).toBe("positions");
  });
});

describe("every full sport", () => {
  it("builds a safe solo beginner practice", () => {
    for (const s of SPORT_SEEDS.filter((x) => x.availability === "full" && !x.workoutBased)) {
      const p = generatePractice({
        sportName: s.name,
        drills: (s.drills ?? []).map((d) => ({ slug: d.slug, title: d.title, level: d.level, focus: d.focus, durationMin: d.durationMin, setting: d.setting, minPlayers: d.minPlayers ?? 1, contact: d.contact ?? "none", requiresSupervision: d.requiresSupervision ?? false, metricKey: d.metricKey ?? null, equipment: d.equipment ?? [] })),
        conditioningExercises: s.profile?.conditioning?.exercises ?? [],
        level: "beginner",
        minutes: 45,
        focus: "balanced",
        setting: "solo",
        players: 1,
        supervised: false,
        under18: false,
      });
      const used = p.blocks.map((b) => (s.drills ?? []).find((d) => d.slug === b.drillSlug)).filter(Boolean);
      // Either a real session, or an explicit explanation of why drills are locked (e.g. water polo needs a lifeguarded, coached pool).
      if (p.blocks.length < 3) expect(p.notes.join(" "), s.slug).toMatch(/qualified coach/);
      expect(used.every((d) => (d!.contact ?? "none") === "none" && !d!.requiresSupervision && d!.setting === "solo"), s.slug).toBe(true);
      expect(p.minutes, s.slug).toBeLessThanOrEqual(50);
    }
  });
});
