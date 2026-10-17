import { db } from "../server/db";
import { badRequest, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { analyzeForm, formCheckResultSchema, type Frame } from "../ai/form-check";
import { deleteUpload, storeUpload, validateUpload } from "./media";

/**
 * Runs a form check. Media is analysed in memory; it is only written to private
 * storage when the user explicitly asks to keep it.
 */
export async function runFormCheck(userId: string, input: { exercise: string; mediaKind: "photo" | "video"; frames: Buffer[]; consent: boolean; retain: boolean }) {
  if (!input.consent) throw badRequest("Please confirm consent before uploading.");
  if (!input.frames.length) throw badRequest("Add a photo or video first");
  const frames: Frame[] = input.frames.map((buf) => ({ data: buf.toString("base64"), mediaType: validateUpload(buf, "image") as Frame["mediaType"] }));
  const result = await analyzeForm(input.exercise, frames, input.mediaKind);
  let mediaId: string | null = null;
  if (input.retain) {
    const media = await storeUpload(userId, input.frames[Math.floor(input.frames.length / 2)], { kind: "form_image", consent: true });
    mediaId = media.id;
  }
  const check = await db.formCheck.create({
    data: { userId, exerciseSlug: input.exercise, mediaKind: input.mediaKind, mediaId, provider: result.provider, result: JSON.stringify(result) },
  });
  return { id: check.id, result, mediaId };
}

export async function listFormChecks(userId: string) {
  const rows = await db.formCheck.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((r) => ({ ...r, result: parseJson(r.result, formCheckResultSchema.passthrough(), null) }));
}

export async function deleteFormCheck(userId: string, id: string) {
  const row = await db.formCheck.findFirst({ where: { id, userId } });
  if (!row) throw notFound("Analysis not found");
  if (row.mediaId) await deleteUpload(userId, row.mediaId).catch(() => undefined);
  await db.formCheck.delete({ where: { id: row.id } });
}
