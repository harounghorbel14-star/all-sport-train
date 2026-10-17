import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { report } from "@/lib/services/community";

export const POST = authedRoute(
  { body: z.object({ targetType: z.enum(["post", "comment", "user"]), targetId: z.string().max(40), reason: z.string().max(300) }) },
  async ({ user, body }) => {
    rateLimit(`social:${user.id}`, LIMITS.social.limit, LIMITS.social.windowMs);
    await report(user.id, body);
    return { ok: true };
  },
);
