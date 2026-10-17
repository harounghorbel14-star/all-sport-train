"use client";

import { motion } from "framer-motion";
import { Check, Moon, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useI18n } from "@/components/providers";
import { Button, Chip, Notice, Toggle, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function StartWorkoutButton({ planId, activeSessionId, label }: { planId: string; activeSessionId?: string | null; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  async function start() {
    if (activeSessionId) return router.push(`/live/${activeSessionId}`);
    setLoading(true);
    try {
      const r = await api<{ session: { id: string } }>("/api/sessions", { body: { planId } });
      router.push(`/live/${r.session.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not start", "error");
      setLoading(false);
    }
  }
  return (
    <Button size="xl" onClick={start} loading={loading} icon={<Play className="size-5 fill-current" />} className="w-full sm:w-auto">
      {label ?? (activeSessionId ? t.today.resume : t.today.startWorkout)}
    </Button>
  );
}

export function RegenerateButtons() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function regen(key: string, body: object) {
    setBusy(key);
    try {
      await api("/api/workouts/today", { body });
      router.refresh();
      toast("Session updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update", "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {[15, 20, 30].map((m) => (
        <Chip key={m} onClick={() => regen(`m${m}`, { minutes: m })} disabled={!!busy}>
          {busy === `m${m}` ? "…" : `${m} min`}
        </Chip>
      ))}
      <Chip onClick={() => regen("new", {})} disabled={!!busy}>
        <RotateCcw className="size-3.5" /> Refresh
      </Chip>
    </div>
  );
}

const scale = [1, 2, 3, 4, 5];

export function CheckInCard({ dateKey, existing }: { dateKey: string; existing?: { energy: number; soreness: number; sleepHours: number | null; pain: boolean; isRestDay: boolean } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [sleep, setSleep] = useState(existing?.sleepHours ?? 7);
  const [energy, setEnergy] = useState(existing?.energy ?? 3);
  const [soreness, setSoreness] = useState(existing?.soreness ?? 2);
  const [pain, setPain] = useState(existing?.pain ?? false);
  const [rest, setRest] = useState(existing?.isRestDay ?? false);
  const [saving, setSaving] = useState(false);
  const [advice, setAdvice] = useState<{ title: string; body: string } | null>(null);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ advice: { title: string; body: string } }>("/api/recovery/checkin", { body: { dateKey, sleepHours: sleep, energy, soreness, pain, isRestDay: rest } });
      setAdvice(r.advice);
      await api("/api/workouts/today", { body: {} }).catch(() => undefined); // adapt today's session
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 flex justify-between text-xs font-medium text-muted">
          Sleep last night <span className="num text-base text-fg">{sleep}h</span>
        </span>
        <input type="range" min={3} max={11} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full" aria-label="Hours of sleep" />
      </label>
      <Scale value={energy} onChange={setEnergy} label="Energy" low="Drained" high="Great" />
      <Scale value={soreness} onChange={setSoreness} label="Soreness" low="None" high="Very sore" />
      <Toggle checked={pain} onChange={setPain} label="Something hurts (pain, not normal soreness)" />
      <Toggle checked={rest} onChange={setRest} label="Taking a rest day today" description="Rest days keep your streak alive." />
      <Button onClick={save} loading={saving} className="w-full" icon={existing ? <Check className="size-4" /> : <Moon className="size-4" />}>
        {existing ? "Update check-in" : "Save check-in"}
      </Button>
      {advice && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Notice tone={pain ? "warn" : "accent"}>
            <p className="font-semibold">{advice.title}</p>
            <p className="text-xs text-muted">{advice.body}</p>
          </Notice>
        </motion.div>
      )}
    </div>
  );
}

function Scale({ value, onChange, label, low, high }: { value: number; onChange: (v: number) => void; label: string; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-muted">{label}</legend>
      <div className="flex gap-1.5">
        {scale.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n} aria-label={`${label} ${n} of 5`} className={cx("num h-9 flex-1 rounded-lg text-base font-bold transition-colors", value === n ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted hover:text-fg")}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
