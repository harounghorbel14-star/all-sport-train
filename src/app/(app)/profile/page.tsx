import { requireUser } from "@/lib/auth/server";
import { aiStatus } from "@/lib/ai/provider";
import { env } from "@/lib/server/env";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsApp } from "./settings";

export const metadata = { title: "Profile & Settings" };

export default async function ProfilePage() {
  const { user, profile } = await requireUser();
  return (
    <div>
      <PageHeader eyebrow={`@${profile.handle}`} title="Profile & Settings" subtitle="Change anything from onboarding, your preferences, privacy and notifications." />
      <SettingsApp
        email={user.email}
        tier={user.tier}
        profile={JSON.parse(JSON.stringify(profile))}
        ai={aiStatus()}
        usda={!!env().FDC_API_KEY}
      />
    </div>
  );
}
