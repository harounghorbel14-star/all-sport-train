import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { analytics } from "@/lib/services/progress";

export const GET = authedRoute(
  { query: z.object({ range: z.enum(["4w", "12w", "24w", "52w"]).optional(), exercise: z.string().max(60).optional() }) },
  async ({ user, query }) => analytics(user.id, query.range, query.exercise),
);
