import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { getLesson, setLessonProgress } from "@/lib/services/sports";

export const GET = authedRoute({}, async ({ user, params }) => {
  const { lesson, drills, prereqsMet, next } = await getLesson(user.id, params.slug, params.lesson);
  return { lesson, drills, prereqsMet, next: next?.slug ?? null };
});
export const POST = authedRoute({ body: z.object({ status: z.enum(["in_progress", "completed", "reset"]) }) }, async ({ user, params, body }) =>
  setLessonProgress(user.id, params.slug, params.lesson, body.status),
);
