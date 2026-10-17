import { publicRoute } from "@/lib/server/api";
import { getExercise } from "@/lib/services/exercises";

export const GET = publicRoute({}, async ({ params, user }) => getExercise(params.slug, user?.id));
