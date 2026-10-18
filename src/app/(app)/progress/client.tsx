"use client";

import { Camera, Columns2, Lock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, attempt } from "@/lib/client/api";
import { inToCm, lbToKg } from "@/lib/format";
import { Button, Chip, Field, Input, Notice, Select, Toggle, cx } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";

const today = () => new Date().toLocaleDateString("en-CA");

export function ExercisePicker({ options, value, range }: { options: { slug: string; name: string }[]; value: string; range: string }) {
  const router = useRouter();
  return (
    <Select aria-label="Exercise" className="h-9 w-48 text-sm" value={value} onChange={(e) => router.push(`/progress?range=${range}${e.target.value ? `&exercise=${e.target.value}` : ""}`)}>
      <option value="">Choose exercise…</option>
      {options.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
    </Select>
  );
}

export function MeasurementForm({ units }: { units: "metric" | "imperial" }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ dateKey: today(), weight: "", waist: "", chest: "", arm: "", thigh: "", notes: "", milestone: "" });
  const [busy, setBusy] = useState(false);
  const w = (s: string) => (s ? (units === "imperial" ? lbToKg(Number(s)) : Number(s)) : null);
  const l = (s: string) => (s ? (units === "imperial" ? inToCm(Number(s)) : Number(s)) : null);
  const r = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
  async function save() {
    setBusy(true);
    try {
      await api("/api/progress/measurements", { body: { dateKey: v.dateKey, weightKg: r(w(v.weight)), waistCm: r(l(v.waist)), chestCm: r(l(v.chest)), armCm: r(l(v.arm)), thighCm: r(l(v.thigh)), notes: v.notes || null, milestone: v.milestone || null } });
      toast("Measurement saved");
      setV({ ...v, weight: "", waist: "", chest: "", arm: "", thigh: "", notes: "", milestone: "" });
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  const lu = units === "imperial" ? "in" : "cm";
  const num = (k: keyof typeof v, label: string) => (
    <Field label={label} htmlFor={`m-${k}`} optional>
      <Input id={`m-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "") })} />
    </Field>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Date" htmlFor="m-date"><Input id="m-date" type="date" value={v.dateKey} max={today()} onChange={(e) => setV({ ...v, dateKey: e.target.value })} /></Field>
        {num("weight", `Weight (${units === "imperial" ? "lb" : "kg"})`)}
        {num("waist", `Waist (${lu})`)}
        {num("chest", `Chest (${lu})`)}
        {num("arm", `Arm (${lu})`)}
        {num("thigh", `Leg/thigh (${lu})`)}
      </div>
      <Field label="Milestone or observation" htmlFor="m-ms" optional><Input id="m-ms" value={v.milestone} onChange={(e) => setV({ ...v, milestone: e.target.value })} maxLength={120} placeholder="e.g. First pull-up week" /></Field>
      <Button onClick={save} loading={busy} disabled={!v.weight && !v.waist && !v.chest && !v.arm && !v.thigh && !v.milestone}>Save measurement</Button>
    </div>
  );
}

export function DeleteMeasurement({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <button aria-label="Delete measurement" className="text-muted hover:text-danger" onClick={async () => { if (await attempt(api(`/api/progress/measurements/${id}`, { method: "DELETE" }), toast)) router.refresh(); }}>
      <Trash2 className="size-3.5" />
    </button>
  );
}

interface Photo { id: string; pose: string | null; dateKey: string | null }

export function PhotoJournal({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pose, setPose] = useState("front");
  const [dateKey, setDateKey] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(false);
  const dates = useMemo(() => [...new Set(photos.map((p) => p.dateKey).filter(Boolean) as string[])].sort(), [photos]);
  const [a, setA] = useState(dates[0] ?? "");
  const [b, setB] = useState(dates[dates.length - 1] ?? "");
  const [comparePose, setComparePose] = useState("front");

  async function upload() {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("pose", pose);
    form.set("dateKey", dateKey);
    form.set("consent", String(consent));
    try {
      await api("/api/progress/photos", { form });
      toast("Photo saved privately");
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this photo permanently?")) return;
    if (!(await attempt(api(`/api/media/${id}`, { method: "DELETE" }), toast))) return;
    router.refresh();
  }
  const pick = (d: string) => photos.find((p) => p.dateKey === d && p.pose === comparePose);

  return (
    <div className="space-y-4">
      <Notice tone="info" icon={<Lock className="size-4 text-info" />}>
        Photos are stored privately, visible only to you, never shared or used for rankings. You can delete them any time.
      </Notice>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)} icon={<Camera className="size-4" />}>Add photo</Button>
        {dates.length > 1 && <Button variant="outline" onClick={() => setCompare(!compare)} icon={<Columns2 className="size-4" />}>{compare ? "Gallery" : "Compare dates"}</Button>}
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">No photos yet. Front, side and back photos in similar lighting make comparisons easier.</p>
      ) : compare ? (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {["front", "side", "back"].map((p) => <Chip key={p} selected={comparePose === p} onClick={() => setComparePose(p)}>{p}</Chip>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[{ v: a, set: setA }, { v: b, set: setB }].map((s, i) => {
              const ph = pick(s.v);
              return (
                <div key={i}>
                  <Select aria-label={`Compare date ${i + 1}`} value={s.v} onChange={(e) => s.set(e.target.value)} className="mb-2 h-9 text-sm">
                    {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                  {ph ? <img src={`/api/media/${ph.id}`} alt={`${comparePose} photo on ${s.v}`} className="aspect-[3/4] w-full rounded-xl object-cover" /> : <div className="grid aspect-[3/4] place-items-center rounded-xl bg-surface-2 text-xs text-subtle">No {comparePose} photo</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              <img src={`/api/media/${p.id}`} alt={`${p.pose} progress photo ${p.dateKey}`} loading="lazy" className="aspect-[3/4] w-full rounded-xl object-cover" />
              <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{p.dateKey} · {p.pose}</span>
              <button onClick={() => remove(p.id)} aria-label="Delete photo" className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Add progress photo">
        <div className="space-y-3">
          <div className="flex gap-2">{["front", "side", "back"].map((p) => <Chip key={p} selected={pose === p} onClick={() => setPose(p)}>{p}</Chip>)}</div>
          <Field label="Date" htmlFor="ph-date"><Input id="ph-date" type="date" value={dateKey} max={today()} onChange={(e) => setDateKey(e.target.value)} /></Field>
          <label className={cx("flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-4 text-sm")}>
            <Camera className="size-4" /> {file ? file.name : "Choose a photo (JPEG, PNG or WebP, max 8 MB)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Toggle checked={consent} onChange={setConsent} label="I consent to storing this photo privately" description="Only you can view it. Delete it any time." />
          <Button className="w-full" onClick={upload} loading={busy} disabled={!file || !consent}>Upload privately</Button>
        </div>
      </Sheet>
    </div>
  );
}
