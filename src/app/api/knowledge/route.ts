import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { searchKnowledge } from "@/lib/services/research";

/** Searches published lessons, drills, rules summaries and verified claims (keyword search). */
export const GET = authedRoute({ query: z.object({ q: z.string().trim().min(2).max(200), sport: z.string().max(60).optional() }) }, async ({ query }) => ({
  hits: await searchKnowledge(query.q, { sportSlug: query.sport, limit: 10 }),
  mode: "keyword",
}));
