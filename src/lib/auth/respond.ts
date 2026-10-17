import { NextResponse } from "next/server";
import { db } from "../server/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions, type AuthUser } from "./session";
import { GUEST_CLAIM_COOKIE, guestClaimCookie } from "./accounts";

const claimOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 24 * 3600 };

/**
 * Starts a session for `userId`. When the browser was using a different guest account,
 * a signed claim cookie is kept so the user can explicitly import that guest data later.
 */
export async function withSession(res: NextResponse, req: Request, userId: string, previous: AuthUser | null) {
  const { token, expiresAt } = await createSession(userId, req.headers.get("user-agent"));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  if (previous?.isGuest && previous.id !== userId) res.cookies.set(GUEST_CLAIM_COOKIE, guestClaimCookie(previous.id), claimOptions);
  return res;
}

/** Where a freshly signed-in user should land. */
export async function landingFor(userId: string, next: string) {
  const p = await db.profile.findUnique({ where: { userId }, select: { onboardingCompleted: true } });
  return p?.onboardingCompleted ? next : "/onboarding";
}
