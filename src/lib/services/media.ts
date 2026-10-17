import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../server/db";
import { env } from "../server/env";
import { badRequest, notFound } from "../server/errors";

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** Identify a file by its magic bytes — never trust the client-supplied type or extension. */
export function sniffMime(buf: Uint8Array): string | null {
  const b = (i: number) => buf[i];
  if (buf.length < 12) return null;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  const ascii = (s: number, e: number) => String.fromCharCode(...buf.slice(s, e));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    return brand.startsWith("qt") ? "video/quicktime" : "video/mp4";
  }
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return "video/webm";
  return null;
}

export function validateUpload(buf: Uint8Array, allowed: "image" | "video" | "any") {
  const mime = sniffMime(buf);
  if (!mime) throw badRequest("Unsupported file. Use JPEG, PNG, WebP, MP4, MOV or WebM.");
  const isImage = mime.startsWith("image/");
  if (allowed === "image" && !isImage) throw badRequest("Please upload an image (JPEG, PNG or WebP).");
  if (allowed === "video" && isImage) throw badRequest("Please upload a video (MP4, MOV or WebM).");
  const max = isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
  if (buf.byteLength > max) throw badRequest(`File too large (max ${Math.round(max / 1024 / 1024)} MB).`);
  return mime;
}

const root = () => path.resolve(env().UPLOAD_DIR);
const fileFor = (userId: string, key: string) => {
  if (!/^[a-z0-9]+$/.test(userId) || !/^[a-f0-9]{32}$/.test(key)) throw badRequest("Invalid storage key");
  return path.join(root(), userId, key);
};

/** Stores a private upload outside the public directory. Requires explicit consent. */
export async function storeUpload(
  userId: string,
  buf: Uint8Array,
  opts: { kind: "progress_photo" | "form_image" | "form_video"; consent: boolean; pose?: string | null; dateKey?: string | null },
) {
  if (!opts.consent) throw badRequest("Please confirm consent before uploading.");
  const mime = validateUpload(buf, opts.kind === "form_video" ? "video" : "image");
  const key = randomBytes(16).toString("hex");
  const file = fileFor(userId, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf, { mode: 0o600 });
  return db.mediaUpload.create({
    data: { userId, kind: opts.kind, pose: opts.pose ?? null, dateKey: opts.dateKey ?? null, mimeType: mime, sizeBytes: buf.byteLength, storageKey: key, consentAt: new Date() },
  });
}

/** Reads media only for its owner. */
export async function readUpload(userId: string, mediaId: string) {
  const m = await db.mediaUpload.findFirst({ where: { id: mediaId, userId } });
  if (!m) throw notFound("Media not found");
  const data = await readFile(fileFor(userId, m.storageKey)).catch(() => null);
  if (!data) throw notFound("Media file missing");
  return { media: m, data };
}

export async function deleteUpload(userId: string, mediaId: string) {
  const m = await db.mediaUpload.findFirst({ where: { id: mediaId, userId } });
  if (!m) throw notFound("Media not found");
  await rm(fileFor(userId, m.storageKey), { force: true });
  await db.mediaUpload.delete({ where: { id: m.id } });
}

export async function deleteAllUploads(userId: string) {
  if (!/^[a-z0-9]+$/.test(userId)) return;
  await rm(path.join(root(), userId), { recursive: true, force: true });
}

export async function listProgressPhotos(userId: string) {
  return db.mediaUpload.findMany({ where: { userId, kind: "progress_photo" }, orderBy: [{ dateKey: "desc" }, { createdAt: "desc" }], take: 200 });
}
