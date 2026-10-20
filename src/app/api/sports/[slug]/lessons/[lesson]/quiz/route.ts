import { authedRoute } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { quizForLesson, startAttempt } from "@/lib/services/quizzes";

/** The lesson's knowledge check: size, pass mark, history, and an open attempt to resume. */
export const GET = authedRoute({ feature: "quizzes" }, async ({ user, params }) => {
  const quiz = await quizForLesson(user.id, params.slug, params.lesson);
  if (!quiz) throw notFound("This lesson has no knowledge check");
  return { quiz };
});

/** Starts (or resumes) an attempt. */
export const POST = authedRoute({ feature: "quizzes" }, async ({ user, params }) => startAttempt(user.id, params.slug, params.lesson));
