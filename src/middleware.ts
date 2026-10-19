import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "./lib/server/csp";

/** Sets the Content-Security-Policy (see csp.ts) and exposes the requested path to server components so sign-in can return users to it. */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = { matcher: ["/((?!api/|_next/|icon.svg|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"] };
