"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";

export function LandingGuest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ redirectTo: string }>("/api/auth/guest", { body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      router.push(r.redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a guest session");
      setBusy(false);
    }
  }
  return (
    <div className="mt-4">
      <button onClick={go} disabled={busy} className="text-sm font-semibold text-accent underline-offset-4 hover:underline disabled:opacity-50">
        {busy ? "Starting…" : "Try it first — continue as guest →"}
      </button>
      <p className="text-xs text-subtle">No sign-up. Explore the library, Academy, sports lessons and a sample plan; guest progress is kept for 30 days.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
