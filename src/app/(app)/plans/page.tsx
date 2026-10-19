import Link from "next/link";
import { CalendarCheck, CalendarDays, Check, Clock, Dumbbell, Flag } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { roadmapOverview } from "@/lib/services/roadmap";
import { listPlans, recentSessions } from "@/lib/services/workouts";
import { formatDateKey, formatDuration } from "@/lib/format";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MeterBar } from "@/components/ui/charts";
import { cx } from "@/lib/cx";
import { ProgramBuilder, WeeklyReviewForm } from "./forms";
import { calendar } from "@/lib/services/calendar";
import { PlanCalendarActions, ScheduleWorkoutButton } from "@/components/calendar/plan-actions";

export const metadata = { title: "Plans & Roadmap" };

export default async function PlansPage() {
  const { user, profile } = await requireUser();
  const [road, plans, sessions, cal] = await Promise.all([roadmapOverview(user.id), listPlans(user.id, 12), recentSessions(user.id, 10), calendar(user.id, { days: 21 })]);
  const s = road.state;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="24-week framework" title="Plans & Roadmap" subtitle="An adaptable six-phase progression. Weekly reviews let you repeat, deload or move on — it's a framework, not a fixed schedule." />

      <Card id="calendar">
        <CardTitle icon={<CalendarDays className="size-4" />}>Training calendar</CardTitle>
        <p className="-mt-2 mb-3 text-xs text-muted">Last week and the next two weeks. Training days get their workout on the day; schedule one ahead, move it, or cancel it — nothing is deleted.</p>
        <ol className="divide-y divide-line">
          {cal.days.map((d) => {
            const empty = !d.plans.length && !d.recurring.length && !d.completed.length;
            return (
              <li key={d.dateKey} className={cx("flex flex-wrap items-start gap-3 py-2.5", d.isToday && "rounded-lg bg-accent-soft px-2")} aria-current={d.isToday ? "date" : undefined}>
                <span className="w-24 shrink-0 text-xs">
                  <span className="block font-semibold">{formatDateKey(d.dateKey, profile.locale, { weekday: "short", day: "numeric", month: "short" })}</span>
                  {d.isToday && <span className="text-accent">Today</span>}
                  {!d.isToday && d.isTrainingDay && <span className="text-subtle">Training day</span>}
                  {d.restDay && <span className="text-subtle">Rest day logged</span>}
                </span>
                <span className="min-w-0 flex-1 space-y-1 text-sm">
                  {d.plans.map((p) => (
                    <span key={p.id} className="flex items-center justify-between gap-2">
                      <Link href={`/workout/${p.id}`} className={cx("truncate hover:text-accent", p.status === "cancelled" && "text-subtle line-through")}>{p.title}</Link>
                      <span className="flex items-center gap-1">
                        <Badge tone={p.status === "completed" ? "success" : p.status === "skipped" ? "warn" : p.status === "cancelled" ? "neutral" : "info"}>{p.status}</Badge>
                        {d.dateKey >= cal.today && <PlanCalendarActions planId={p.id} dateKey={d.dateKey} status={p.status} today={cal.today} title={p.title} />}
                      </span>
                    </span>
                  ))}
                  {d.recurring.map((r) => (
                    <span key={r.sport} className="flex items-center justify-between gap-2 text-muted">
                      <span className="truncate capitalize">{r.sport.replace(/-/g, " ")} <span className="text-xs text-subtle">· weekly</span></span>
                      <Badge tone={r.status === "done" ? "success" : r.status === "missed" ? "warn" : "neutral"}>{r.status}</Badge>
                    </span>
                  ))}
                  {d.completed.map((c, i) => (
                    <span key={i} className="flex items-center gap-1 text-muted"><Check className="size-3.5 text-accent" />{c.title}</span>
                  ))}
                  {empty && d.dateKey > cal.today && !d.isTrainingDay && <span className="text-xs text-subtle">Rest</span>}
                </span>
                {d.dateKey > cal.today && !d.plans.some((p) => p.status !== "cancelled") && <ScheduleWorkoutButton dateKey={d.dateKey} label={`Schedule a workout on ${d.dateKey}`} />}
              </li>
            );
          })}
        </ol>
      </Card>

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
