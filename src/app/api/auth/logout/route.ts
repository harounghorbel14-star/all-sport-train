import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/server/api";
import { destroySession, readCookie, SESSION_COOKIE } from "@/lib/auth/session";

export const POST = publicRoute({}, async ({ req }) => {
  await destroySession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
});
