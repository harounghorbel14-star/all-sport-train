import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { safeNext } from "@/lib/auth/redirect";
import { googleConfigured } from "@/lib/server/env";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Log in" };

const NOTICES: Record<string, string> = { reset: "Your password was changed. Log in with your new password — other devices were signed out.", expired: "Your session expired. Please log in again." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  const user = await currentUser();
  if (user && !user.isGuest) redirect(next || "/today");
  return <AuthForm mode="login" next={next || undefined} errorCode={sp.error} notice={sp.notice ? NOTICES[sp.notice] : undefined} googleEnabled={googleConfigured()} googleDevHint={process.env.NODE_ENV !== "production"} isGuest={user?.isGuest} />;
}
