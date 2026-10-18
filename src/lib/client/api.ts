"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Fetch wrapper for the app's own JSON API. Throws ApiError with a user-facing message. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "You appear to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) window.location.href = "/login";
    const details = data?.error?.details;
    const firstField = details && typeof details === "object" ? Object.values(details as Record<string, string[]>)[0]?.[0] : undefined;
    throw new ApiError(res.status, firstField ? `${data?.error?.message}: ${firstField}` : (data?.error?.message ?? "Something went wrong"), details);
  }
  return data as T;
}

/**
 * Runs a user-initiated request (delete, toggle…). On failure it tells the user and resolves
 * false so the caller can stop, instead of silently pretending the action worked.
 */
export async function attempt(request: Promise<unknown>, toast: (message: string, tone: "error") => void) {
  try {
    await request;
    return true;
  } catch (e) {
    toast(e instanceof Error && e.message ? e.message : "That didn't work — please try again", "error");
    return false;
  }
}
