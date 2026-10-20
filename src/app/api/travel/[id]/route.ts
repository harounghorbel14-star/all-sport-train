import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { applyTravel, cancelTravel, previewTravel } from "@/lib/services/travel";

/** Preview of how scheduled workouts inside the trip would change. */
export const GET = authedRoute({}, async ({ user, params }) => previewTravel(user.id, params.id));

/** Apply the chosen changes, or cancel the trip (adapted workouts get their originals back). */
export const POST = authedRoute(
  { body: z.discriminatedUnion("action", [z.object({ action: z.literal("apply"), planIds: z.array(z.string().max(40)).max(60) }), z.object({ action: z.literal("cancel") })]) },
  async ({ user, params, body }) => (body.action === "apply" ? applyTravel(user.id, params.id, body.planIds) : cancelTravel(user.id, params.id)),
);
