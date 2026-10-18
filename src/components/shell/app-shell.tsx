"use client";

import { motion } from "framer-motion";
import { Bell, Ellipsis, Flame, LogOut, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import { clearOfflineData } from "@/lib/client/pwa";
import { useI18n } from "../providers";
import { cx } from "../ui/primitives";
import { Sheet } from "../ui/overlay";
import { NAV } from "./nav";
import { NotificationsPanel } from "./notifications";
import { GuestBanner, GuestImportPrompt } from "./guest";

interface ShellProps {
  children: ReactNode;
  user: { displayName: string; handle: string; isAdmin: boolean; isGuest: boolean };
  streak: number;
  level: number;
}

export function AppShell({ children, user, streak, level }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api<{ unread: number }>("/api/notifications")
      .then((r) => setUnread(r.unread))
      .catch(() => undefined);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const primary = NAV.filter((n) => n.primary);

  async function logout() {
    if (user.isGuest && !confirm("Leave guest mode? Without an account, this guest progress can't be recovered after you leave.")) return;
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await clearOfflineData().catch(() => undefined); // saved pages may contain personal plans
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface/60 px-3 py-5 backdrop-blur lg:flex">
        <Link href="/today" className="mb-6 flex items-center gap-2 px-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent font-black text-accent-fg">A</span>
          <span className="num text-2xl font-bold tracking-wide">APEX FIT</span>
        </Link>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto scrollbar-none">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={cx(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(n.href) ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {isActive(n.href) && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-surface-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <n.icon className={cx("relative size-[18px]", isActive(n.href) && "text-accent")} aria-hidden />
              <span className="relative">{t.nav[n.key]}</span>
            </Link>
          ))}
          {user.isAdmin && (
            <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
              <Shield className="size-[18px]" aria-hidden /> {t.nav.admin}
            </Link>
          )}
        </nav>
        <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-3">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          <p className="truncate text-xs text-subtle">@{user.handle} · Lv {level}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-2 text-xs text-muted hover:text-fg">
            <LogOut className="size-3.5" /> {t.nav.logout}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:px-8">
          <Link href="/today" className="flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-black text-accent-fg">A</span>
            <span className="num text-xl font-bold">APEX FIT</span>
          </Link>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <Link href="/challenges" className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold" aria-label={`${streak} day streak`}>
              <Flame className={cx("size-4", streak > 0 ? "text-warn" : "text-subtle")} aria-hidden />
              <span className="num text-base">{streak}</span>
            </Link>
            <button onClick={() => setNotifOpen(true)} className="relative grid size-9 place-items-center rounded-full bg-surface-2" aria-label={`${t.nav.notifications}${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="size-4" />
              {unread > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">{unread}</span>}
            </button>
          </div>
        </header>

        <motion.main
            id="main"
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12"
          >
            {user.isGuest ? <GuestBanner /> : <GuestImportPrompt />}
            {children}
          </motion.main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", isActive(n.href) ? "text-accent" : "text-muted")}>
                {isActive(n.href) && <motion.span layoutId="tab-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                <n.icon className="size-5" aria-hidden />
                {t.nav[n.key]}
              </Link>
            </li>
          ))}
          <li>
            <button onClick={() => setMoreOpen(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted" aria-haspopup="dialog">
              <Ellipsis className="size-5" aria-hidden />
              {t.nav.more}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t.nav.more}>
        <div className="grid grid-cols-3 gap-2">
          {NAV.filter((n) => !n.primary).map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMoreOpen(false)} className={cx("flex flex-col items-center gap-2 rounded-2xl border border-line p-3 text-center text-xs font-medium", isActive(n.href) ? "border-accent text-accent" : "bg-surface-2")}>
              <n.icon className="size-5" aria-hidden />
              {t.nav[n.key]}
            </Link>
          ))}
          {user.isAdmin && (
            <Link href="/admin" onClick={() => setMoreOpen(false)} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2 p-3 text-xs font-medium">
              <Shield className="size-5" /> {t.nav.admin}
            </Link>
          )}
        </div>
        <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-3 text-sm text-muted">
          <LogOut className="size-4" /> {t.nav.logout}
        </button>
      </Sheet>

      <Sheet open={notifOpen} onClose={() => setNotifOpen(false)} title={t.nav.notifications}>
        <NotificationsPanel onRead={() => setUnread(0)} onNavigate={() => setNotifOpen(false)} />
      </Sheet>
    </div>
  );
}
