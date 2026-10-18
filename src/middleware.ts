import { NextResponse, type NextRequest } from "next/server";

/** Exposes the requested path to server components so sign-in can return users to it. */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api/|_next/|icon.svg|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"] };
