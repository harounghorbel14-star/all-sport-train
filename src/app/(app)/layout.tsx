import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/server";
import { streakSummary } from "@/lib/services/gamification";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser();
  const streak = await streakSummary(user.id);
  return (
    <AppShell user={{ displayName: profile.displayName, handle: profile.handle, isAdmin: user.role === "admin" }} streak={streak.current} level={streak.level.level}>
      {children}
    </AppShell>
  );
}
