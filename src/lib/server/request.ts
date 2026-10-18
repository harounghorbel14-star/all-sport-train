import { AppError } from "./errors";

/**
 * Client IP for rate limiting. Only the entries added by our own proxies can be trusted: a client
 * can put anything at the start of X-Forwarded-For, but each proxy appends the address it saw on
 * the right. TRUSTED_PROXY_HOPS (default 1 — Railway, Render, Fly and most PaaS have one) says how
 * many of those right-most entries come from proxies we run behind.
 */
export function clientIp(req: Request) {
  const hops = Math.max(0, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)));
  if (hops > 0) {
    const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (chain.length) return chain[Math.max(0, chain.length - hops)];
    const real = req.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "local";
}

/**
 * Parses a multipart upload without ever buffering more than `maxBytes`: the declared
 * Content-Length is checked first, then the stream is counted as it is read (chunked uploads
 * have no length). Throws 413 as soon as the limit is passed.
 */
export async function readLimitedForm(req: Request, maxBytes: number): Promise<FormData | null> {
  const tooLarge = () => new AppError(413, "payload_too_large", `Upload too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return new Response(body, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData().catch(() => null);
}
