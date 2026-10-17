import { authedRoute } from "@/lib/server/api";
import { recoveryOverview } from "@/lib/services/recovery";

export const GET = authedRoute({}, async ({ user }) => recoveryOverview(user.id));
