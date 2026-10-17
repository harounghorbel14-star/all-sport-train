import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { listClaims } from "@/lib/services/research";

export const GET = authedRoute(
  { admin: true, query: z.object({ sport: z.string().max(60).optional(), status: z.string().max(20).optional(), limit: z.coerce.number().int().min(1).max(500).optional() }) },
  async ({ query }) => ({ claims: await listClaims({ sportSlug: query.sport, status: query.status, limit: query.limit }) }),
);
