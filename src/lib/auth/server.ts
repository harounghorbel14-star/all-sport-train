import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUserFromToken, SESSION_COOKIE } from "./session";
import { profileView } from "../services/profile";
import { safeNext } from "./redirect";
import { configProblems } from "../server/env";

/** Current user for server components (memoised per request). */
export const currentUser = cache(async () => {
  // Read the cookie first: it marks every guarded page as dynamic. Returning before it would let
  // `next build` (where production config may be absent) prerender pages as a redirect to /login.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (configProblems().length) return null; // misconfigured server: pages show the setup notice instead of crashing
  return getUserFromToken(token);
});

const currentPath = async () => safeNext((await headers()).get("x-pathname"), "/today");

/**
 * Page guard. Anonymous visitors go to /login (and come back afterwards).
 * `guest: false` marks pages that need a full account; guests see an explanation instead.
 */
export async function requireUser(opts: { onboarded?: boolean; guest?: boolean } = {}) {
  const user = await currentUser();
  if (!user || !user.profile) redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
  if (opts.guest === false && user.isGuest) redirect(`/account-required?next=${encodeURIComponent(await currentPath())}`);
  if (opts.onboarded !== false && !user.profile.onboardingCompleted) redirect("/onboarding");
  return { user, profile: profileView(user.profile) };
}
