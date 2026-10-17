import { authedRoute } from "@/lib/server/api";
import { substitutionOptions } from "@/lib/services/workouts";

export const GET = authedRoute({}, async ({ user, params }) => ({ options: await substitutionOptions(user.id, params.slug) }));
