import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { getOrCreateTodayPlan, regenerateToday, weekPreview } from "@/lib/services/workouts";

export const GET = authedRoute({}, async ({ user }) => ({ ...(await getOrCreateTodayPlan(user.id)), week: await weekPreview(user.id) }));

const overrides = z.object({
  minutes: z.number().int().min(10).max(120).optional(),
  focus: z.string().max(30).optional(),
  avoidMuscles: z.array(z.string().max(20)).max(10).optional(),
  ignoreReadiness: z.boolean().optional(),
  /** Adapting after a check-in: plans the user edited (or got from the coach) are kept. */
  keepEdited: z.boolean().optional(),
});
export const POST = authedRoute({ body: overrides }, async ({ user, body }) => regenerateToday(user.id, body));
