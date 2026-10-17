import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { logSet } from "@/lib/services/workouts";

const set = z.object({
  blockIndex: z.number().int().min(0).max(50),
  setNumber: z.number().int().min(1).max(10),
  reps: z.number().int().min(0).max(500).nullable().optional(),
  seconds: z.number().int().min(0).max(3600).nullable().optional(),
  loadKg: z.number().min(0).max(500).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  skipped: z.boolean().optional(),
});
export const POST = authedRoute({ body: set }, async ({ user, params, body }) => logSet(user.id, params.id, body));
