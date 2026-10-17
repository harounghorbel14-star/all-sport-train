"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ChevronLeft, ChevronRight, Flame, Minus, Pause, Play, Plus, Repeat, SkipForward, Timer, Trophy, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GeneratedWorkout } from "@/lib/engine/types";
import type { ExerciseLookup } from "@/lib/services/views";
import { api, ApiError } from "@/lib/client/api";
import { formatDuration, kcalRange } from "@/lib/format";
import { useI18n } from "@/components/providers";
import { Badge, Button, Card, Chip, Notice, Textarea, cx } from "@/components/ui/primitives";
import { ProgressRing } from "@/components/ui/charts";
import { Sheet, useToast } from "@/components/ui/overlay";
import { Burst, CelebrationCard } from "@/components/ui/celebration";

interface SetRec {
  blockIndex: number;
  setNumber: number;
  reps: number | null;
  seconds: number | null;
  loadKg: number | null;
  rpe: number | null;
  skipped: boolean;
}

interface Summary {
  durationSeconds: number;
  setsCompleted: number;
  setsSkipped: number;
  totalReps: number;
  totalSeconds: number;
  volumeKg: number;
  kcal: { low: number; high: number; assumedMass: boolean; method: string };
  prs: { exercise: string; metric: string; value: number }[];
  achievements: { key: string; title: string; description: string; xp: number }[];
}

type Phase = "warmup" | "main" | "done";

export function LiveWorkout({
  session,
  initialSets,
  workout: initialWorkout,
  lookup,
  units,
}: {
  session: { id: string; status: string; startedAt: string; pausedAt: string | null; pausedSeconds: number; currentIndex: number; planId: string | null };
  initialSets: SetRec[];
  workout: GeneratedWorkout;
  lookup: ExerciseLookup;
  units: "metric" | "imperial";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const storageKey = `apex-live-${session.id}`;

  const [workout, setWorkout] = useState(initialWorkout);
  const [sets, setSets] = useState<SetRec[]>(initialSets);
  const [index, setIndex] = useState(session.currentIndex);
  const [paused, setPaused] = useState(session.status === "paused");
  const [pausedAt, setPausedAt] = useState<number | null>(session.pausedAt ? Date.parse(session.pausedAt) : null);
  const [pausedSeconds, setPausedSeconds] = useState(session.pausedSeconds);
  const [phase, setPhase] = useState<Phase>(initialSets.length || initialWorkout.warmup.length === 0 ? "main" : "warmup");
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [reps, setReps] = useState(10);
  const [load, setLoad] = useState<string>("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [hold, setHold] = useState<{ startedAt: number } | null>(null);
  const [pending, setPending] = useState<SetRec[]>([]);
  const [offline, setOffline] = useState(false);
  const [pr, setPr] = useState<string | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subOptions, setSubOptions] = useState<{ slug: string; name: string; difficulty: number }[] | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finalRpe, setFinalRpe] = useState(6);
  const [notes, setNotes] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(session.status === "completed" ? null : null);
  const [shared, setShared] = useState(false);

  const block = workout.main[index];
  const info = block ? lookup[block.exercise] : undefined;
  const setsFor = useCallback((bi: number) => sets.filter((s) => s.blockIndex === bi), [sets]);
  const doneSets = block ? setsFor(index).length : 0;
  const setNumber = Math.min(doneSets + 1, block?.sets ?? 1);
  const blockDone = block ? doneSets >= block.sets : false;
  const totalSets = workout.main.reduce((s, b) => s + b.sets, 0);
  const progress = Math.min(1, sets.length / Math.max(1, totalSets));

  // Restore local state (phase, pending offline sets) after a refresh.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved?.phase) setPhase(saved.phase);
      if (Array.isArray(saved?.pending) && saved.pending.length) {
        setPending(saved.pending);
        setSets((cur) => {
          const merged = [...cur];
          for (const p of saved.pending as SetRec[]) if (!merged.some((m) => m.blockIndex === p.blockIndex && m.setNumber === p.setNumber)) merged.push(p);
          return merged;
        });
      }
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ phase, pending, index }));
    } catch {
      /* ignore */
    }
  }, [storageKey, phase, pending, index]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Default the rep input to the target / last logged value.
  useEffect(() => {
    if (!block) return;
    const last = setsFor(index).at(-1);
    setReps(last?.reps ?? block.repMax ?? block.repMin ?? 10);
    setRpe(null);
    setHold(null);
  }, [index, block, setsFor]);

  const elapsed = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000) - pausedSeconds - (paused && pausedAt ? Math.floor((now - pausedAt) / 1000) : 0));
  const restLeft = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;
  const holdSeconds = hold ? Math.floor((now - hold.startedAt) / 1000) : 0;

  useEffect(() => {
    if (rest && restLeft === 0) {
      setRest(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
    }
  }, [rest, restLeft]);

  // Retry queued sets when back online.
  const flush = useCallback(async () => {
    if (!pending.length) return;
    const remaining: SetRec[] = [];
    for (const p of pending) {
      try {
        await api(`/api/sessions/${session.id}/sets`, { body: p });
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) remaining.push(p);
      }
    }
    setPending(remaining);
    setOffline(remaining.length > 0);
  }, [pending, session.id]);

  useEffect(() => {
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  async function patch(body: object) {
    try {
      await api(`/api/sessions/${session.id}`, { method: "PATCH", body });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) toast(e instanceof Error ? e.message : "Could not update", "error");
    }
  }

  async function togglePause() {
    if (paused) {
      if (pausedAt) setPausedSeconds((s) => s + Math.round((Date.now() - pausedAt) / 1000));
      setPaused(false);
      setPausedAt(null);
      await patch({ action: "resume" });
    } else {
      setPaused(true);
      setPausedAt(Date.now());
      setRest(null);
      await patch({ action: "pause" });
    }
  }

  function goTo(i: number) {
    if (i < 0 || i >= workout.main.length) return;
    setIndex(i);
    setRest(null);
    patch({ action: "goto", index: i });
  }

  async function logSet(skipped = false) {
    if (!block || paused) return;
    const rec: SetRec = {
      blockIndex: index,
      setNumber,
      reps: skipped || block.seconds ? null : reps,
      seconds: skipped ? null : block.seconds ? Math.max(1, holdSeconds || block.seconds) : null,
      loadKg: !skipped && load ? (units === "imperial" ? Number(load) / 2.20462 : Number(load)) : null,
      rpe: skipped ? null : rpe,
      skipped,
    };
    setSets((cur) => [...cur.filter((s) => !(s.blockIndex === rec.blockIndex && s.setNumber === rec.setNumber)), rec]);
    setHold(null);
    try {
      const r = await api<{ prs: { metric: string; value: number }[] }>(`/api/sessions/${session.id}/sets`, { body: rec });
      setOffline(false);
      if (r.prs.length) {
        setPr(`${info?.name}: ${r.prs[0].value}${r.prs[0].metric === "seconds" ? "s" : r.prs[0].metric === "loadKg" ? " kg" : " reps"}`);
        setTimeout(() => setPr(null), 3500);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setPending((p) => [...p, rec]);
        setOffline(true);
      } else {
        setSets((cur) => cur.filter((s) => !(s.blockIndex === rec.blockIndex && s.setNumber === rec.setNumber)));
        toast(e instanceof Error ? e.message : "Could not save set", "error");
        return;
      }
    }
    const finishedBlock = setNumber >= block.sets;
    if (finishedBlock) {
      const nextOpen = workout.main.findIndex((b, i) => i > index && setsFor(i).length < b.sets);
      if (nextOpen >= 0) setTimeout(() => goTo(nextOpen), 400);
    }
    if (!skipped && block.restSeconds > 0 && !(finishedBlock && index === workout.main.length - 1)) {
      setRest({ until: Date.now() + block.restSeconds * 1000, total: block.restSeconds });
    }
  }

  async function openSubstitutes() {
    setSubOpen(true);
    setSubOptions(null);
    try {
      const r = await api<{ options: { slug: string; name: string; difficulty: number }[] }>(`/api/exercises/${block.exercise}/substitutes`);
      setSubOptions(r.options);
    } catch {
      setSubOptions([]);
    }
  }

  async function substitute(slug: string) {
    try {
      const r = await api<{ session: { content: string } }>(`/api/sessions/${session.id}`, { method: "PATCH", body: { action: "substitute", blockIndex: index, exercise: slug } });
      setWorkout(JSON.parse(r.session.content));
      setSets((cur) => cur.filter((s) => s.blockIndex !== index));
      setSubOpen(false);
      toast("Exercise swapped");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not swap", "error");
    }
  }

  async function finish() {
    setFinishing(true);
    await flush();
    try {
      const r = await api<{ summary: Summary }>(`/api/sessions/${session.id}/complete`, { body: { rpe: finalRpe, notes: notes || undefined } });
      setSummary(r.summary);
      setFinishOpen(false);
      setPhase("done");
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not finish", "error");
    } finally {
      setFinishing(false);
    }
  }

  async function endWithoutSaving() {
    if (!confirm("End this workout without saving it? Logged sets will be discarded from your history.")) return;
    await api(`/api/sessions/${session.id}`, { method: "DELETE" }).catch(() => undefined);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    router.push("/today");
    router.refresh();
  }

  async function share() {
    try {
      await api("/api/community/posts", { body: { kind: "workout", refId: session.id, visibility: "friends", body: `Finished ${workout.title} — ${summary?.setsCompleted} sets in ${formatDuration(summary?.durationSeconds ?? 0)}.` } });
      setShared(true);
      toast("Shared with friends");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not share", "error");
    }
  }

  const upNext = useMemo(() => workout.main.map((b, i) => ({ b, i })).filter(({ i }) => i !== index), [workout.main, index]);

  // ── Summary screen ─────────────────────────────────────────────────
  if (summary) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative text-center">
          <Burst show />
          <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-accent text-accent-fg">
            <Trophy className="size-10" />
          </div>
          <h1 className="num mt-4 text-5xl font-bold uppercase">{t.workout.summary}</h1>
          <p className="mt-1 text-muted">{workout.title}</p>
        </motion.div>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-subtle">Duration</p>
            <p className="num text-3xl font-bold">{formatDuration(summary.durationSeconds)}</p>
          </Card>
          <Card>
            <p className="text-xs text-subtle">Sets</p>
            <p className="num text-3xl font-bold">
              {summary.setsCompleted}
              {summary.setsSkipped > 0 && <span className="text-base text-subtle"> +{summary.setsSkipped} skipped</span>}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-subtle">Total reps</p>
            <p className="num text-3xl font-bold">{summary.totalReps}</p>
          </Card>
          <Card>
            <p className="text-xs text-subtle">Est. energy</p>
            <p className="num text-3xl font-bold">{kcalRange(summary.kcal.low, summary.kcal.high)}</p>
            <p className="text-[10px] text-subtle">kcal · estimate{summary.kcal.assumedMass ? ", body mass assumed" : ""}</p>
          </Card>
        </div>
        <div className="mt-4 space-y-3">
          {summary.prs.map((p) => (
            <CelebrationCard key={p.exercise + p.metric} icon={<Flame className="size-5" />} title={`${t.workout.newPr} ${p.exercise}`} body={`${p.value}${p.metric === "seconds" ? " s" : p.metric === "loadKg" ? " kg" : " reps"}`} />
          ))}
          {summary.achievements.map((a) => (
            <CelebrationCard key={a.key} icon={<Trophy className="size-5" />} title={a.title} body={`${a.description} +${a.xp} XP`} />
          ))}
        </div>
        <p className="mt-4 text-xs text-subtle">Energy is estimated from exercise intensity (MET), duration and body mass. Real values vary by ±20% or more.</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={() => router.push("/today")}>
            {t.common.done}
          </Button>
          <Button variant="outline" onClick={share} disabled={shared}>
            {shared ? "Shared" : "Share with friends"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Warm-up ────────────────────────────────────────────────────────
  if (phase === "warmup") {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <TopBar title={workout.title} elapsed={elapsed} progress={0} onClose={() => router.push(session.planId ? `/workout/${session.planId}` : "/today")} />
        <h1 className="num mt-6 text-4xl font-bold uppercase">{t.workout.warmup}</h1>
        <p className="text-sm text-muted">Easy, controlled movement to prepare your joints. About {Math.round(workout.warmup.reduce((s, b) => s + (b.seconds ?? 45), 0) / 60)} minutes.</p>
        <ul className="mt-5 space-y-2">
          {workout.warmup.map((b) => (
            <li key={b.exercise}>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{lookup[b.exercise]?.name}</p>
                  <Badge>{b.seconds}s</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{lookup[b.exercise]?.steps[0]}</p>
              </Card>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-2">
          <Button size="xl" onClick={() => setPhase("main")} icon={<Check className="size-5" />}>
            Warm-up done
          </Button>
          <Button variant="ghost" onClick={() => setPhase("main")}>
            Skip warm-up
          </Button>
        </div>
      </div>
    );
  }

  const ex = info;
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-6 pt-4">
      <TopBar title={workout.title} elapsed={elapsed} progress={progress} onClose={() => router.push(session.planId ? `/workout/${session.planId}` : "/today")} />

      {offline && (
        <div className="mt-3">
          <Notice tone="warn" icon={<WifiOff className="size-4" />}>
            Offline — {pending.length} set(s) saved on this device and will sync when you reconnect.
          </Notice>
        </div>
      )}

      <AnimatePresence>
        {pr && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="relative mt-3">
            <CelebrationCard icon={<Flame className="size-5" />} title={t.workout.newPr} body={pr} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button onClick={() => goTo(index - 1)} disabled={index === 0} className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30" aria-label="Previous exercise">
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">
          Exercise {index + 1} of {workout.main.length}
        </p>
        <button onClick={() => goTo(index + 1)} disabled={index === workout.main.length - 1} className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30" aria-label="Next exercise">
          <ChevronRight className="size-5 rtl:rotate-180" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={`${index}-${block?.exercise}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="mt-3 flex-1" aria-live="polite">
          <h1 className="num text-5xl font-bold uppercase leading-[0.95] sm:text-6xl">{ex?.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              Set {setNumber} of {block.sets}
            </Badge>
            <Badge>{block.seconds ? `${block.seconds}s hold` : `${block.repMin}–${block.repMax} reps`}</Badge>
            {block.note && <span className="text-xs text-muted">{block.note}</span>}
          </div>

          {/* Set dots */}
          <div className="mt-4 flex gap-2" aria-label={`${doneSets} of ${block.sets} sets done`}>
            {Array.from({ length: block.sets }, (_, i) => {
              const rec = setsFor(index).find((s) => s.setNumber === i + 1);
              return (
                <motion.div key={i} layout className={cx("h-2 flex-1 rounded-full", rec ? (rec.skipped ? "bg-subtle" : "bg-accent") : "bg-surface-3")} initial={false} animate={{ scaleY: rec ? 1 : 0.8 }} />
              );
            })}
          </div>

          {rest ? (
            <div className="mt-8 flex flex-col items-center">
              <ProgressRing value={restLeft / rest.total} size={220} stroke={14} label={`Rest ${restLeft} seconds`}>
                <div>
                  <p className="text-xs uppercase tracking-wider text-subtle">{t.workout.rest}</p>
                  <p className="num text-7xl font-bold">{formatDuration(restLeft)}</p>
                </div>
              </ProgressRing>
              <div className="mt-5 flex gap-2">
                <Button variant="secondary" onClick={() => setRest((r) => (r ? { ...r, until: r.until + 15_000, total: r.total + 15 } : r))}>
                  +15s
                </Button>
                <Button onClick={() => setRest(null)} icon={<SkipForward className="size-4" />}>
                  Skip rest
                </Button>
              </div>
              {!blockDone && <p className="mt-4 text-sm text-muted">Next: set {setNumber} of {ex?.name}</p>}
            </div>
          ) : blockDone ? (
            <div className="mt-10 text-center">
              <p className="num text-3xl font-bold uppercase text-accent">Exercise complete</p>
              {index < workout.main.length - 1 ? (
                <Button className="mt-4" size="lg" onClick={() => goTo(index + 1)}>
                  Next exercise <ChevronRight className="size-4 rtl:rotate-180" />
                </Button>
              ) : (
                <Button className="mt-4" size="lg" onClick={() => setFinishOpen(true)}>
                  {t.workout.finish}
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-8">
              {block.seconds ? (
                <div className="flex flex-col items-center">
                  <ProgressRing value={hold ? Math.min(1, holdSeconds / block.seconds) : 0} size={200} stroke={12} label={`Hold ${holdSeconds} of ${block.seconds} seconds`}>
                    <div>
                      <p className="num text-7xl font-bold">{hold ? holdSeconds : block.seconds}</p>
                      <p className="text-xs text-subtle">seconds</p>
                    </div>
                  </ProgressRing>
                  <div className="mt-5 flex gap-2">
                    {!hold ? (
                      <Button size="lg" variant="secondary" onClick={() => setHold({ startedAt: Date.now() })} icon={<Timer className="size-4" />} disabled={paused}>
                        Start timer
                      </Button>
                    ) : (
                      <Button size="lg" variant="secondary" onClick={() => setHold(null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-6">
                  <button onClick={() => setReps((r) => Math.max(0, r - 1))} className="grid size-16 place-items-center rounded-full bg-surface-2 active:scale-95" aria-label="Fewer reps">
                    <Minus className="size-6" />
                  </button>
                  <div className="text-center">
                    <motion.p key={reps} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="num w-28 text-8xl font-bold leading-none" aria-live="polite">
                      {reps}
                    </motion.p>
                    <p className="text-xs uppercase tracking-wider text-subtle">{t.workout.reps}</p>
                  </div>
                  <button onClick={() => setReps((r) => Math.min(500, r + 1))} className="grid size-16 place-items-center rounded-full bg-surface-2 active:scale-95" aria-label="More reps">
                    <Plus className="size-6" />
                  </button>
                </div>
              )}
              <div className="mx-auto mt-6 max-w-sm space-y-3">
                <div>
                  <p className="mb-1.5 text-center text-xs text-subtle">Effort (RPE, optional)</p>
                  <div className="flex justify-center gap-1">
                    {[5, 6, 7, 8, 9, 10].map((n) => (
                      <Chip key={n} selected={rpe === n} onClick={() => setRpe(rpe === n ? null : n)} className="px-3 py-1.5">
                        {n}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-1 text-center text-[10px] text-subtle">7 ≈ 3 reps left in the tank · 10 = nothing left</p>
                </div>
                {ex?.equipment.some((e) => ["dumbbells", "barbell", "kettlebell", "cable_machine"].includes(e)) && (
                  <label className="flex items-center justify-center gap-2 text-sm text-muted">
                    Load ({units === "imperial" ? "lb" : "kg"})
                    <input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value.replace(/[^\d.]/g, ""))} className="h-10 w-24 rounded-xl border border-line bg-surface-2 px-3 text-center text-fg" />
                  </label>
                )}
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      {/* Controls */}
      {!rest && !blockDone && (
        <div className="sticky bottom-0 mt-6 space-y-2 bg-gradient-to-t from-bg via-bg pb-[env(safe-area-inset-bottom)] pt-4">
          <Button size="xl" className="w-full" onClick={() => logSet(false)} disabled={paused} icon={<Check className="size-6" />}>
            {t.workout.logSet}
          </Button>
          <div className="grid grid-cols-4 gap-2">
            <Button variant="secondary" onClick={togglePause} icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />} aria-label={paused ? t.workout.resume : t.workout.pause}>
              <span className="hidden sm:inline">{paused ? t.workout.resume : t.workout.pause}</span>
            </Button>
            <Button variant="secondary" onClick={() => logSet(true)} disabled={paused} icon={<SkipForward className="size-4" />} aria-label={t.workout.skipSet}>
              <span className="hidden sm:inline">{t.workout.skipSet}</span>
            </Button>
            <Button variant="secondary" onClick={openSubstitutes} icon={<Repeat className="size-4" />} aria-label={t.workout.replace}>
              <span className="hidden sm:inline">{t.workout.replace}</span>
            </Button>
            <Button variant="secondary" onClick={() => setTechOpen(true)} icon={<BookOpen className="size-4" />} aria-label="Technique">
              <span className="hidden sm:inline">Technique</span>
            </Button>
          </div>
        </div>
      )}
      {paused && <p className="mt-3 text-center text-sm text-warn">Paused — timer stopped.</p>}

      {/* Up next */}
      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Workout</p>
        <ul className="space-y-1.5">
          {upNext.map(({ b, i }) => {
            const done = setsFor(i).length >= b.sets;
            return (
              <li key={`${b.exercise}-${i}`}>
                <button onClick={() => goTo(i)} className={cx("flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-start text-sm", done ? "opacity-50" : "bg-surface")}>
                  <span className="flex items-center gap-2">
                    {done ? <Check className="size-4 text-accent" /> : <span className="num w-4 text-subtle">{i + 1}</span>}
                    {lookup[b.exercise]?.name}
                  </span>
                  <span className="text-xs text-subtle">
                    {setsFor(i).length}/{b.sets}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 grid gap-2">
          <Button variant="outline" onClick={() => setFinishOpen(true)} disabled={!sets.some((s) => !s.skipped)}>
            {t.workout.finish}
          </Button>
          <button onClick={endWithoutSaving} className="text-xs text-subtle underline">
            {t.workout.endWorkout}
          </button>
        </div>
      </div>

      <Sheet open={techOpen} onClose={() => setTechOpen(false)} title={ex?.name ?? "Technique"}>
        {ex && (
          <div className="space-y-4 text-sm">
            <ol className="list-decimal space-y-1.5 ps-5">
              {ex.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p>
              <span className="font-semibold">Breathing:</span> <span className="text-muted">{ex.breathing}</span>
            </p>
            <div>
              <p className="font-semibold">Common mistakes</p>
              <ul className="mt-1 space-y-1 text-muted">
                {ex.mistakes.map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
            </div>
            {ex.safety.length > 0 && <Notice tone="warn">{ex.safety.join(" ")}</Notice>}
            <Link href={`/exercises/${block.exercise}`} className="text-accent" target="_blank">
              Full tutorial →
            </Link>
          </div>
        )}
      </Sheet>

      <Sheet open={subOpen} onClose={() => setSubOpen(false)} title="Swap exercise">
        {!subOptions ? (
          <p className="text-sm text-muted">{t.common.loading}</p>
        ) : subOptions.length === 0 ? (
          <p className="text-sm text-muted">No suitable alternatives for your equipment and limitations.</p>
        ) : (
          <ul className="space-y-2">
            {subOptions.map((o) => (
              <li key={o.slug}>
                <button onClick={() => substitute(o.slug)} className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 p-3 text-start hover:border-accent">
                  <span className="font-medium">{o.name}</span>
                  <Badge>Level {o.difficulty}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        {doneSets > 0 && <p className="mt-3 text-xs text-warn">Swapping clears the sets already logged for this exercise.</p>}
      </Sheet>

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title={t.workout.finish}>
        <div className="space-y-4">
          {workout.cooldown.length > 0 && (
            <div>
              <p className="text-sm font-semibold">{t.workout.cooldown} (recommended)</p>
              <p className="text-xs text-muted">{workout.cooldown.map((b) => lookup[b.exercise]?.name).join(" · ")}</p>
            </div>
          )}
          <label className="block">
            <span className="mb-1 flex justify-between text-sm font-medium">
              {t.workout.howHard} <span className="num text-xl">{finalRpe}/10</span>
            </span>
            <input type="range" min={1} max={10} value={finalRpe} onChange={(e) => setFinalRpe(Number(e.target.value))} className="w-full" />
            <span className="flex justify-between text-[10px] text-subtle">
              <span>Very easy</span>
              <span>Maximal</span>
            </span>
          </label>
          <Textarea placeholder={`${t.workout.notes} (optional)`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} aria-label={t.workout.notes} />
          {sets.length < totalSets && <p className="text-xs text-muted">Unlogged sets will be recorded as not done — that&apos;s completely fine.</p>}
          <Button size="lg" className="w-full" onClick={finish} loading={finishing}>
            Save workout
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function TopBar({ title, elapsed, progress, onClose }: { title: string; elapsed: number; progress: number; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-surface-2" aria-label="Leave live mode (workout keeps running)">
          <X className="size-5" />
        </button>
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="num rounded-full bg-surface-2 px-3 py-1 text-xl font-bold tabular-nums" aria-label="Elapsed time" suppressHydrationWarning>
          {formatDuration(elapsed)}
        </p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
        <motion.div className="h-full bg-accent" animate={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
