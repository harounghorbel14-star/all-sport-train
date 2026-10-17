import { authedRoute } from "@/lib/server/api";
import { getPractice } from "@/lib/services/sports";

export const GET = authedRoute({}, async ({ user, params }) => getPractice(user.id, params.id));
