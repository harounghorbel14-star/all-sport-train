import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { setGroupMembership } from "@/lib/services/community";

export const POST = authedRoute({ body: z.object({ join: z.boolean() }) }, async ({ user, params, body }) => setGroupMembership(user.id, params.id, body.join));
