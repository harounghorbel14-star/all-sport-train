"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { EMPHASIS_LABELS, GOAL_LABELS } from "@/lib/labels";
import { Button, Chip, Notice, Textarea, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function WeeklyReviewForm() {
  const router = useRouter();
  const toast = useToast();
  const [feeling, setFeeling] = useState(3);
  const [difficulty, setDifficulty] = useState<"too_easy" | "right" | "too_hard">("right");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  async function submit() {
    setSaving(true);
    try {
      const r = await api<{ adjustment: { message: string } }>("/api/roadmap/review", { body: { feeling, difficulty, notes: notes || undefined } });
      setResult(r.adjustment.message);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  if (result) return <Notice tone="accent">{result}</Notice>;
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How did you feel overall?</legend>
        <div className="flex gap-2">
          {["😫", "😕", "😐", "🙂", "💪"].map((e, i) => (
            <button key={e} type="button" onClick={() => setFeeling(i + 1)} aria-pressed={feeling === i + 1} aria-label={`Feeling ${i + 1} of 5`} className={cx("grid size-12 place-items-center rounded-xl text-2xl transition-transform", feeling === i + 1 ? "scale-110 bg-accent-soft ring-2 ring-accent" : "bg-surface-2")}>
              {e}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">The training was…</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["too_easy", "Too easy"],
              ["right", "About right"],
              ["too_hard", "Too hard"],
            ] as const
          ).map(([k, l]) => (
            <Chip key={k} selected={difficulty === k} onClick={() => setDifficulty(k)}>
              {l}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} aria-label="Review notes" />
      <Button onClick={submit} loading={saving}>
        Submit review
      </Button>
    </div>
  );
}

export function ProgramBuilder({ current }: { current: { emphasis: string; daysPerWeek: number; sessionMinutes: number; goals: string[] } }) {
  const router = useRouter();
  const toast = useToast();
  const [emphasis, setEmphasis] = useState(current.emphasis);
  const [days, setDays] = useState(current.daysPerWeek);
  const [minutes, setMinutes] = useState(current.sessionMinutes);
  const [goals, setGoals] = useState(current.goals);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { emphasis, daysPerWeek: days, sessionMinutes: minutes, goals } });
      await api("/api/workouts/today", { body: {} });
      toast("Program updated — today's session was rebuilt");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(EMPHASIS_LABELS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setEmphasis(k)} aria-pressed={emphasis === k} className={cx("rounded-xl border p-2.5 text-start text-sm transition-colors", emphasis === k ? "border-accent bg-accent-soft" : "border-line bg-surface-2")}>
            <span className="font-semibold">{v.label}</span>
            <span className="block text-[11px] text-muted">{v.body}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(GOAL_LABELS).map(([k, v]) => (
          <Chip key={k} className="px-2.5 py-1 text-xs" selected={goals.includes(k)} onClick={() => setGoals((g) => (g.includes(k) ? (g.length > 1 ? g.filter((x) => x !== k) : g) : [...g, k]))}>
            {v}
          </Chip>
        ))}
      </div>
      <label className="block text-sm">
        Days per week: <span className="num text-lg">{days}</span>
        <input type="range" min={1} max={7} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full" />
      </label>
      <label className="block text-sm">
        Session length: <span className="num text-lg">{minutes} min</span>
        <input type="range" min={10} max={90} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full" />
      </label>
      <p className="text-xs text-subtle">The V-Taper and physique emphases prioritise proportions through training balance. No exercise changes bone structure or guarantees a waist size.</p>
      <Button onClick={save} loading={saving}>
        Update program
      </Button>
    </div>
  );
}
