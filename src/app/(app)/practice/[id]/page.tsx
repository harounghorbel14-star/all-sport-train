import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { AppError } from "@/lib/server/errors";
import { db } from "@/lib/server/db";
import { metricView, getPractice } from "@/lib/services/sports";
import { Badge, Card, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { CompletePractice } from "./complete";

export const metadata = { title: "Practice" };

async function load(userId: string, id: string) {
  try {
    return await getPractice(userId, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser();
  const { plan, content, sport } = await load(user.id, id);
  const keys = [...new Set(content.blocks.map((b) => b.metricKey).filter((k): k is string => Boolean(k)))];
  const metrics = (await db.sportMetric.findMany({ where: { sportId: plan.sportId, key: { in: keys }, scope: "performance" } })).map(metricView);
  const results = plan.status === "completed" ? await db.sportMetricEntry.findMany({ where: { userId: user.id, practicePlanId: plan.id } }) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/sports/${sport.slug}?tab=practice`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {sport.name}
      </Link>
      <PageHeader eyebrow={`${sport.name} practice`} title={plan.title} subtitle={`~${content.minutes} min · ${plan.source === "coach" ? "built by the coach" : "built by the practice builder"}`} action={plan.status === "completed" ? <Badge tone="success">Completed</Badge> : undefined} />
      <Card>
        <CardTitle>Plan</CardTitle>
        <ol className="space-y-2">
          {content.blocks.map((b, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-sm">{i + 1}</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {b.drillSlug ? (
                    <Link href={`/sports/${sport.slug}?tab=drills#${b.drillSlug}`} className="font-medium hover:text-accent">
                      {b.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{b.title}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3" /> {b.minutes} min · {b.focus}
                  </span>
                </div>
                {b.exercises && (
                  <p className="mt-1 text-xs text-muted">
                    {b.exercises.map((e, j) => (
                      <span key={e}>
                        {j > 0 && ", "}
                        <Link href={`/exercises/${e}`} className="underline hover:text-accent">
                          {e.replace(/-/g, " ")}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                {b.note && <p className="mt-1 text-xs text-subtle">{b.note}</p>}
                {b.metricKey && metrics.some((m) => m.key === b.metricKey) && <p className="mt-1 text-xs text-accent">Record: {metrics.find((m) => m.key === b.metricKey)?.label}</p>}
              </div>
            </li>
          ))}
        </ol>
        {content.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {content.notes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        )}
      </Card>
      <Notice tone="warn" icon={<ShieldAlert className="size-4" />}>
        {content.safety.join(" ")}
      </Notice>
      {content.excluded.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">Left out ({content.excluded.length})</summary>
          <ul className="mt-2 space-y-1 text-muted">
            {content.excluded.map((e) => (
              <li key={e.title}>
                <span className="text-fg">{e.title}</span> — {e.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {plan.status === "completed" ? (
        <Card>
          <CardTitle>Logged</CardTitle>
          <p className="text-sm text-muted">
            Completed {plan.completedAt ? plan.completedAt.toISOString().slice(0, 10) : ""}
            {plan.rpe ? ` · RPE ${plan.rpe}` : ""}. {results.length ? `${results.length} result(s) recorded.` : "No results recorded."}
          </p>
          <Link href={`/sports/${sport.slug}?tab=progress`} className="mt-2 inline-block text-sm text-accent underline">
            See progress
          </Link>
        </Card>
      ) : (
        <CompletePractice id={plan.id} sportSlug={sport.slug} minutes={content.minutes} metrics={metrics.map((m) => ({ key: m.key, label: m.label, kind: m.kind, unit: m.unit, options: m.options, direction: m.direction, min: m.min, max: m.max, minAttempts: m.minAttempts, description: m.description, measurement: m.measurement }))} />
      )}
    </div>
  );
}
