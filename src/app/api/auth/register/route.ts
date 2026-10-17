import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { adminEmails } from "@/lib/server/env";
import { conflict } from "@/lib/server/errors";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation";
import { uniqueHandle } from "@/lib/services/profile";
import { clientIp } from "@/lib/server/request";

export const POST = publicRoute({ body: registerSchema }, async ({ body, req }) => {
  rateLimit(`register:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (await db.user.findUnique({ where: { email: body.email } })) throw conflict("An account with this email already exists");
  const handle = await uniqueHandle(body.displayName || body.email.split("@")[0]);
  const user = await db.user.create({
    data: {
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: adminEmails().includes(body.email) ? "admin" : "user",
      profile: { create: { displayName: body.displayName, handle, timezone: body.timezone ?? "UTC" } },
    },
  });
  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
  const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
