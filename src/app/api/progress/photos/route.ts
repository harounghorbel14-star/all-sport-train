import { authedRoute } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { isDateKey } from "@/lib/domain/dates";
import { listProgressPhotos, storeUpload } from "@/lib/services/media";

export const GET = authedRoute({}, async ({ user }) => ({ photos: await listProgressPhotos(user.id) }));

export const POST = authedRoute({}, async ({ user, req }) => {
  rateLimit(`upload:${user.id}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Expected a multipart form upload");
  const file = form.get("file");
  const pose = String(form.get("pose") ?? "");
  const dateKey = String(form.get("dateKey") ?? "");
  if (!(file instanceof Blob)) throw badRequest("Choose a photo");
  if (!["front", "side", "back"].includes(pose)) throw badRequest("Choose front, side or back");
  if (!isDateKey(dateKey)) throw badRequest("Invalid date");
  if (file.size > 8 * 1024 * 1024) throw badRequest("File too large (max 8 MB)");
  const buf = new Uint8Array(await file.arrayBuffer());
  const media = await storeUpload(user.id, buf, { kind: "progress_photo", consent: form.get("consent") === "true", pose, dateKey });
  return { photo: media };
});
