import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { invalidateSportsCache } from "@/lib/services/sports";
import { todayKey } from "@/lib/domain/dates";
import { drawQuestions, grade } from "@/lib/domain/quiz";
import { LESSON_QUIZZES, quizContentSchema } from "@/lib/content/sports";
import { ATTEMPTS_PER_DAY } from "@/lib/services/quizzes";
import { call, newUser, passQuiz } from "./helpers";
import * as quiz from "@/app/api/sports/[slug]/lessons/[lesson]/quiz/route";
import * as attempt from "@/app/api/quiz-attempts/[id]/route";
import * as lesson from "@/app/api/sports/[slug]/lessons/[lesson]/route";
import * as sport from "@/app/api/sports/[slug]/route";
import * as metrics from "@/app/api/sports/[slug]/metrics/route";

beforeAll(async () => {
  await seed(db);
  invalidateSportsCache();
});

const sample = quizContentSchema.parse({
  passPercent: 75,
  questions: [
    { id: "q1", type: "single", prompt: "One?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a"], explanation: "A." },
    { id: "q2", type: "multiple", prompt: "Two?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }], correct: ["a", "c"], explanation: "A and C." },
    { id: "q3", type: "single", prompt: "Three?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["b"], explanation: "B." },
    { id: "q4", type: "single", prompt: "Four?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["b"], explanation: "B." },
  ],
});

const path = (cookie: string, s: string, l: string) => ({ cookie, params: { slug: s, lesson: l } });
const correctAnswers = async (s: string, l: string, questions: { id: string }[]) => {
  const row = await db.lessonQuiz.findFirstOrThrow({ where: { lesson: { slug: l, sport: { slug: s } } } });
  const c = JSON.parse(row.content) as { questions: { id: string; correct: string[]; options: { id: string }[] }[] };
  return {
    right: Object.fromEntries(questions.map((q) => [q.id, c.questions.find((x) => x.id === q.id)!.correct])),
    wrong: Object.fromEntries(questions.map((q) => { const d = c.questions.find((x) => x.id === q.id)!; return [q.id, [d.options.find((o) => !d.correct.includes(o.id))!.id]]; })),
  };
};

describe("quiz engine (pure)", () => {
  it("grades exact answers only — no partial credit, unanswered is wrong", () => {
    const shown = drawQuestions(sample, () => 0.3);
    const r = grade(sample, shown, { q1: ["a"], q2: ["a"], q3: ["b"] });
    expect(r.correct).toBe(2);
    expect(r.passed).toBe(false);
    expect(r.review.find((q) => q.id === "q2")!.isCorrect).toBe(false);
    expect(grade(sample, shown, { q1: ["a"], q2: ["c", "a"], q3: ["b"], q4: ["b"] }).passed).toBe(true);
    expect(grade(sample, shown, { q1: ["a", "b"], q2: ["a", "c"], q3: ["b"], q4: ["b"] }).correct).toBe(3); // extra choice on a single question is wrong
  });

  it("draws a random subset with shuffled options when perAttempt is set", () => {
    const shown = drawQuestions({ ...sample, perAttempt: 2 });
    expect(shown).toHaveLength(2);
    for (const s of shown) expect([...s.options].sort()).toEqual(sample.questions.find((q) => q.id === s.id)!.options.map((o) => o.id).sort());
  });

  it("rejects malformed quiz content", () => {
    const bad = (q: object) => quizContentSchema.safeParse({ questions: [q, q, q].map((x, i) => ({ ...x, id: `q${i}` })) }).success;
    expect(bad({ type: "single", prompt: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a", "b"], explanation: "x" })).toBe(false);
    expect(bad({ type: "single", prompt: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["z"], explanation: "x" })).toBe(false);
    expect(bad({ type: "multiple", prompt: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a", "b"], explanation: "x" })).toBe(false);
    expect(Object.values(LESSON_QUIZZES).every((q) => quizContentSchema.safeParse(q).success)).toBe(true);
  });
});

describe("quiz API", () => {
  it("never sends answers to the client, and resumes the same attempt", async () => {
    const { cookie } = await newUser();
    const info = await call(quiz.GET, path(cookie, "boxing", "stance-guard"));
    expect(info.status).toBe(200);
    expect(info.json.quiz.passed).toBe(false);
    const a = await call(quiz.POST, path(cookie, "boxing", "stance-guard"));
    const text = JSON.stringify(a.json);
    expect(text).not.toMatch(/"correct"|"explanation"/);
    const again = await call(quiz.POST, path(cookie, "boxing", "stance-guard"));
    expect(again.json.attemptId).toBe(a.json.attemptId);
    expect(again.json.questions.map((q: { id: string }) => q.id)).toEqual(a.json.questions.map((q: { id: string }) => q.id));
    // Concurrent starts still leave one open attempt.
    const { cookie: c2, userId: u2 } = await newUser();
    await Promise.all([1, 2, 3, 4].map(() => call(quiz.POST, path(c2, "boxing", "stance-guard"))));
    expect(await db.quizAttempt.count({ where: { userId: u2, status: "open" } })).toBe(1);
  });

  it("a failed attempt shows what was wrong and why, and completes nothing", async () => {
    const { cookie, userId } = await newUser();
    await call(lesson.POST, { ...path(cookie, "boxing", "stance-guard"), body: { status: "completed" } });
    const a = await call(quiz.POST, path(cookie, "boxing", "stance-guard"));
    const { wrong } = await correctAnswers("boxing", "stance-guard", a.json.questions);
    const r = await call(attempt.POST, { cookie, params: { id: a.json.attemptId }, body: { answers: wrong } });
    expect(r.json.passed).toBe(false);
    expect(r.json.correct).toBe(0);
    for (const q of r.json.review) {
      expect(q.isCorrect).toBe(false);
      expect(q.correctIds.length).toBeGreaterThan(0);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
    const states = (await call(sport.GET, { cookie, params: { slug: "boxing" } })).json.user.lessonStates;
    expect(states["stance-guard"].state).toBe("awaiting_assessment");
    expect(await db.xpEvent.count({ where: { userId } })).toBe(0);
    expect((await call(attempt.GET, { cookie, params: { id: a.json.attemptId } })).json.correct).toBe(0);
  });

  it("passing completes the lesson (labelled as a passed check) and XP is awarded once, however often it's submitted", async () => {
    const { cookie, userId } = await newUser();
    const a = await call(quiz.POST, path(cookie, "boxing", "stance-guard"));
    const { right } = await correctAnswers("boxing", "stance-guard", a.json.questions);
    const both = await Promise.all([1, 2, 3].map(() => call(attempt.POST, { cookie, params: { id: a.json.attemptId }, body: { answers: right } })));
    expect(both.every((r) => r.status === 200 && r.json.passed)).toBe(true);
    expect(both.filter((r) => r.json.fresh)).toHaveLength(1);
    const states = (await call(sport.GET, { cookie, params: { slug: "boxing" } })).json.user.lessonStates;
    expect(states["stance-guard"]).toEqual({ state: "completed", evidence: "quiz_passed" });
    // Passing again later earns nothing more.
    await passQuiz(cookie, "boxing", "stance-guard");
    expect(await db.xpEvent.count({ where: { userId, source: "quiz" } })).toBe(1);
    expect(await db.xpEvent.count({ where: { userId, source: "lesson" } })).toBe(1);
    expect((await call(quiz.GET, path(cookie, "boxing", "stance-guard"))).json.quiz.history).toHaveLength(2);
  });

  it("a lesson with a progress test needs both: the check and a qualifying result", async () => {
    const { cookie } = await newUser();
    expect((await passQuiz(cookie, "running", "run-walk-start")).json.lesson).toBe("awaiting_assessment");
    await call(metrics.POST, { cookie, params: { slug: "running" }, body: { metricKey: "longest_run", value: 1.5, dateKey: todayKey("UTC") } });
    const states = (await call(sport.GET, { cookie, params: { slug: "running" } })).json.user.lessonStates;
    expect(states["run-walk-start"]).toEqual({ state: "completed", evidence: "assessed" });
  });

  it("checks that build on another lesson wait for it, and say which", async () => {
    const { cookie } = await newUser();
    const r = await call(quiz.POST, path(cookie, "boxing", "footwork"));
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.json)).toMatch(/Stance & guard/);
    await passQuiz(cookie, "boxing", "stance-guard");
    expect((await call(quiz.POST, path(cookie, "boxing", "footwork"))).status).toBe(200);
  });

  it(`limits submissions to ${ATTEMPTS_PER_DAY} a day per check`, async () => {
    const { cookie } = await newUser();
    for (let i = 0; i < ATTEMPTS_PER_DAY; i++) {
      const a = await call(quiz.POST, path(cookie, "tennis", "grips-ready"));
      expect(a.status).toBe(200);
      await call(attempt.POST, { cookie, params: { id: a.json.attemptId }, body: { answers: {} } });
    }
    expect((await call(quiz.POST, path(cookie, "tennis", "grips-ready"))).status).toBe(409);
    expect((await call(quiz.GET, path(cookie, "tennis", "grips-ready"))).json.quiz.remainingToday).toBe(0);
  });

  it("rejects answers for other questions and never lets another user see or submit an attempt", async () => {
    const a = await newUser();
    const b = await newUser();
    await passQuiz(a.cookie, "tennis", "grips-ready"); // the forehand check builds on it
    const s = await call(quiz.POST, path(a.cookie, "tennis", "forehand"));
    expect(s.status).toBe(200);
    expect((await call(attempt.POST, { cookie: a.cookie, params: { id: s.json.attemptId }, body: { answers: { "not-a-question": ["a"] } } })).status).toBe(400);
    expect((await call(attempt.POST, { cookie: b.cookie, params: { id: s.json.attemptId }, body: { answers: {} } })).status).toBe(404);
    expect((await call(attempt.GET, { cookie: b.cookie, params: { id: s.json.attemptId } })).status).toBe(404);
    expect((await call(quiz.GET, path(a.cookie, "tennis", "no-such-lesson"))).status).toBe(404);
  });
});
