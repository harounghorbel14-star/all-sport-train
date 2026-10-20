"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { fmt } from "@/lib/i18n";
import { formatDateKey } from "@/lib/format";
import { Button, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";
import type { CatchUpNote } from "@/lib/services/calendar";

export interface CatchUp {
  missed: { dateKey: string; kind: "plan" | "training_day"; title: string | null }[];
  proposal: { dateKey: string; lighter: boolean }[];
  notes: CatchUpNote[];
}

/** Missed sessions and an optional, cautious catch-up proposal. Nothing is added until the user chooses. */
export function CatchUpPanel({ data }: { data: CatchUp }) {
  const { t, locale } = useI18n();
  const tc = t.catchUp;
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>(data.proposal.map((p) => p.dateKey));
  const [busy, setBusy] = useState(false);
  if (!data.missed.length) return null;
  const day = (k: string) => formatDateKey(k, locale, { weekday: "short", day: "numeric", month: "short" });
  const note = (n: CatchUpNote) =>
    n.code === "week_full" ? fmt(tc.weekFull, { planned: n.planned, target: n.target }) : n.code === "no_free_day" ? tc.noFreeDay : n.code === "check_in_rest" ? tc.checkInRest : n.code === "after_break" ? tc.afterBreak : n.code === "lighter_after_misses" ? fmt(tc.lighterAfterMisses, { count: n.count }) : null;
  async function apply() {
    setBusy(true);
    try {
      await api("/api/calendar/catch-up", { body: { dateKeys: picked } });
      toast(tc.applied);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="catch-up-title" className="mb-4 rounded-xl border border-line bg-surface-2 p-3 text-sm">
      <h3 id="catch-up-title" className="font-semibold">{tc.title}</h3>
      <p className="mt-1 text-xs text-muted">{tc.missed}:</p>
      <ul className="mt-1 list-disc ps-5 text-xs text-muted">
        {data.missed.map((m, i) => (
          <li key={i}>{m.kind === "plan" ? fmt(tc.missedPlan, { title: m.title ?? "", date: day(m.dateKey) }) : fmt(tc.missedDay, { date: day(m.dateKey) })}</li>
        ))}
      </ul>
      {data.notes.map((n, i) => note(n) && <p key={i} className="mt-2 text-xs">{note(n)}</p>)}
      {data.proposal.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold">{tc.proposal}</p>
          {data.proposal.map((p) => (
            <label key={p.dateKey} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" checked={picked.includes(p.dateKey)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.dateKey] : picked.filter((x) => x !== p.dateKey))} />
              {day(p.dateKey)}
              {p.lighter && <span className="text-xs text-subtle">· {tc.lighter}</span>}
            </label>
          ))}
          <Notice>{tc.note}</Notice>
          <Button size="sm" loading={busy} disabled={!picked.length} onClick={apply}>
            {tc.apply}
          </Button>
        </div>
      )}
    </section>
  );
}
