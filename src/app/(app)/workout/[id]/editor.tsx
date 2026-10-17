"use client";

import { Plus, Repeat, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Block, GeneratedWorkout } from "@/lib/engine/types";
import type { ExerciseLookup } from "@/lib/services/views";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/content/exercises";
import { api } from "@/lib/client/api";
import { useI18n } from "@/components/providers";
import { Badge, Button, Card, Input, Notice, PageHeader } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";
import { BlockRow, MoveButtons } from "@/components/workout/block-list";
import { StartWorkoutButton } from "../../today/widgets";

type Section = "warmup" | "main" | "cooldown";

export function PlanEditor({ planId, status, initial, lookup, activeSessionId, otherActive }: { planId: string; status: string; initial: GeneratedWorkout; lookup: ExerciseLookup; activeSessionId: string | null; otherActive: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [w, setW] = useState<GeneratedWorkout>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replace, setReplace] = useState<{ section: Section; index: number } | null>(null);
  const [options, setOptions] = useState<{ slug: string; name: string; difficulty: number; equipment: string[] }[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const editable = status !== "completed" && !activeSessionId;

  const update = (fn: (draft: GeneratedWorkout) => void) => {
    setW((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ workout: GeneratedWorkout }>(`/api/plans/${planId}`, { method: "PUT", body: { workout: w } });
      setW(r.workout);
      setDirty(false);
      toast("Workout saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function openReplace(section: Section, index: number) {
    setReplace({ section, index });
    setOptions(null);
    try {
      const r = await api<{ options: typeof options }>(`/api/exercises/${w[section][index].exercise}/substitutes`);
      setOptions(r.options);
    } catch {
      setOptions([]);
    }
  }

  function applyReplace(slug: string) {
    if (!replace) return;
    const info = lookup[slug];
    update((d) => {
      const b = d[replace.section][replace.index];
      b.exercise = slug;
      b.progression = "new";
      b.note = undefined;
      if (info?.isTimed) {
        b.seconds = b.seconds ?? info.holdSeconds ?? 30;
        b.repMin = null;
        b.repMax = null;
      } else {
        b.seconds = null;
        b.repMin = b.repMin ?? info?.repMin ?? 8;
        b.repMax = b.repMax ?? info?.repMax ?? 12;
      }
    });
    setReplace(null);
  }

  function addExercise(slug: string) {
    const info = lookup[slug];
    update((d) => {
      d.main.push({ exercise: slug, sets: 3, repMin: info?.isTimed ? null : (info?.repMin ?? 8), repMax: info?.isTimed ? null : (info?.repMax ?? 12), seconds: info?.isTimed ? (info.holdSeconds ?? 30) : null, restSeconds: 90, progression: "new" });
    });
    setAdding(false);
  }

  const move = (section: Section, i: number, dir: -1 | 1) =>
    update((d) => {
      const arr = d[section];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });

  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));

  const editRow = (section: Section, b: Block, i: number) => (
    <li key={`${section}-${i}-${b.exercise}`} className="py-3">
      <div className="flex items-start gap-2">
        {editable && <MoveButtons onUp={() => move(section, i, -1)} onDown={() => move(section, i, 1)} disableUp={i === 0} disableDown={i === w[section].length - 1} />}
        <div className="min-w-0 flex-1">
          <BlockRow block={b} info={lookup[b.exercise]} compact={section !== "main"} />
          {editable && section === "main" && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted">
                {t.workout.sets}
                <Input type="number" min={1} max={10} value={b.sets} onChange={(e) => update((d) => (d.main[i].sets = num(e.target.value, 1, 10)))} className="h-8 w-16 px-2" />
              </label>
              {b.seconds != null ? (
                <label className="flex items-center gap-1 text-xs text-muted">
                  {t.workout.hold} (s)
                  <Input type="number" min={5} max={600} value={b.seconds} onChange={(e) => update((d) => (d.main[i].seconds = num(e.target.value, 5, 600)))} className="h-8 w-20 px-2" />
                </label>
              ) : (
                <label className="flex items-center gap-1 text-xs text-muted">
                  {t.workout.reps}
                  <Input type="number" min={1} max={100} value={b.repMin ?? 8} onChange={(e) => update((d) => (d.main[i].repMin = num(e.target.value, 1, 100)))} className="h-8 w-16 px-2" aria-label="Minimum reps" />–
                  <Input type="number" min={1} max={100} value={b.repMax ?? 12} onChange={(e) => update((d) => (d.main[i].repMax = num(e.target.value, 1, 100)))} className="h-8 w-16 px-2" aria-label="Maximum reps" />
                </label>
              )}
              <label className="flex items-center gap-1 text-xs text-muted">
                {t.workout.rest} (s)
                <Input type="number" min={0} max={600} value={b.restSeconds} onChange={(e) => update((d) => (d.main[i].restSeconds = num(e.target.value, 0, 600)))} className="h-8 w-20 px-2" />
              </label>
              <Button size="sm" variant="secondary" onClick={() => openReplace(section, i)} icon={<Repeat className="size-3.5" />}>
                {t.workout.replace}
              </Button>
              {w.main.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => update((d) => d.main.splice(i, 1))} aria-label={`${t.workout.remove} ${lookup[b.exercise]?.name}`} icon={<Trash2 className="size-3.5" />} />
              )}
            </div>
          )}
          {section === "main" && (b.easier || b.harder) && (
            <p className="mt-1 text-xs text-subtle">
              {b.easier && (
                <>
                  {t.workout.easier}: <Link className="text-muted underline" href={`/exercises/${b.easier}`}>{lookup[b.easier]?.name}</Link>
                </>
              )}
              {b.easier && b.harder && " · "}
              {b.harder && (
                <>
                  {t.workout.harder}: <Link className="text-muted underline" href={`/exercises/${b.harder}`}>{lookup[b.harder]?.name}</Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </li>
  );

  const equipment = [...new Set(w.main.flatMap((b) => lookup[b.exercise]?.equipment ?? []))];
  const muscles = [...new Set(w.main.flatMap((b) => lookup[b.exercise]?.primaryMuscles ?? []))];
  const matches = query.length > 1 ? Object.entries(lookup).filter(([, v]) => v.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={status === "completed" ? "Completed" : "Workout plan"}
        title={w.title}
        subtitle={`~${w.estimatedMinutes} min · ${w.main.length} exercises`}
        action={
          <div className="flex flex-wrap gap-2">
            {editable && dirty && (
              <Button onClick={save} loading={saving} variant="outline" icon={<Save className="size-4" />}>
                {t.common.save}
              </Button>
            )}
            {status !== "completed" && !otherActive && !dirty && <StartWorkoutButton planId={planId} activeSessionId={activeSessionId} />}
          </div>
        }
      />
      {otherActive && <Notice tone="warn">You have another workout in progress. Finish or end it before starting this one.</Notice>}
      {dirty && <Notice tone="info">You have unsaved changes. Save before starting.</Notice>}
      <div className="flex flex-wrap gap-2">
        {muscles.slice(0, 8).map((m) => (
          <Badge key={m}>{MUSCLE_LABELS[m] ?? m}</Badge>
        ))}
        <Badge tone="info">{equipment.length ? equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ") : "No equipment"}</Badge>
      </div>
      {w.notes.length > 0 && (
        <Card className="space-y-1 text-sm text-muted">
          {w.notes.map((n) => (
            <p key={n}>• {n}</p>
          ))}
        </Card>
      )}
      {(["warmup", "main", "cooldown"] as Section[]).map(
        (section) =>
          w[section].length > 0 && (
            <Card key={section}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{t.workout[section]}</h2>
              <ul className="divide-y divide-line">{w[section].map((b, i) => editRow(section, b, i))}</ul>
              {section === "main" && editable && (
                <Button variant="ghost" size="sm" onClick={() => setAdding(true)} icon={<Plus className="size-4" />}>
                  Add exercise
                </Button>
              )}
            </Card>
          ),
      )}

      <Sheet open={!!replace} onClose={() => setReplace(null)} title="Replace exercise">
        {!options ? (
          <p className="text-sm text-muted">{t.common.loading}</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted">No suitable alternatives for your equipment and limitations.</p>
        ) : (
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={o.slug}>
                <button onClick={() => applyReplace(o.slug)} className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 p-3 text-start hover:border-accent">
                  <span className="font-medium">{o.name}</span>
                  <Badge>Level {o.difficulty}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add exercise">
        <Input placeholder="Search exercises…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search exercises" />
        <ul className="mt-3 space-y-2">
          {matches.map(([slug, v]) => (
            <li key={slug}>
              <button onClick={() => addExercise(slug)} className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 p-3 text-start hover:border-accent">
                <span className="font-medium">{v.name}</span>
                <span className="text-xs text-subtle">{v.equipment.length ? v.equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ") : "Bodyweight"}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle">Tip: you can only start exercises you have equipment for — check the equipment badge.</p>
      </Sheet>
    </div>
  );
}
