import { db } from "../server/db";
import { adminEmails } from "../server/env";

/**
 * Admin access requires BOTH the admin role and a verified email. ADMIN_EMAILS only
 * promotes an account once its owner has proven control of that inbox (Google sign-in
 * with a verified email, or a completed password-reset link) — never at registration,
 * where anyone could type the address first.
 */
export const isAdmin = (user: { role: string; emailVerifiedAt: Date | null; isGuest?: boolean } | null | undefined) =>
  Boolean(user && !user.isGuest && user.role === "admin" && user.emailVerifiedAt);

export async function promoteIfVerifiedAdmin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.isGuest || !user.emailVerifiedAt || user.role === "admin") return;
  if (adminEmails().includes(user.email)) await db.user.update({ where: { id: userId }, data: { role: "admin" } });
}
