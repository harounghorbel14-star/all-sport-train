"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Plus, RotateCcw } from "lucide-react";
import { api } from "@/lib/client/api";
import { lbToKg } from "@/lib/format";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";

export interface GoalOptions {
  exercises: { slug: string; name: string }[];
  sports: { slug: string; name: string; metrics: { key: string; label: string; unit: string | null; kind: string; direction: string }[]; lessons: { slug: string; title: string; level: string }[] }[];
}

/** "25:30" / "1:05:00" / "95" → seconds. */
export function parseTime(s: string) {
  if (!s.includes(":")) return Number(s);
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((t, n) => t * 60 + n, 0);
}

type Kind = "exercise" | "sport_metric" | "consistency" | "lesson";

export function NewGoalButton({ options, units }: { options: GoalOptions; units: "metric" | "imperial" }) {
  const { t } = useI18n();
  const tg = t.goals;
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind>("exercise");
  const [v, setV] = useState({ exerciseSlug: options.exercises[0]?.slug ?? "", metric: "reps", sportSlug: options.sports[0]?.slug ?? "", metricKey: options.sports[0]?.metrics[0]?.key ?? "", lessonSlug: options.sports[0]?.lessons[0]?.slug ?? "", target: "", baseline: "", sessions: "3", weeks: "4", targetDate: "", title: "" });
  const sport = options.sports.find((s) => s.slug === v.sportSlug);
  const metric = sport?.metrics.find((m) => m.key === v.metricKey);
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch });
  const isTime = kind === "sport_metric" && metric?.kind === "time";
  const isLoad = kind === "exercise" && v.metric === "loadKg";
  const toStored = (s: string) => {
    const n = isTime ? parseTime(s) : Number(s);
    return isLoad && units === "imperial" ? Math.round(lbToKg(n) * 10) / 10 : n;
  };

  async function save() {
    const common = { ...(v.targetDate ? { targetDate: v.targetDate } : {}), ...(v.title.trim() ? { title: v.title.trim() } : {}) };
    let body: Record<string, unknown>;
    if (kind === "consistency") body = { kind, target: Number(v.sessions), periodWeeks: Number(v.weeks), ...common };
    else if (kind === "lesson") body = { kind, sportSlug: v.sportSlug, lessonSlug: v.lessonSlug, ...common };
    else {
      const target = toStored(v.target);
      const baseline = v.baseline.trim() ? toStored(v.baseline) : undefined;
      if (!Number.isFinite(target) || (baseline !== undefined && !Number.isFinite(baseline))) return toast(`${tg.target}: ${t.common.error}`, "error");
      body = kind === "exercise" ? { kind, exerciseSlug: v.exerciseSlug, metric: v.metric, target, baseline, ...common } : { kind, sportSlug: v.sportSlug, metricKey: v.metricKey, target, baseline, ...common };
    }
    setBusy(true);
    try {
      await api("/api/goals", { body });
      toast(tg.created);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
    } finally {
      setBusy(false);
    }
  }

  const unitLabel = kind === "exercise" ? (v.metric === "loadKg" ? (units === "imperial" ? "lb" : "kg") : v.metric === "seconds" ? "s" : tg.reps.toLowerCase()) : isTime ? "mm:ss" : metric?.unit ?? "";
  return (
    <>
      <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        {tg.add}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tg.add}>
        <div className="space-y-4">
          <Field label={tg.kind} htmlFor="goal-kind">
            <Select id="goal-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="exercise">{tg.kindExercise}</option>
              <option value="sport_metric" disabled={!options.sports.some((s) => s.metrics.length)}>{tg.kindSport}</option>
              <option value="consistency">{tg.kindConsistency}</option>
              <option value="lesson" disabled={!options.sports.some((s) => s.lessons.length)}>{tg.kindLesson}</option>
            </Select>
          </Field>
          {!options.sports.length && <p className="text-xs text-muted">{tg.noSports}</p>}
          {kind === "exercise" && (
            <>
              <Field label={tg.exercise} htmlFor="goal-ex">
                <Select id="goal-ex" value={v.exerciseSlug} onChange={(e) => set({ exerciseSlug: e.target.value })}>
                  {options.exercises.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
                </Select>
              </Field>
              <Field label={tg.measure} htmlFor="goal-metric">
                <Select id="goal-metric" value={v.metric} onChange={(e) => set({ metric: e.target.value })}>
                  <option value="reps">{tg.reps}</option>
                  <option value="seconds">{tg.seconds}</option>
                  <option value="loadKg">{tg.load}</option>
                </Select>
              </Field>
            </>
          )}
          {(kind === "sport_metric" || kind === "lesson") && (
            <Field label={tg.sport} htmlFor="goal-sport">
              <Select id="goal-sport" value={v.sportSlug} onChange={(e) => { const s = options.sports.find((x) => x.slug === e.target.value); set({ sportSlug: e.target.value, metricKey: s?.metrics[0]?.key ?? "", lessonSlug: s?.lessons[0]?.slug ?? "" }); }}>
                {options.sports.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          {kind === "sport_metric" && (
            <Field label={tg.result} htmlFor="goal-result">
              <Select id="goal-result" value={v.metricKey} onChange={(e) => set({ metricKey: e.target.value })}>
                {sport?.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ""}</option>)}
              </Select>
            </Field>
          )}
          {kind === "lesson" && (
            <Field label={tg.lesson} htmlFor="goal-lesson">
              <Select id="goal-lesson" value={v.lessonSlug} onChange={(e) => set({ lessonSlug: e.target.value })}>
                {sport?.lessons.map((l) => <option key={l.slug} value={l.slug}>{l.title}</option>)}
              </Select>
            </Field>
          )}
          {(kind === "exercise" || kind === "sport_metric") && (
            <>
              <Field label={`${tg.target} (${unitLabel})`} htmlFor="goal-target">
                <Input id="goal-target" inputMode={isTime ? "text" : "decimal"} placeholder={isTime ? "25:00" : undefined} value={v.target} onChange={(e) => set({ target: e.target.value })} />
              </Field>
              <Field label={`${tg.baseline} (${unitLabel})`} hint={tg.baselineHint} htmlFor="goal-baseline">
                <Input id="goal-baseline" inputMode={isTime ? "text" : "decimal"} value={v.baseline} onChange={(e) => set({ baseline: e.target.value })} />
              </Field>
            </>
          )}
          {kind === "consistency" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tg.sessionsPerWeek} htmlFor="goal-sessions">
                <Input id="goal-sessions" type="number" min={1} max={14} value={v.sessions} onChange={(e) => set({ sessions: e.target.value })} />
              </Field>
              <Field label={tg.weeksInRow} htmlFor="goal-weeks">
                <Input id="goal-weeks" type="number" min={1} max={26} value={v.weeks} onChange={(e) => set({ weeks: e.target.value })} />
              </Field>
            </div>
          )}
          <Field label={tg.targetDate} hint={tg.targetDateHint} htmlFor="goal-date">
            <Input id="goal-date" type="date" value={v.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
          </Field>
          <Field label={tg.name} htmlFor="goal-title">
            <Input id="goal-title" maxLength={80} value={v.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Button className="w-full" loading={busy} onClick={save}>
            {tg.create}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export function GoalStatusButton({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const tg = t.goals;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const abandon = status === "active";
  async function run() {
    if (abandon && !confirm(tg.abandonConfirm)) return;
    setBusy(true);
    try {
      await api(`/api/goals/${id}`, { method: "PATCH", body: { status: abandon ? "abandoned" : "active" } });
      toast(abandon ? tg.abandonedToast : tg.restoredToast);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="ghost" loading={busy} icon={abandon ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />} onClick={run}>
      {abandon ? tg.abandon : tg.restore}
    </Button>
  );
}

