import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { abandonSession, getSession, updateSessionState } from "@/lib/services/workouts";

export const GET = authedRoute({}, async ({ user, params }) => getSession(user.id, params.id));

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("goto"), index: z.number().int().min(0).max(50) }),
  z.object({ action: z.literal("substitute"), blockIndex: z.number().int().min(0).max(50), exercise: z.string().max(60) }),
  z.object({ action: z.literal("notes"), notes: z.string().max(1000) }),
]);
export const PATCH = authedRoute({ body: action }, async ({ user, params, body }) => ({ session: await updateSessionState(user.id, params.id, body) }));
export const DELETE = authedRoute({}, async ({ user, params }) => abandonSession(user.id, params.id));
