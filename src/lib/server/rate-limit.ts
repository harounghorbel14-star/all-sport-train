import { tooMany } from "./errors";

/**
 * In-memory sliding-window limiter. Adequate for a single instance; for multiple
 * instances replace the store with Redis (same interface).
 */
const buckets = new Map<string, { hits: number[]; windowMs: number }>();
let calls = 0;

/** Drops buckets whose hits have all expired, so one-off keys (IPs, emails) don't accumulate forever. */
function sweep(now: number) {
  for (const [key, b] of buckets) if (!b.hits.length || now - b.hits[b.hits.length - 1] >= b.windowMs) buckets.delete(key);
}

// Test environments that create many accounts from one IP can raise limits (e.g. RATE_LIMIT_MULTIPLIER=20).
// Never set this in production.
const MULTIPLIER = Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);

export function rateLimit(key: string, baseLimit: number, windowMs: number, now = Date.now()) {
  const limit = baseLimit * MULTIPLIER;
  if (++calls % 500 === 0 || buckets.size > 10_000) sweep(now);
  const hits = (buckets.get(key)?.hits ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    buckets.set(key, { hits, windowMs });
    throw tooMany(retryAfter);
  }
  hits.push(now);
  buckets.set(key, { hits, windowMs });
}

export const rateLimitBucketCount = () => buckets.size;

export function resetRateLimits() {
  buckets.clear();
  calls = 0;
}

export const LIMITS = {
  auth: { limit: 10, windowMs: 10 * 60_000 },
  ai: { limit: 20, windowMs: 60 * 60_000 },
  upload: { limit: 30, windowMs: 60 * 60_000 },
  social: { limit: 30, windowMs: 10 * 60_000 },
} as const;
