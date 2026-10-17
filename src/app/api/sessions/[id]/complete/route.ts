import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { completeSession } from "@/lib/services/workouts";

export const POST = authedRoute(
  { body: z.object({ rpe: z.number().int().min(1).max(10).optional(), notes: z.string().max(1000).optional() }) },
  async ({ user, params, body }) => ({ summary: await completeSession(user.id, params.id, body) }),
);
