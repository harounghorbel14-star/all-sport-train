import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { searchSports } from "@/lib/services/sports";

export const GET = authedRoute(
  { query: z.object({ q: z.string().max(60).optional(), category: z.string().max(30).optional(), availability: z.enum(["full", "basic", "external"]).optional() }) },
  async ({ query }) => searchSports(query),
);
