import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Wind } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { getExercise, exerciseMap } from "@/lib/services/exercises";
import { AppError } from "@/lib/server/errors";
import { DIFFICULTY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "@/lib/content/exercises";
import { Badge, Card, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { ExerciseMedia } from "@/components/exercise-media";
import { FavoriteButton } from "./favorite";

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await requireUser();
  let data;
  try {
    data = await getExercise(slug, user.id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const map = await exerciseMap();
  const { exercise: e, favorite, records, recentSets } = data;
  const link = (s: string) =>
    map.has(s) ? (
      <Link key={s} href={`/exercises/${s}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm hover:text-accent">
        {map.get(s)!.name}
      </Link>
    ) : null;
  const target = e.isTimed ? `${e.defaultSets} × ${e.holdSeconds ?? 30}s` : `${e.defaultSets} × ${e.repMin}–${e.repMax}`;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${PATTERN_LABELS[e.movementPattern] ?? e.movementPattern} · ${DIFFICULTY_LABELS[e.difficulty]}`} title={e.name} subtitle={e.description} action={<FavoriteButton slug={e.slug} initial={favorite} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ExerciseMedia name={e.name} pattern={e.movementPattern} mediaUrl={e.mediaUrl} />
          {e.setup.length > 0 && (
            <Card>
              <CardTitle>Setup</CardTitle>
              <ul className="space-y-1.5 text-sm">
                {e.setup.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </Card>
          )}
          <Card>
            <CardTitle>Execution</CardTitle>
            <ol className="space-y-3">
              {e.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-bold text-accent">{i + 1}</span>
                  <span className="pt-1">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm">
              <Wind className="mt-0.5 size-4 shrink-0 text-info" /> <span><span className="font-semibold">Breathing:</span> {e.breathing}</span>
            </p>
            {e.cues.length > 0 && <p className="mt-3 text-sm text-muted">Cues: {e.cues.join(" · ")}</p>}
          </Card>
          <Card>
            <CardTitle>Common mistakes</CardTitle>
            <ul className="space-y-1.5 text-sm text-muted">
              {e.mistakes.map((m) => <li key={m}>✕ {m}</li>)}
            </ul>
          </Card>
          {e.safety.length > 0 && (
            <Notice tone="warn" icon={<AlertTriangle className="size-4 text-warn" />}>
              {e.safety.join(" ")} Stop if you feel sharp pain.
            </Notice>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardTitle>At a glance</CardTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted">Recommended</dt><dd className="num text-lg font-bold">{target}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Rest</dt><dd>{e.restSeconds}s</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Equipment</dt><dd className="text-end">{e.equipment.length ? e.equipment.map((x) => EQUIPMENT_LABELS[x]).join(", ") : "None"}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {e.primaryMuscles.map((m) => <Badge key={m} tone="accent">{MUSCLE_LABELS[m] ?? m}</Badge>)}
              {e.secondaryMuscles.map((m) => <Badge key={m}>{MUSCLE_LABELS[m] ?? m}</Badge>)}
            </div>
          </Card>
          {(e.easier.length > 0 || e.harder.length > 0) && (
            <Card>
              <CardTitle>Variations</CardTitle>
              {e.easier.length > 0 && <p className="mb-2 flex items-center gap-1 text-xs text-muted"><ArrowDown className="size-3" /> Easier</p>}
              <div className="flex flex-wrap gap-2">{e.easier.map(link)}</div>
              {e.harder.length > 0 && <p className="mb-2 mt-4 flex items-center gap-1 text-xs text-muted"><ArrowUp className="size-3" /> Harder</p>}
              <div className="flex flex-wrap gap-2">{e.harder.map(link)}</div>
            </Card>
          )}
          <Card>
            <CardTitle>Your history</CardTitle>
            {records.length === 0 && recentSets.length === 0 ? (
              <p className="text-sm text-muted">No sets logged yet.</p>
            ) : (
              <>
                {records[0] && (
                  <p className="text-sm">
                    Best: <span className="num text-xl font-bold text-accent">{records[0].value}{records[0].metric === "seconds" ? "s" : records[0].metric === "loadKg" ? " kg" : " reps"}</span>
                  </p>
                )}
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {recentSets.slice(0, 6).map((s, i) => (
                    <li key={i}>
                      {new Date(s.completedAt).toLocaleDateString()} — {s.reps != null ? `${s.reps} reps` : `${s.seconds}s`}
                      {s.loadKg ? ` @ ${s.loadKg} kg` : ""}
                      {s.rpe ? ` · RPE ${s.rpe}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          {e.related.length > 0 && (
            <Card>
              <CardTitle>Related</CardTitle>
              <div className="flex flex-wrap gap-2">{e.related.map(link)}</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
