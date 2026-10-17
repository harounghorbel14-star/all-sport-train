import { authedRoute } from "@/lib/server/api";
import { publicProfile } from "@/lib/services/community";

export const GET = authedRoute({}, async ({ user, params }) => ({ athlete: await publicProfile(user.id, params.handle) }));
