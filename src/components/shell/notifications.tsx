"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/client/api";
import { EmptyState, ErrorState, Skeleton } from "../ui/primitives";

interface Item {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPanel({ onRead, onNavigate }: { onRead: () => void; onNavigate: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Item[] }>("/api/notifications")
      .then((r) => {
        setItems(r.items);
        if (r.items.some((i) => !i.readAt)) api("/api/notifications", { method: "PATCH", body: {} }).then(onRead).catch(() => undefined);
      })
      .catch((e) => setError(e.message));
  }, [onRead]);

  if (error) return <ErrorState message={error} />;
  if (!items) return <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  if (!items.length) return <EmptyState icon={<Bell className="size-5" />} title="You're all caught up" body="Milestones, reminders you enable and weekly reviews will appear here." />;
  return (
    <ul className="space-y-2">
      {items.map((n) => {
        const inner = (
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <div className="flex items-start gap-2">
              {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs text-muted">{n.body}</p>
                <p className="mt-1 text-[10px] text-subtle">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
        return <li key={n.id}>{n.href ? <Link href={n.href} onClick={onNavigate}>{inner}</Link> : inner}</li>;
      })}
    </ul>
  );
}
