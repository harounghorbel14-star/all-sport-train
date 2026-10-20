import { authedRoute } from "@/lib/server/api";
import { createTravel, listTravel, travelSchema } from "@/lib/services/travel";

export const GET = authedRoute({}, async ({ user }) => listTravel(user.id));
export const POST = authedRoute({ body: travelSchema }, async ({ user, body }) => ({ trip: await createTravel(user.id, body) }));
