import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { getPlan, updatePlan } from "@/lib/services/workouts";

export const GET = authedRoute({}, async ({ user, params }) => getPlan(user.id, params.id));
export const PUT = authedRoute({ body: z.object({ workout: z.unknown() }) }, async ({ user, params, body }) => updatePlan(user.id, params.id, body.workout));
