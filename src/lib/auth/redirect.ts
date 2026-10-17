/**
 * Only same-site relative paths are allowed as post-login destinations.
 * Rejects absolute URLs, protocol-relative URLs, backslash tricks and API routes.
 */
export function safeNext(next: string | null | undefined, fallback = "/today") {
  if (!next || typeof next !== "string" || next.length > 300) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://x.invalid");
    if (u.origin !== "http://x.invalid") return fallback;
    if (u.pathname.startsWith("/api/") || ["/login", "/register", "/forgot-password", "/reset-password"].includes(u.pathname)) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
