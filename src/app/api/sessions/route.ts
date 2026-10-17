import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { activeSession, recentSessions, startSession } from "@/lib/services/workouts";

export const GET = authedRoute({}, async ({ user }) => ({ active: await activeSession(user.id), recent: await recentSessions(user.id) }));
export const POST = authedRoute({ body: z.object({ planId: z.string().max(40) }) }, async ({ user, body }) => ({ session: await startSession(user.id, body.planId) }));
