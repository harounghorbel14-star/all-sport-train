import { requireUser } from "@/lib/auth/server";
import { aiStatus } from "@/lib/ai/provider";
import { db } from "@/lib/server/db";
import { env, googleConfigured } from "@/lib/server/env";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsApp } from "./settings";

export const metadata = { title: "Profile & Settings" };

const LINK_MESSAGES: Record<string, string> = {
  google: "Google is now connected — you can sign in with it next time.",
  google_in_use: "That Google account is already connected to a different APEX FIT account.",
  google_cancelled: "Connecting Google was cancelled.",
  google_state: "That attempt expired. Please try again.",
  google_failed: "Connecting Google failed. Please try again.",
  google_token: "We couldn't verify Google's response. Please try again.",
  google_expired: "The Google authorisation expired. Please try again.",
  google_link_requires_login: "Log in to a full account before connecting Google.",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ linked?: string; error?: string }> }) {
  const { user, profile } = await requireUser();
  const sp = await searchParams;
  const [google, sessions] = await Promise.all([db.authAccount.findFirst({ where: { userId: user.id, provider: "google" } }), db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } })]);
  const notice = sp.linked ? { tone: "accent" as const, text: LINK_MESSAGES[sp.linked] ?? "" } : sp.error ? { tone: "danger" as const, text: LINK_MESSAGES[sp.error] ?? "Something went wrong." } : null;
  return (
    <div>
      <PageHeader eyebrow={`@${profile.handle}`} title="Profile & Settings" subtitle="Change anything from onboarding, your preferences, privacy and notifications." />
      <SettingsApp
        email={user.email}
        tier={user.tier}
        profile={JSON.parse(JSON.stringify(profile))}
        ai={aiStatus()}
        usda={!!env().FDC_API_KEY}
        security={{ isGuest: user.isGuest, hasPassword: Boolean(user.passwordHash), emailVerified: Boolean(user.emailVerifiedAt), google: google ? { email: google.email } : null, googleEnabled: googleConfigured(), sessions, notice }}
      />
    </div>
  );
}
