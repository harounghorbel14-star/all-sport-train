import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { createPost } from "@/lib/services/community";

export const POST = authedRoute(
  {
    body: z.object({
      body: z.string().max(1000),
      kind: z.enum(["text", "workout", "achievement"]),
      refId: z.string().max(60).optional(),
      visibility: z.enum(["friends", "public", "group"]),
      groupId: z.string().max(40).optional(),
    }),
  },
  async ({ user, body }) => {
    rateLimit(`social:${user.id}`, LIMITS.social.limit, LIMITS.social.windowMs);
    return { post: await createPost(user.id, body) };
  },
);
