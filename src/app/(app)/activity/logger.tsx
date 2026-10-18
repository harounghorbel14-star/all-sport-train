"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, attempt } from "@/lib/client/api";
import { kcalRange, miToKm } from "@/lib/format";
import { Button, Chip, Field, Input, Notice, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

interface SportField { key: string; label: string; kind: string; unit: string | null; options: string[] }
interface SportOpt { slug: string; name: string; distance: "km" | "m" | null; fields: SportField[] }

export function ActivityLogger({ today, units, initialSport, sports }: { today: string; units: "metric" | "imperial"; initialSport: string; sports: SportOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sport, setSport] = useState(initialSport);
  const [dateKey, setDateKey] = useState(today);
  const [duration, setDuration] = useState("30");
  const [intensity, setIntensity] = useState<"light" | "moderate" | "vigorous">("moderate");
  const [distance, setDistance] = useState("");
  const [rpe, setRpe] = useState("");
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const def = sports.find((s) => s.slug === sport)!;

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      let distanceKm: number | undefined;
      if (def.distance && distance) {
        const v = Number(distance);
        distanceKm = def.distance === "m" ? v / 1000 : units === "imperial" ? miToKm(v) : v;
      }
      const m: Record<string, string | number> = {};
      for (const f of def.fields) {
        const v = metrics[f.key];
        if (v === undefined || v === "") continue;
        m[f.key] = f.kind === "number" ? Number(v) : v;
      }
      const r = await api<{ estimate: { low: number; high: number; basis: string } }>("/api/activity", {
        body: { sport, dateKey, durationMin: Number(duration), intensity, distanceKm, rpe: rpe ? Number(rpe) : undefined, metrics: m, notes: notes || undefined },
      });
      setResult(`Logged · estimated ${kcalRange(r.estimate.low, r.estimate.high)} kcal (${r.estimate.basis === "pace" ? "from your pace" : "from intensity"})`);
      setMetrics({});
      setDistance("");
      setNotes("");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Sport" htmlFor="sport">
        <Select id="sport" value={sport} onChange={(e) => { setSport(e.target.value); setMetrics({}); }}>
          {sports.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="adate"><Input id="adate" type="date" max={today} value={dateKey} onChange={(e) => setDateKey(e.target.value)} /></Field>
        <Field label="Duration (min)" htmlFor="adur"><Input id="adur" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} /></Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Intensity</p>
        <div className="flex gap-2">
          {(["light", "moderate", "vigorous"] as const).map((i) => <Chip key={i} selected={intensity === i} onClick={() => setIntensity(i)}>{i[0].toUpperCase() + i.slice(1)}</Chip>)}
        </div>
      </div>
      {def.distance && (
        <Field label={`Distance (${def.distance === "m" ? "m" : units === "imperial" ? "mi" : "km"})`} htmlFor="adist" optional>
          <Input id="adist" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        {def.fields.map((f) => (
          <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ""}`} htmlFor={`f-${f.key}`} optional>
            {f.kind === "select" ? (
              <Select id={`f-${f.key}`} value={metrics[f.key] ?? ""} onChange={(e) => setMetrics({ ...metrics, [f.key]: e.target.value })}>
                <option value="">—</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            ) : (
              <Input id={`f-${f.key}`} inputMode={f.kind === "number" ? "decimal" : undefined} value={metrics[f.key] ?? ""} onChange={(e) => setMetrics({ ...metrics, [f.key]: f.kind === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value })} />
            )}
          </Field>
        ))}
        <Field label="Effort (RPE 1–10)" htmlFor="arpe" optional>
          <Input id="arpe" inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="anotes" optional><Input id="anotes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      <Button className="w-full" onClick={submit} loading={busy} disabled={!Number(duration)}>Log activity</Button>
      {result && <Notice tone="accent">{result}</Notice>}
    </div>
  );
}

export function DeleteActivity({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      aria-label="Delete activity"
      className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"
      onClick={async () => {
        if (!(await attempt(api(`/api/activity/${id}`, { method: "DELETE" }), toast))) return;
        router.refresh();
      }}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
