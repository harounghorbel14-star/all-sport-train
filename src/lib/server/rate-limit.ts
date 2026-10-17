import { tooMany } from "./errors";

/**
 * In-memory sliding-window limiter. Adequate for a single instance; for multiple
 * instances replace the store with Redis (same interface).
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    buckets.set(key, hits);
    throw tooMany(retryAfter);
  }
  hits.push(now);
  buckets.set(key, hits);
}

export function resetRateLimits() {
  buckets.clear();
}

export const LIMITS = {
  auth: { limit: 10, windowMs: 10 * 60_000 },
  ai: { limit: 20, windowMs: 60 * 60_000 },
  upload: { limit: 30, windowMs: 60 * 60_000 },
  social: { limit: 30, windowMs: 10 * 60_000 },
} as const;
