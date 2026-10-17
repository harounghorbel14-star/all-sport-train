import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { recordAuthEvent } from "@/lib/auth/audit";
import { destroySession, readCookie, SESSION_COOKIE } from "@/lib/auth/session";

/** Ends this session, or every session of the user with { all: true }. */
const bodySchema = z.object({ all: z.boolean().optional() });

export const POST = publicRoute({}, async ({ req, user }) => {
  // The body is optional: a plain POST logs out this session.
  const body = bodySchema.safeParse(await req.json().catch(() => ({}))).data;
  if (body?.all && user) await db.session.deleteMany({ where: { userId: user.id } });
  else await destroySession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  if (user) await recordAuthEvent(body?.all ? "logout_all" : "logout", { userId: user.id, req });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
});
