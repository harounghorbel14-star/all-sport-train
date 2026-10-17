"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button, Card, CardTitle, Field, Input, Segmented, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { MetricInputs, metricInput } from "../../sports/[slug]/client";

type MetricDef = Parameters<typeof MetricInputs>[0]["m"];
type Raw = { value: string; made: string; attempts: string };

export function CompletePractice({ id, sportSlug, minutes, metrics }: { id: string; sportSlug: string; minutes: number; metrics: MetricDef[] }) {
  const router = useRouter();
  const toast = useToast();
  const [duration, setDuration] = useState(String(minutes));
  const [intensity, setIntensity] = useState<"light" | "moderate" | "vigorous">("moderate");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [raw, setRaw] = useState<Record<string, Raw>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const results = [];
    for (const m of metrics) {
      const r = raw[m.key];
      if (!r || (!r.value && !r.made && !r.attempts)) continue; // optional
      const input = metricInput(m, r);
      if (typeof input === "string") return toast(`${m.label}: ${input}`, "error");
      results.push({ metricKey: m.key, ...input, context: "drill" });
    }
    const d = Number(duration);
    if (!Number.isFinite(d) || d < 1) return toast("Enter how long you trained", "error");
    setBusy(true);
    try {
      const r = await api<{ results: { personalBest: boolean }[]; kcal: { low: number; high: number } }>(`/api/practice/${id}/complete`, {
        body: { durationMin: d, intensity, rpe: rpe ? Number(rpe) : undefined, notes: notes || undefined, results },
      });
      const pbs = r.results.filter((x) => x.personalBest).length;
      toast(`Practice logged (est. ${r.kcal.low}–${r.kcal.high} kcal)${pbs ? ` · ${pbs} personal best${pbs > 1 ? "s" : ""}!` : ""}`);
      router.push(`/sports/${sportSlug}?tab=progress`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Complete practice</CardTitle>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Field label="Duration (min)" htmlFor="pc-duration">
            <Input id="pc-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label="Effort (RPE 1–10)" htmlFor="pc-rpe" optional>
            <Input id="pc-rpe" type="number" min={1} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </Field>
        </div>
        <Segmented
          label="Intensity"
          value={intensity}
          onChange={setIntensity}
          options={[
            { value: "light", label: "Light" },
            { value: "moderate", label: "Moderate" },
            { value: "vigorous", label: "Vigorous" },
          ]}
        />
        {metrics.length > 0 && (
          <div className="space-y-3 rounded-xl border border-line p-3">
            <p className="text-sm font-semibold">Drill results (optional)</p>
            {metrics.map((m) => (
              <div key={m.key}>
                <p className="text-sm">{m.label}</p>
                {m.measurement && <p className="text-xs text-subtle">{m.measurement}</p>}
                <MetricInputs m={m} raw={raw[m.key] ?? { value: "", made: "", attempts: "" }} setRaw={(r) => setRaw({ ...raw, [m.key]: r })} idPrefix={`pc-${m.key}`} />
              </div>
            ))}
          </div>
        )}
        <Field label="Notes" htmlFor="pc-notes" optional>
          <Textarea id="pc-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-xs text-subtle">Saves an activity entry (energy is an estimate) and any results you entered.</p>
        <Button type="submit" loading={busy}>
          Complete &amp; log
        </Button>
      </form>
    </Card>
  );
}
