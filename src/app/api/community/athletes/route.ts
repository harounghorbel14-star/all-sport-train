import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { searchAthletes } from "@/lib/services/community";

export const GET = authedRoute({ query: z.object({ q: z.string().max(40) }) }, async ({ user, query }) => ({ athletes: await searchAthletes(user.id, query.q) }));
