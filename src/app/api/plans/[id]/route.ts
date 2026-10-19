import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { getPlan, updatePlan } from "@/lib/services/workouts";
import { cancelPlan, reschedulePlan, restorePlan } from "@/lib/services/calendar";

export const GET = authedRoute({}, async ({ user, params }) => getPlan(user.id, params.id));
export const PUT = authedRoute({ body: z.object({ workout: z.unknown() }) }, async ({ user, params, body }) => updatePlan(user.id, params.id, body.workout));

/** Calendar actions on a scheduled workout. */
export const PATCH = authedRoute(
  {
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("reschedule"), dateKey: z.string() }),
      z.object({ action: z.literal("cancel") }),
      z.object({ action: z.literal("restore") }),
    ]),
  },
  async ({ user, params, body }) => {
    if (body.action === "reschedule") return reschedulePlan(user.id, params.id, body.dateKey);
    if (body.action === "cancel") return { plan: await cancelPlan(user.id, params.id), warnings: [] };
    return { plan: await restorePlan(user.id, params.id), warnings: [] };
  },
);
