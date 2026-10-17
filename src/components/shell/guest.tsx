"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, UserRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button } from "../ui/primitives";

/** Persistent reminder that this is a guest session, with the path to keep the progress. */
export function GuestBanner() {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
      <UserRound className="size-4 shrink-0 text-accent" aria-hidden />
      <p className="flex-1">
        <strong>Guest mode.</strong> Your progress is saved on our server for this browser and deleted after 30 days of inactivity. Community, challenges and private uploads need an account.
      </p>
      <Link href="/register" className="rounded-xl bg-accent px-3 py-1.5 font-semibold text-accent-fg">
        Save my progress
      </Link>
      <Link href="/login" className="font-medium text-accent">
        Log in
      </Link>
    </div>
  );
}

interface Summary {
  workouts: number;
  activities: number;
  checkIns: number;
  skills: number;
  foods: number;
  favorites: number;
  sports: number;
}

/** After signing in from a guest session: ask before importing anything. */
export function GuestImportPrompt() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    api<{ pending: boolean; summary?: Summary }>("/api/auth/import-guest")
      .then((r) => r.pending && r.summary && setSummary(r.summary))
      .catch(() => undefined);
  }, []);
  if (result) return <p className="mb-4 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">{result}</p>;
  if (!summary) return null;
  const parts = [
    [summary.workouts, "workouts"],
    [summary.activities, "activities"],
    [summary.checkIns, "check-ins"],
    [summary.skills, "skill progress entries"],
    [summary.foods, "food entries"],
    [summary.sports, "sports"],
    [summary.favorites, "favourites"],
  ].filter(([n]) => (n as number) > 0);
  async function decide(action: "import" | "discard") {
    setBusy(true);
    try {
      const r = await api<{ moved: Record<string, number>; skipped?: Record<string, number> }>("/api/auth/import-guest", { body: { action } });
      const skipped = Object.values(r.skipped ?? {}).reduce((a, b) => a + b, 0);
      setResult(action === "import" ? `Guest progress imported.${skipped ? ` ${skipped} item(s) that conflicted with your account (e.g. a check-in on the same day) were kept from your account instead.` : ""}` : "Okay — the guest data was not imported.");
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not import");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="region" aria-label="Import guest progress" className="mb-4 rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Download className="size-4 text-accent" /> Import your guest progress?
      </p>
      <p className="mt-1 text-muted">
        Before signing in you used a guest session on this browser with {parts.map(([n, l]) => `${n} ${l}`).join(", ")}. Import it into this account? Nothing in your account will be overwritten; conflicting items are skipped.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => decide("import")} loading={busy}>
          Import
        </Button>
        <Button size="sm" variant="ghost" onClick={() => decide("discard")} disabled={busy}>
          Don&apos;t import
        </Button>
      </div>
    </div>
  );
}
