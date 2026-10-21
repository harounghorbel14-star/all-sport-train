import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../server/db";
import { featureEnabled } from "../server/features";
import { badRequest, conflict, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { quizContentSchema, type QuizContent } from "../content/sports/types";
import { drawQuestions, grade, publicQuestions, type ShownQuestion } from "../domain/quiz";
import { awardXp } from "./gamification";
import { getLesson, settleLessonAfterQuiz } from "./sports";

/** Submitted attempts allowed per quiz in 24 hours — enough to learn from mistakes, not to brute-force. */
export const ATTEMPTS_PER_DAY = 5;
const shownSchema = z.array(z.object({ id: z.string(), options: z.array(z.string()) }));
export const answersSchema = z.object({ answers: z.record(z.string().max(40), z.array(z.string().max(40)).max(6)) });

async function loadQuiz(lessonId: string) {
  const quiz = await db.lessonQuiz.findUnique({ where: { lessonId } });
  if (!quiz || quiz.contentStatus !== "published") return null;
  const content = quizContentSchema.safeParse(parseJson(quiz.content, z.unknown(), null));
  return content.success ? { ...quiz, parsed: content.data } : null;
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Quiz state for a lesson: size, pass mark, attempt history, whether it's passed, and an open attempt to resume. */
export async function quizForLesson(userId: string, sportSlug: string, lessonSlug: string) {
  if (!featureEnabled("quizzes")) return null;
  const { lesson, prereqsMet } = await getLesson(userId, sportSlug, lessonSlug);
  const quiz = await loadQuiz(lesson.id);
  if (!quiz) return null;
  const attempts = await db.quizAttempt.findMany({ where: { userId, quizId: quiz.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const since = Date.now() - 86_400_000;
  const usedToday = attempts.filter((a) => a.status === "submitted" && a.submittedAt && a.submittedAt.getTime() > since).length;
  const open = attempts.find((a) => a.status === "open");
  return {
    quizId: quiz.id,
    questions: quiz.parsed.perAttempt ?? quiz.parsed.questions.length,
    passPercent: quiz.parsed.passPercent,
    passed: attempts.some((a) => a.passed),
    prereqsMet,
    remainingToday: Math.max(0, ATTEMPTS_PER_DAY - usedToday),
    open: open ? { id: open.id, questions: publicQuestions(quiz.parsed, parseJson(open.questions, shownSchema, [])) } : null,
    history: attempts.filter((a) => a.status === "submitted").map((a) => ({ id: a.id, correct: a.correct, total: a.total, passed: a.passed, submittedAt: a.submittedAt })),
  };
}

/** Starts (or resumes) an attempt. Questions and option order are fixed now, so a refresh shows the same quiz. */
export async function startAttempt(userId: string, sportSlug: string, lessonSlug: string) {
  const { lesson, prereqsMet, hub } = await getLesson(userId, sportSlug, lessonSlug);
  if (!prereqsMet) {
    const missing = lesson.prerequisites.map((p) => hub.lessons.find((l) => l.slug === p)?.title ?? p);
    throw conflict(`Complete ${missing.join(", ")} first — this check builds on ${missing.length > 1 ? "them" : "it"}.`);
  }
  const quiz = await loadQuiz(lesson.id);
  if (!quiz) throw notFound("This lesson has no knowledge check");
  const openKey = `${userId}:${quiz.id}`;
  const existing = await db.quizAttempt.findUnique({ where: { openKey } });
  if (existing) return attemptView(existing, quiz.parsed);
  const used = await db.quizAttempt.count({ where: { userId, quizId: quiz.id, status: "submitted", submittedAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (used >= ATTEMPTS_PER_DAY) throw conflict(`You've used today's ${ATTEMPTS_PER_DAY} attempts for this check. Review the lesson and try again tomorrow.`);
  const shown = drawQuestions(quiz.parsed);
  try {
    const attempt = await db.quizAttempt.create({ data: { userId, quizId: quiz.id, quizVersion: quiz.version, questions: JSON.stringify(shown), total: shown.length, openKey } });
    return attemptView(attempt, quiz.parsed);
  } catch (e) {
    // Two starts at once: both get the same open attempt.
    if (isUniqueViolation(e)) return attemptView(await db.quizAttempt.findUniqueOrThrow({ where: { openKey } }), quiz.parsed);
    throw e;
  }
}

function attemptView(a: { id: string; questions: string }, quiz: QuizContent) {
  return { attemptId: a.id, questions: publicQuestions(quiz, parseJson(a.questions, shownSchema, [])) };
}

/**
 * Grades an attempt once. A repeated submission (double tap, retry after a lost response) returns the
 * same result and never awards XP twice. Passing settles the lesson (see settleLessonAfterQuiz).
 */
export async function submitAttempt(userId: string, attemptId: string, answers: Record<string, string[]>) {
  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, userId }, include: { quiz: true } });
  if (!attempt) throw notFound("Attempt not found");
  const content = quizContentSchema.safeParse(parseJson(attempt.quiz.content, z.unknown(), null));
  if (!content.success) throw conflict("This knowledge check is being updated. Please start again later.");
  const shown: ShownQuestion[] = parseJson(attempt.questions, shownSchema, []);
  if (attempt.status === "submitted") return resultView(attempt.id, content.data, shown, parseJson(attempt.answers ?? "{}", z.record(z.string(), z.array(z.string())), {}), false);
  if (attempt.quizVersion !== attempt.quiz.version) {
    await db.quizAttempt.update({ where: { id: attempt.id }, data: { status: "submitted", openKey: null, submittedAt: new Date(), correct: 0, passed: false, answers: "{}" } });
    throw conflict("This knowledge check changed since you started. Start a new attempt.");
  }
  const unknown = Object.keys(answers).filter((id) => !shown.some((q) => q.id === id));
  if (unknown.length) throw badRequest("Answers don't match this attempt's questions");
  const result = grade(content.data, shown, answers);
  const claimed = await db.quizAttempt.updateMany({
    where: { id: attempt.id, status: "open" },
    data: { status: "submitted", openKey: null, submittedAt: new Date(), answers: JSON.stringify(Object.fromEntries(result.review.map((r) => [r.id, r.selected]))), correct: result.correct, passed: result.passed },
  });
  if (!claimed.count) {
    // A concurrent submission graded it first: return what was stored.
    const stored = await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    return resultView(attempt.id, content.data, shown, parseJson(stored.answers ?? "{}", z.record(z.string(), z.array(z.string())), {}), false);
  }
  let lesson: "completed" | "awaiting_assessment" | null = null;
  if (result.passed) {
    await awardXp(userId, "quiz", attempt.quizId, 10); // once per quiz, ever (unique XP event)
    lesson = await settleLessonAfterQuiz(userId, attempt.quiz.lessonId);
  }
  return { ...resultView(attempt.id, content.data, shown, answers, true), lesson };
}

function resultView(attemptId: string, quiz: QuizContent, shown: ShownQuestion[], answers: Record<string, string[]>, fresh: boolean) {
  const r = grade(quiz, shown, answers);
  return { attemptId, fresh, correct: r.correct, total: r.total, percent: r.percent, passPercent: r.passPercent, passed: r.passed, review: r.review, lesson: null as "completed" | "awaiting_assessment" | null };
}

/** Review of one submitted attempt (the user's own). */
export async function attemptReview(userId: string, attemptId: string) {
  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, userId, status: "submitted" }, include: { quiz: true } });
  if (!attempt) throw notFound("Attempt not found");
  const content = quizContentSchema.safeParse(parseJson(attempt.quiz.content, z.unknown(), null));
  if (!content.success) throw notFound("Attempt not found");
  return resultView(attempt.id, content.data, parseJson(attempt.questions, shownSchema, []), parseJson(attempt.answers ?? "{}", z.record(z.string(), z.array(z.string())), {}), false);
}
