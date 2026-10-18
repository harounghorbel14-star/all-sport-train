"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { readIndex, type SavedItem } from "@/lib/client/pwa";

export function OfflineList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setItems(readIndex());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <div className="mt-4 space-y-4 text-sm">
      {!online && (
        <p className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3">
          <WifiOff className="size-4" /> You&apos;re offline. Saved lessons and plans still open; logging, the AI coach and live data need a connection. Sets you log during a live workout are queued and synced when you&apos;re back online.
        </p>
      )}
      <h2 className="font-semibold">Saved on this device</h2>
      {items.length === 0 ? (
        <p className="text-muted">Nothing saved yet. Use “Save for offline” on a lesson or workout plan while you&apos;re online.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {items.map((i) => (
            <li key={i.url}>
              <a href={i.url} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                <span>{i.title}</span>
                <span className="text-xs text-subtle">{i.kind}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {online && (
        <a href="/today" className="inline-block rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg">
          Back to the app
        </a>
      )}
    </div>
  );
}
