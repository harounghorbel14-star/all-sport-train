import { authedRoute } from "@/lib/server/api";
import { toggleReaction } from "@/lib/services/community";

export const POST = authedRoute({}, async ({ user, params }) => toggleReaction(user.id, params.id));
