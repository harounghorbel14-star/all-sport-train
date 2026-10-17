import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { feed } from "@/lib/services/community";

export const GET = authedRoute({ query: z.object({ cursor: z.string().max(40).optional(), group: z.string().max(40).optional() }) }, async ({ user, query }) =>
  feed(user.id, { cursor: query.cursor, groupId: query.group }),
);
