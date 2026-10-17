import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation";
import { clientIp } from "@/lib/server/request";

export const POST = publicRoute({ body: loginSchema }, async ({ body, req }) => {
  rateLimit(`login:${clientIp(req)}:${body.email}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  const user = await db.user.findUnique({ where: { email: body.email } });
  // Same message for unknown email and wrong password.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) throw new AppError(401, "invalid_credentials", "Email or password is incorrect");
  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
  const res = NextResponse.json({ user: { id: user.id, email: user.email } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
