import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { estimateMeal } from "@/lib/ai/meal-estimate";

const body = z.object({
  text: z.string().max(500).optional(),
  image: z
    .object({ data: z.string().max(11_000_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]) })
    .optional(),
});

export const POST = authedRoute({ body }, async ({ user, body }) => {
  rateLimit(`ai:${user.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (body.image) {
    // Validate the decoded bytes rather than trusting the declared type.
    const { validateUpload } = await import("@/lib/services/media");
    const mime = validateUpload(Buffer.from(body.image.data, "base64"), "image");
    body.image.mediaType = mime as typeof body.image.mediaType;
  }
  // The photo is used for this estimate only and is not stored.
  return { estimate: await estimateMeal(body) };
});
