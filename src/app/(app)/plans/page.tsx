import Link from "next/link";
import { CalendarCheck, Check, Clock, Dumbbell, Flag } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { roadmapOverview } from "@/lib/services/roadmap";
import { listPlans, recentSessions } from "@/lib/services/workouts";
import { formatDateKey, formatDuration } from "@/lib/format";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MeterBar } from "@/components/ui/charts";
import { cx } from "@/lib/cx";
import { ProgramBuilder, WeeklyReviewForm } from "./forms";

export const metadata = { title: "Plans & Roadmap" };

export default async function PlansPage() {
  const { user, profile } = await requireUser();
  const [road, plans, sessions] = await Promise.all([roadmapOverview(user.id), listPlans(user.id, 12), recentSessions(user.id, 10)]);
  const s = road.state;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="24-week framework" title="Plans & Roadmap" subtitle="An adaptable six-phase progression. Weekly reviews let you repeat, deload or move on — it's a framework, not a fixed schedule." />

      <Card>
        <CardTitle icon={<Flag className="size-4" />}>
          Week {s.week} {s.week > 24 && "· new block"}
        </CardTitle>
        <MeterBar value={s.progressPercent} max={100} />
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {road.phases.map((p) => {
            const state = p.index < s.phase.index ? "done" : p.index === s.phase.index ? "current" : "next";
            return (
              <li key={p.index} className={cx("rounded-2xl border p-4", state === "current" ? "border-accent bg-accent-soft" : "border-line bg-surface-2", state === "done" && "opacity-70")}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
                    Weeks {p.weeks[0]}–{p.weeks[1]}
                  </p>
                  {state === "done" && <Check className="size-4 text-accent" />}
                  {state === "current" && <Badge tone="accent">Now</Badge>}
                </div>
                <p className="num mt-1 text-2xl font-bold uppercase">
                  {p.index}. {p.name}
                </p>
                <p className="text-xs text-muted">{p.focus}</p>
                {state === "current" && (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {p.goals.map((g) => (
                      <li key={g}>• {g}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        {s.deload && <p className="mt-3 text-sm text-info">This is a deload week — volume is reduced so your body can absorb the work.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="review">
          <CardTitle icon={<CalendarCheck className="size-4" />}>Weekly review</CardTitle>
          <p className="mb-3 text-sm text-muted">
            This week: {road.thisWeek.sessions} of {road.thisWeek.planned} sessions{road.thisWeek.painDays ? ` · pain reported on ${road.thisWeek.painDays} day(s)` : ""}.
          </p>
          {road.reviewedThisWeek ? (
            <p className="text-sm text-accent">You&apos;ve reviewed this week. Thanks — see you next week.</p>
          ) : (
            <WeeklyReviewForm />
          )}
          {road.reviews.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-line pt-4">
              {road.reviews.slice(0, 5).map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-semibold">Week {r.weekIndex}</span> <Badge>{r.adjustment.action.replace("_", " ")}</Badge>
                  <p className="text-xs text-muted">{r.adjustment.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle icon={<Dumbbell className="size-4" />}>Program builder</CardTitle>
          <ProgramBuilder current={{ emphasis: profile.emphasis, daysPerWeek: profile.daysPerWeek, sessionMinutes: profile.sessionMinutes, goals: profile.goals }} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Dumbbell className="size-4" />}>Saved plans</CardTitle>
          {plans.length === 0 ? (
            <EmptyState title="No plans yet" body="Your daily sessions and coach-generated workouts appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link href={`/workout/${p.id}`} className="flex items-center justify-between py-3 hover:text-accent">
                    <span>
                      <span className="font-medium">{p.title}</span>
                      <span className="block text-xs text-subtle">
                        {p.scheduledOn ? formatDateKey(p.scheduledOn, profile.locale) : "Unscheduled"} · {p.source}
                      </span>
                    </span>
                    <Badge tone={p.status === "completed" ? "accent" : p.status === "started" ? "info" : "neutral"}>{p.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle icon={<Clock className="size-4" />}>Workout history</CardTitle>
          {sessions.length === 0 ? (
            <EmptyState title="No completed workouts" body="Finish your first session to start your history." />
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    <span className="font-medium">{s.title}</span>
                    <span className="block text-xs text-subtle">
                      {s.dateKey && formatDateKey(s.dateKey, profile.locale)} · {s._count.sets} sets{s.rpe ? ` · RPE ${s.rpe}` : ""}
                    </span>
                  </span>
                  <span className="num text-lg">{formatDuration(s.durationSeconds ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
