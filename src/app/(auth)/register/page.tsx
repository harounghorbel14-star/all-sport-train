import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { safeNext } from "@/lib/auth/redirect";
import { googleConfigured } from "@/lib/server/env";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (user && !user.isGuest) redirect("/today");
  return <AuthForm mode="register" next={safeNext(sp.next, "") || undefined} errorCode={sp.error} googleEnabled={googleConfigured()} googleDevHint={process.env.NODE_ENV !== "production"} isGuest={user?.isGuest} />;
}
