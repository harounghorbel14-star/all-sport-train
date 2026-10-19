"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Field, Input } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";
import { fmt } from "@/lib/i18n";

type Result = { warnings?: string[] };

function useAction() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function run(path: string, init: { method?: string; body: unknown }, done: string) {
    setBusy(true);
    try {
      const r = await api<Result>(path, init);
      toast(done);
      for (const w of r.warnings ?? []) toast(w, "error");
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : t.calendar.couldNotSave, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run, tc: t.calendar };
}

export function RestorePlanButton({ planId }: { planId: string }) {
  const { busy, run, tc } = useAction();
  return (
    <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} loading={busy} onClick={() => run(`/api/plans/${planId}`, { method: "PATCH", body: { action: "restore" } }, tc.restored)}>
      {tc.restore}
    </Button>
  );
}

/** Reschedule / cancel / restore for one scheduled workout. */
export function PlanCalendarActions({ planId, dateKey, status, today, title }: { planId: string; dateKey: string; status: string; today: string; title: string }) {
  const { busy, run, tc } = useAction();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dateKey < today ? today : dateKey);
  if (status === "completed" || status === "started") return null;
  if (status === "cancelled") return <RestorePlanButton planId={planId} />;
  return (
    <span className="flex items-center gap-1">
      <button aria-label={fmt(tc.rescheduleOn, { title, date: dateKey })} className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent" onClick={() => setOpen(true)}>
        <CalendarClock className="size-4" />
      </button>
      <button
        aria-label={fmt(tc.cancelOn, { title, date: dateKey })}
        className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"
        disabled={busy}
        onClick={() => confirm(fmt(tc.cancelConfirm, { title })) && run(`/api/plans/${planId}`, { method: "PATCH", body: { action: "cancel" } }, tc.cancelled)}
      >
        <X className="size-4" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={fmt(tc.rescheduleTitle, { title })}>
        <div className="space-y-4">
          <Field label={tc.newDate} htmlFor={`resched-${planId}`}>
            <Input id={`resched-${planId}`} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Button className="w-full" loading={busy} onClick={async () => (await run(`/api/plans/${planId}`, { method: "PATCH", body: { action: "reschedule", dateKey: date } }, tc.moved)) && setOpen(false)}>
            {tc.move}
          </Button>
        </div>
      </Sheet>
    </span>
  );
}

export function ScheduleWorkoutButton({ dateKey, label }: { dateKey: string; label: string }) {
  const { busy, run, tc } = useAction();
  return (
    <button
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-50"
      disabled={busy}
      onClick={() => run("/api/calendar", { body: { dateKey } }, tc.scheduled)}
    >
      <CalendarPlus className="size-3.5" /> {tc.schedule}
    </button>
  );
}
