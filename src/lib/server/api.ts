import { NextResponse } from "next/server";
import { featureEnabled, type Feature } from "./features";
import { z } from "zod";
import { AppError, badRequest, forbidden, unauthorized } from "./errors";
import { getUserFromToken, readCookie, SESSION_COOKIE, type AuthUser } from "../auth/session";
import { log } from "./logger";
import { isAdmin } from "../auth/roles";

type Ctx<B, Q, P> = { req: Request; body: B; query: Q; params: P };
type AuthedCtx<B, Q, P> = Ctx<B, Q, P> & { user: AuthUser };

interface Options<B, Q> {
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  admin?: boolean;
  /** Refuse with 404 while this feature is switched off (FEATURES_DISABLED). */
  feature?: Feature;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Areas a guest session may not use: anything social (visible to other people), private
 * media/uploads, photo-based AI and administration. Checked centrally so new routes in
 * these areas are covered automatically.
 */
export const GUEST_BLOCKED_PREFIXES = ["/api/community", "/api/challenges", "/api/media", "/api/form-check", "/api/progress/photos", "/api/admin"];

export function guestBlocked(pathname: string) {
  return GUEST_BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Reject cross-site mutations. Cookies are SameSite=Lax already; this adds a
 * same-origin check so a forged form post from another site cannot act.
 */
function assertSameOrigin(req: Request) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (tests, curl) send no Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw forbidden("Cross-origin request rejected");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw forbidden("Invalid origin");
  }
}

async function parseInput<B, Q>(req: Request, opts: Options<B, Q>) {
  let body = undefined as B;
  let query = undefined as Q;
  if (opts.body) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw badRequest("Request body must be valid JSON");
    }
    const parsed = opts.body.safeParse(raw);
    if (!parsed.success) throw badRequest("Invalid input", z.flattenError(parsed.error as z.ZodError<unknown>).fieldErrors);
    body = parsed.data;
  }
  if (opts.query) {
    const params = Object.fromEntries(new URL(req.url).searchParams.entries());
    const parsed = opts.query.safeParse(params);
    if (!parsed.success) throw badRequest("Invalid query", z.flattenError(parsed.error as z.ZodError<unknown>).fieldErrors);
    query = parsed.data;
  }
  return { body, query };
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    const res = NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
    if (e.status === 429 && e.details && typeof e.details === "object" && "retryAfter" in e.details) {
      res.headers.set("Retry-After", String((e.details as { retryAfter: number }).retryAfter));
    }
    return res;
  }
  log.error("unhandled_api_error", { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined });
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, { status: 500 });
}

type RouteParams = { params: Promise<Record<string, string>> };

/** Public endpoint (no session required). */
export function publicRoute<B = undefined, Q = undefined>(
  opts: Options<B, Q>,
  fn: (ctx: Ctx<B, Q, Record<string, string>> & { user: AuthUser | null }) => Promise<Response | unknown>,
) {
  return async (req: Request, route: RouteParams) => {
    try {
      assertSameOrigin(req);
      const params = (await route?.params) ?? {};
      const { body, query } = await parseInput(req, opts);
      const user = await getUserFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
      const out = await fn({ req, body, query, params, user });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Authenticated endpoint. Every handler receives the verified user; ownership checks use user.id. */
export function authedRoute<B = undefined, Q = undefined>(
  opts: Options<B, Q>,
  fn: (ctx: AuthedCtx<B, Q, Record<string, string>>) => Promise<Response | unknown>,
) {
  return async (req: Request, route: RouteParams) => {
    try {
      assertSameOrigin(req);
      const user = await getUserFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
      if (!user) throw unauthorized();
      if (user.isGuest && guestBlocked(new URL(req.url).pathname)) throw new AppError(403, "guest_restricted", "Create a free account to use this feature. Your guest progress will be kept.");
      if (opts.feature && !featureEnabled(opts.feature)) throw new AppError(404, "feature_disabled", "This feature is turned off right now. Your data is kept.");
      if (opts.admin && !isAdmin(user)) throw forbidden(user.role === "admin" ? "Verify your email (use “Forgot password” once) to use admin features" : "Administrator access required");
      const params = (await route?.params) ?? {};
      const { body, query } = await parseInput(req, opts);
      const out = await fn({ req, body, query, params, user });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
