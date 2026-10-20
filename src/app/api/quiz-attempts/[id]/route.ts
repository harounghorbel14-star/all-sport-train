import { authedRoute } from "@/lib/server/api";
import { answersSchema, attemptReview, submitAttempt } from "@/lib/services/quizzes";

/** Review of a submitted attempt: each question with your answer, the correct one and why. */
export const GET = authedRoute({}, async ({ user, params }) => attemptReview(user.id, params.id));

/** Submits answers. Graded once on the server; repeating the request returns the same result. */
export const POST = authedRoute({ body: answersSchema }, async ({ user, params, body }) => submitAttempt(user.id, params.id, body.answers));
