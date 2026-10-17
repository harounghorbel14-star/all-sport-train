"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Pause, Play, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MobilityRoutine } from "@/lib/content/mobility";
import { api } from "@/lib/client/api";
import { formatDuration } from "@/lib/format";
import { Badge, Button, Card, Chip, Notice, cx } from "@/components/ui/primitives";
import { ProgressRing } from "@/components/ui/charts";
import { Sheet, useToast } from "@/components/ui/overlay";
import { CelebrationCard } from "@/components/ui/celebration";

export function MobilityRoutines({ today, routines, lookup, doneToday }: { today: string; routines: MobilityRoutine[]; lookup: Record<string, { name: string; steps: string[] }>; doneToday: string[] }) {
  const [active, setActive] = useState<MobilityRoutine | null>(null);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {routines.map((r) => (
          <button key={r.slug} onClick={() => setActive(r)} className="text-start">
            <Card interactive className="h-full">
              <div className="flex items-center justify-between">
                <Badge tone="info"><Clock className="size-3" /> {r.minutes} min</Badge>
                {doneToday.includes(r.slug) && <Check className="size-4 text-accent" aria-label="Done today" />}
              </div>
              <p className="mt-2 font-semibold">{r.name}</p>
              <p className="text-xs text-muted">{r.description}</p>
            </Card>
          </button>
        ))}
      </div>
      <Sheet open={!!active} onClose={() => setActive(null)} title={active?.name ?? ""} wide>
        {active && <RoutinePlayer routine={active} lookup={lookup} today={today} onDone={() => setActive(null)} />}
      </Sheet>
    </>
  );
}

function RoutinePlayer({ routine, lookup, today, onDone }: { routine: MobilityRoutine; lookup: Record<string, { name: string; steps: string[] }>; today: string; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(routine.items[0].seconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const item = routine.items[i];

  useEffect(() => {
    if (!running || finished) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [running, finished]);

  useEffect(() => {
    if (left > 0) return;
    if (i < routine.items.length - 1) {
      setI(i + 1);
      setLeft(routine.items[i + 1].seconds);
    } else {
      setRunning(false);
      setFinished(true);
    }
  }, [left, i, routine.items]);

  async function complete() {
    try {
      await api("/api/recovery/mobility", { body: { routine: routine.slug, dateKey: today } });
      toast("Mobility session logged");
      router.refresh();
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log", "error");
    }
  }

  if (finished)
    return (
      <div className="space-y-4">
        <CelebrationCard icon={<Check className="size-5" />} title="Routine complete" body={`${routine.minutes} minutes of quality movement.`} />
        <Button className="w-full" onClick={complete}>Log session</Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{routine.focus}</p>
      <div className="flex flex-col items-center">
        <ProgressRing value={1 - left / item.seconds} size={160} label={`${left} seconds left`}>
          <p className="num text-5xl font-bold">{formatDuration(left)}</p>
        </ProgressRing>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-center">
            <p className="num text-3xl font-bold uppercase">{lookup[item.exercise]?.name}</p>
            {item.note && <p className="text-xs text-accent">{item.note}</p>}
            <ol className="mx-auto mt-2 max-w-md space-y-1 text-start text-sm text-muted">
              {lookup[item.exercise]?.steps.map((s, k) => <li key={k}>{k + 1}. {s}</li>)}
            </ol>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-2">
        <Button size="lg" onClick={() => setRunning(!running)} icon={running ? <Pause className="size-4" /> : <Play className="size-4" />}>{running ? "Pause" : "Start"}</Button>
        <Button size="lg" variant="secondary" onClick={() => setLeft(0)} icon={<SkipForward className="size-4" />}>Next</Button>
      </div>
      <p className="text-center text-xs text-subtle">Step {i + 1} of {routine.items.length}</p>
      <div className="flex justify-center"><button className="text-xs text-muted underline" onClick={complete}>I did this routine — log it</button></div>
      {routine.modifications.length > 0 && <Notice tone="info"><span className="text-xs">Modifications: {routine.modifications.join(" ")}</span></Notice>}
    </div>
  );
}

export function PostureCheck({ questions, routines }: { questions: { key: string; q: string; tip: string; routine: string }[]; routines: Record<string, string> }) {
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const flagged = questions.filter((q) => answers[q.key]);
  const answered = Object.keys(answers).length === questions.length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">A quick awareness check — not a medical assessment or diagnosis. Posture exercises can improve comfort, mobility and strength; they don&apos;t change skeletal height or fix every structural difference.</p>
      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
            <span className="text-sm">{q.q}</span>
            <span className="flex gap-2">
              <Chip selected={answers[q.key] === true} onClick={() => setAnswers({ ...answers, [q.key]: true })}>Yes</Chip>
              <Chip selected={answers[q.key] === false} onClick={() => setAnswers({ ...answers, [q.key]: false })}>No</Chip>
            </span>
          </li>
        ))}
      </ul>
      {answered && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cx("rounded-xl border p-4", flagged.length ? "border-info/30 bg-info/10" : "border-accent/30 bg-accent-soft")}>
          {flagged.length === 0 ? (
            <p className="text-sm">Nothing flagged. Keep moving regularly and include upper-back work alongside pushing.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {flagged.map((q) => (
                <li key={q.key}>
                  {q.tip} <span className="text-accent">Try: {routines[q.routine]}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-subtle">Persistent pain, numbness or significant asymmetry deserve a check with a physiotherapist or doctor.</p>
        </motion.div>
      )}
    </div>
  );
}
