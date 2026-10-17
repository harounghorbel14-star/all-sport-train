import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../server/env";

/** HMAC-SHA256 keyed with SESSION_SECRET (purpose-separated). */
export const hmac = (purpose: string, value: string) => createHmac("sha256", env().SESSION_SECRET).update(`${purpose}:${value}`).digest("base64url");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Tamper-proof cookie payload: base64url(JSON).signature, with an expiry. */
export function signPayload(purpose: string, data: Record<string, unknown>, ttlMs: number) {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString("base64url");
  return `${body}.${hmac(purpose, body)}`;
}

export function verifyPayload<T extends Record<string, unknown>>(purpose: string, value: string | undefined | null): T | null {
  if (!value || value.length > 4000) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(purpose, body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
