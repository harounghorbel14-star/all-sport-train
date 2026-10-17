import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { submitWeeklyReview } from "@/lib/services/roadmap";

export const POST = authedRoute(
  { body: z.object({ feeling: z.number().int().min(1).max(5), difficulty: z.enum(["too_easy", "right", "too_hard"]), notes: z.string().max(500).optional() }) },
  async ({ user, body }) => submitWeeklyReview(user.id, body),
);
