import { authedRoute } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { listFormChecks, runFormCheck } from "@/lib/services/formcheck";

export const GET = authedRoute({}, async ({ user }) => ({ checks: await listFormChecks(user.id) }));

export const POST = authedRoute({}, async ({ user, req }) => {
  rateLimit(`ai:${user.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Expected a multipart form upload");
  const exercise = String(form.get("exercise") ?? "");
  const mediaKind = form.get("mediaKind") === "video" ? "video" : "photo";
  const frames = form.getAll("frames").filter((f): f is File => typeof f !== "string");
  if (!/^[a-z0-9-]{2,60}$/.test(exercise)) throw badRequest("Choose an exercise");
  if (frames.length < 1 || frames.length > 6) throw badRequest("Provide between 1 and 6 images");
  const buffers = await Promise.all(frames.map(async (f) => Buffer.from(await f.arrayBuffer())));
  return runFormCheck(user.id, { exercise, mediaKind, frames: buffers, consent: form.get("consent") === "true", retain: form.get("retain") === "true" });
});
