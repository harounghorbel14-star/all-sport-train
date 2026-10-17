import { authedRoute } from "@/lib/server/api";
import { sportReview } from "@/lib/services/sports";

export const GET = authedRoute({}, async ({ user, params }) => sportReview(user.id, params.slug));
