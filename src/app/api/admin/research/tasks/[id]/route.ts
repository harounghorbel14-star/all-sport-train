import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { setTaskStatus } from "@/lib/services/research";

export const POST = authedRoute({ admin: true, body: z.object({ status: z.enum(["queued", "in_progress", "needs_review", "done", "blocked", "dismissed"]) }) }, async ({ params, body }) => ({
  task: await setTaskStatus(params.id, body.status),
}));
