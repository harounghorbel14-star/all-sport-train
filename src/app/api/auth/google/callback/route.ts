import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { log } from "@/lib/server/logger";
import { recordAuthEvent } from "@/lib/auth/audit";
import { resolveGoogleIdentity } from "@/lib/auth/accounts";
import { completeGoogleAuth, GoogleAuthError, OAUTH_COOKIE, readOAuthState } from "@/lib/auth/google";
import { landingFor, withSession } from "@/lib/auth/respond";
import { readCookie } from "@/lib/auth/session";
import { safeEqual } from "@/lib/auth/tokens";

const query = z.object({ code: z.string().max(2000).optional(), state: z.string().max(200).optional(), error: z.string().max(200).optional() });

export const GET = publicRoute({ query }, async ({ req, query: q, user: current }) => {
  const base = new URL(req.url).origin;
  const st = readOAuthState(readCookie(req.headers.get("cookie"), OAUTH_COOKIE));
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`${st?.intent === "link" ? "/profile" : "/login"}?error=${code}`, base), 303);
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", expires: new Date(0) });
    return res;
  };
  if (q.error) return fail(q.error === "access_denied" ? "google_cancelled" : "google_failed");
  // State must match the signed, unexpired cookie set when the flow started (CSRF / mix-up protection).
  if (!st || !q.state || !q.code || !safeEqual(q.state, st.state)) return fail("google_state");
  try {
    const identity = await completeGoogleAuth(req, q.code, st);
    const outcome = await resolveGoogleIdentity(req, identity, st.intent, current);
    if (outcome.kind === "error") return fail(outcome.code);
    if (outcome.kind === "linked") {
      const res = NextResponse.redirect(new URL("/profile?linked=google", base), 303);
      res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", expires: new Date(0) });
      return res;
    }
    const dest = outcome.isNew ? "/onboarding" : await landingFor(outcome.userId, st.next);
    const res = NextResponse.redirect(new URL(dest, base), 303);
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", expires: new Date(0) });
    // A guest upgraded in place keeps the same user id, so no import offer is needed.
    return withSession(res, req, outcome.userId, current?.id === outcome.userId ? null : current);
  } catch (e) {
    const code = e instanceof GoogleAuthError ? e.code : "google_failed";
    if (!(e instanceof GoogleAuthError)) log.error("google_callback_error", { error: e instanceof Error ? e.message : String(e) });
    await recordAuthEvent("google_failed", { userId: current?.id ?? null, req, meta: { code } });
    return fail(code);
  }
});
