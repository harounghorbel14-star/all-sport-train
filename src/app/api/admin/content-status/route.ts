import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { adminSetStatus } from "@/lib/services/sports";

export const POST = authedRoute(
  { admin: true, body: z.object({ type: z.enum(["sport", "lesson", "drill", "ruleset"]), id: z.string().max(40), status: z.enum(["draft", "review", "published"]) }) },
  async ({ body }) => adminSetStatus(body.type, body.id, body.status),
);
