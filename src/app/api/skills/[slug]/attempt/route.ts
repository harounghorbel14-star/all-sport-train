import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { logSkillAttempt } from "@/lib/services/skills";

export const POST = authedRoute({ body: z.object({ value: z.number().min(0).max(3600) }) }, async ({ user, params, body }) => logSkillAttempt(user.id, params.slug, body.value));
