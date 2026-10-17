import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { sportWeek } from "@/lib/services/sports";

export const GET = authedRoute({ query: z.object({ sessions: z.coerce.number().int().min(1).max(7).optional() }) }, async ({ user, params, query }) => ({ week: await sportWeek(user.id, params.slug, query.sessions) }));
