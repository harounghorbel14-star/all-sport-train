"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { fmt } from "@/lib/i18n";
import { EQUIPMENT_LABELS } from "@/lib/exercise-labels";
import { Button, Field, Input, Notice, Select } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";

function useRun() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run<T>(path: string, init: { method?: string; body?: unknown }, done?: (r: T) => string) {
    setBusy(true);
    try {
      const r = await api<T>(path, init);
      if (done) toast(done(r));
      router.refresh();
      return r;
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run, t };
}

export function AddTrip({ today, usualMinutes, equipment }: { today: string; usualMinutes: number; equipment: string[] }) {
  const { busy, run, t } = useRun();
  const tv = t.travel;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ startDate: today, endDate: today, location: "mixed", equipment: [] as string[], minutes: "", note: "" });
  async function save() {
    const r = await run("/api/travel", { body: { startDate: v.startDate, endDate: v.endDate, location: v.location, equipment: v.equipment, ...(v.minutes ? { sessionMinutes: Number(v.minutes) } : {}), ...(v.note.trim() ? { note: v.note.trim() } : {}) } }, () => tv.saved);
    if (r) setOpen(false);
  }
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Plane className="size-3.5" />} onClick={() => setOpen(true)}>
        {tv.add}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tv.add}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={tv.start} htmlFor="trip-start">
              <Input id="trip-start" type="date" min={today} value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value, endDate: e.target.value > v.endDate ? e.target.value : v.endDate })} />
            </Field>
            <Field label={tv.end} htmlFor="trip-end">
              <Input id="trip-end" type="date" min={v.startDate} value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label={tv.place} htmlFor="trip-place">
            <Select id="trip-place" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })}>
              <option value="home">{tv.placeHome}</option>
              <option value="gym">{tv.placeGym}</option>
              <option value="outdoor">{tv.placeOutdoor}</option>
              <option value="mixed">{tv.placeMixed}</option>
            </Select>
          </Field>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">{tv.equipment}</legend>
            <div className="grid grid-cols-2 gap-1">
              {equipment.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={v.equipment.includes(e)} onChange={(ev) => setV({ ...v, equipment: ev.target.checked ? [...v.equipment, e] : v.equipment.filter((x) => x !== e) })} />
                  {EQUIPMENT_LABELS[e] ?? e}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={tv.minutes} hint={fmt(tv.minutesHint, { minutes: usualMinutes })} htmlFor="trip-minutes">
            <Input id="trip-minutes" type="number" min={10} max={usualMinutes} value={v.minutes} onChange={(e) => setV({ ...v, minutes: e.target.value })} />
          </Field>
          <Field label={tv.note} htmlFor="trip-note">
            <Input id="trip-note" maxLength={200} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </Field>
          <Button className="w-full" loading={busy} onClick={save}>
            {tv.save}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

type Change = { planId: string; dateKey: string; current: string; change: "adapt" | "keep"; proposed?: { title: string; minutes: number } };

export function TripActions({ id, label }: { id: string; label: string }) {
  const { busy, run, t } = useRun();
  const tv = t.travel;
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  async function review() {
    const r = await run<{ changes: Change[] }>(`/api/travel/${id}`, {});
    if (r) {
      setChanges(r.changes);
      setPicked(r.changes.filter((c) => c.change === "adapt").map((c) => c.planId));
    }
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="ghost" loading={busy && !changes} onClick={review}>
        {tv.review}
      </Button>
      <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} aria-label={`${tv.cancel}: ${label}`} onClick={() => confirm(tv.cancelConfirm) && run<{ restored: number }>(`/api/travel/${id}`, { body: { action: "cancel" } }, (r) => fmt(tv.cancelled, { n: r.restored }))}>
        {tv.cancel}
      </Button>
      <Sheet open={!!changes} onClose={() => setChanges(null)} title={tv.reviewTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted">{tv.reviewIntro}</p>
          {changes?.length === 0 && <Notice>{tv.nothingToChange}</Notice>}
          <ul className="space-y-2">
            {changes?.map((c) => (
              <li key={c.planId} className="rounded-lg border border-line p-2">
                {c.change === "adapt" ? (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={picked.includes(c.planId)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.planId] : picked.filter((x) => x !== c.planId))} />
                    <span>
                      <span className="block font-medium">{c.dateKey} · {c.current}</span>
                      {c.proposed && <span className="text-xs text-muted">{fmt(tv.proposed, { title: c.proposed.title, minutes: c.proposed.minutes })}</span>}
                    </span>
                  </label>
                ) : (
                  <>
                    <span className="block font-medium">{c.dateKey} · {c.current}</span>
                    <span className="text-xs text-muted">{tv.keepReason}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          {!!changes?.some((c) => c.change === "adapt") && (
            <Button
              className="w-full"
              loading={busy}
              disabled={!picked.length}
              onClick={async () => {
                const r = await run<{ adapted: unknown[] }>(`/api/travel/${id}`, { body: { action: "apply", planIds: picked } }, (x) => fmt(tv.applied, { n: x.adapted.length }));
                if (r) setChanges(null);
              }}
            >
              {tv.apply}
            </Button>
          )}
        </div>
      </Sheet>
    </span>
  );
}
