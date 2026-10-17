import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { coachReply, coachHistory, clearCoachHistory } from "@/lib/ai/coach";
import { aiStatus } from "@/lib/ai/provider";

export const GET = authedRoute({}, async ({ user }) => ({ messages: await coachHistory(user.id), ai: aiStatus() }));
export const POST = authedRoute({ body: z.object({ message: z.string().trim().min(1).max(1000), sport: z.string().regex(/^[a-z0-9_-]{2,60}$/).optional() }) }, async ({ user, body }) => {
  rateLimit(`coach:${user.id}`, LIMITS.ai.limit * 3, LIMITS.ai.windowMs);
  await coachReply(user.id, body.message, body.sport);
  return { messages: await coachHistory(user.id) };
});
export const DELETE = authedRoute({}, async ({ user }) => {
  await clearCoachHistory(user.id);
  return { ok: true };
});
