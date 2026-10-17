import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { logPrerequisiteTest } from "@/lib/services/skills";

export const POST = authedRoute(
  { body: z.object({ exercise: z.string().max(60), metric: z.enum(["reps", "seconds"]), value: z.number().min(1).max(3600) }) },
  async ({ user, body }) => ({ record: await logPrerequisiteTest(user.id, body.exercise, body.metric, body.value) }),
);
