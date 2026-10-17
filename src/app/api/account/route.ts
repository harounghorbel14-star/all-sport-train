import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/services/account";

export const DELETE = authedRoute({ body: z.object({ password: z.string().max(200).optional(), confirm: z.literal("DELETE") }) }, async ({ user, body }) => {
  // Accounts without a password (Google-only, guests) confirm with the typed "DELETE" alone.
  if (user.passwordHash && !(await verifyPassword(body.password ?? "", user.passwordHash))) throw new AppError(401, "invalid_credentials", "Password is incorrect");
  await deleteAccount(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
});
