import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { googleConfigured } from "@/lib/server/env";
import { beginGoogleAuth, OAUTH_COOKIE } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/redirect";

/** Starts Google sign-in (or linking, for a signed-in user) by redirecting to Google's consent screen. */
export const GET = publicRoute({ query: z.object({ next: z.string().max(300).optional(), intent: z.enum(["login", "link"]).optional() }) }, async ({ req, query }) => {
  const base = new URL(req.url).origin;
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login?error=google_not_configured", base), 303);
  const { url, cookie, maxAge } = beginGoogleAuth(req, safeNext(query.next), query.intent ?? "login");
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(OAUTH_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge });
  return res;
});
