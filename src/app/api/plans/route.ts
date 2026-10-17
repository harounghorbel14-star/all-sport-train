import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { createPlan, listPlans } from "@/lib/services/workouts";
import { dateKeySchema } from "@/lib/validation";

export const GET = authedRoute({}, async ({ user }) => ({ plans: await listPlans(user.id) }));
export const POST = authedRoute(
  { body: z.object({ workout: z.unknown(), scheduledOn: dateKeySchema.optional() }) },
  async ({ user, body }) => ({ plan: await createPlan(user.id, body.workout as never, "custom", body.scheduledOn) }),
);
