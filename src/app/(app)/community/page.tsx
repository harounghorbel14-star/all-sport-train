import { requireUser } from "@/lib/auth/server";
import { feed, listConnections, listGroups } from "@/lib/services/community";
import { PageHeader } from "@/components/ui/primitives";
import { CommunityApp } from "./app";

export const metadata = { title: "Community" };

export default async function CommunityPage() {
  const { user, profile } = await requireUser({ guest: false });
  const [f, connections, groups] = await Promise.all([feed(user.id), listConnections(user.id), listGroups(user.id)]);
  return (
    <div>
      <PageHeader eyebrow="Train together" title="Community" subtitle="Share wins with friends, join groups and challenges. Everything is optional — body photos and measurements are never shared here." />
      <CommunityApp initialFeed={JSON.parse(JSON.stringify(f))} connections={connections} groups={groups} me={{ handle: profile.handle, visibility: profile.visibility }} />
    </div>
  );
}
