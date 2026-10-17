import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUserFromToken, SESSION_COOKIE } from "./session";
import { profileView } from "../services/profile";

/** Current user for server components (memoised per request). */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserFromToken(token);
});

export async function requireUser(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await currentUser();
  if (!user || !user.profile) redirect("/login");
  if (opts.onboarded !== false && !user.profile.onboardingCompleted) redirect("/onboarding");
  return { user, profile: profileView(user.profile) };
}
