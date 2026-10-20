import Link from "next/link";
import { Flag } from "lucide-react";
import type { GoalNote } from "@/lib/domain/goals";
import type { listGoals } from "@/lib/services/goals";
import { formatDateKey, formatDuration, formatRecord, type Units } from "@/lib/format";
import { fmt, getDictionary } from "@/lib/i18n";
import { Badge, Card, CardTitle } from "@/components/ui/primitives";
import { MeterBar } from "@/components/ui/charts";
import { CorrectRecord } from "@/components/records/correct-record";
import { GoalStatusButton, NewGoalButton, type GoalOptions } from "./goal-actions";

type Goal = Awaited<ReturnType<typeof listGoals>>[number];

/** Goals with progress from logged records. Every number shown comes from the user's own data. */
export function GoalsCard({ goals, options, units, locale, showAbandoned }: { goals: Goal[]; options: GoalOptions; units: Units; locale: string; showAbandoned: boolean }) {
  const tg = getDictionary(locale).goals;
  const date = (k: string) => formatDateKey(k, locale, { day: "numeric", month: "short", year: "numeric" });
  const metricOf = (g: Goal) => options.sports.find((s) => s.slug === g.sportSlug)?.metrics.find((m) => m.key === g.metricKey);
  const value = (g: Goal, v: number) => {
    if (g.kind === "exercise") return formatRecord(v, g.metric ?? "reps", units);
    const m = metricOf(g);
    if (m?.kind === "time") return formatDuration(v);
    if (m?.kind === "ratio") return `${Math.round(v * 10) / 10}%`;
    return `${Math.round(v * 100) / 100}${m?.unit ? ` ${m.unit}` : ""}`;
  };
  const note = (n: GoalNote) => {
    switch (n.code) {
      case "no_data": return tg.noteNoData;
      case "no_baseline": return tg.noteNoBaseline;
      case "baseline_first_logged": return fmt(tg.noteFirstLogged, { date: date(n.dateKey) });
      case "few_results": return fmt(tg.noteFewResults, { count: n.count });
      case "target_date_passed": return fmt(tg.noteDatePassed, { date: date(n.dateKey) });
      case "already_met_at_start": return tg.noteMetAtStart;
      case "this_week_partial": return fmt(tg.noteThisWeek, { count: n.count });
      case "lesson_awaiting_assessment": return tg.noteAwaiting;
      case "self_reported": return tg.noteSelfReported;
    }
  };
  const source = (s: string | null) => (s === "logged" ? tg.sourceLogged : s === "self_reported" ? tg.sourceSelf : s === "first_logged" ? tg.sourceFirst : "");
  const active = goals.filter((g) => g.status === "active");
  const abandoned = goals.filter((g) => g.status !== "active");

  const row = (g: Goal) => {
    const e = g.evaluation;
    const measured = g.kind === "exercise" || g.kind === "sport_metric";
    const scale = g.kind === "exercise" && g.metric === "loadKg" && units === "imperial" ? 2.20462 : undefined;
    return (
      <li key={g.id} className="space-y-2 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{g.title}</p>
            <p className="text-xs text-muted">
              {measured && (e.baseline != null ? `${fmt(tg.start, { value: value(g, e.baseline) })}${source(e.baselineSource) ? ` (${source(e.baselineSource)})` : ""}` : tg.noStart)}
              {measured && e.current != null && ` · ${fmt(tg.best, { value: value(g, e.current) })}`}
              {measured && ` · ${fmt(tg.targetValue, { value: value(g, g.target) })}`}
              {g.kind === "consistency" && fmt(tg.weeksStreak, { n: e.current ?? 0, total: g.periodWeeks ?? 4 })}
              {g.targetDate && ` · ${fmt(tg.by, { date: date(g.targetDate) })}`}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            {g.status !== "active" ? <Badge>{tg.abandoned}</Badge> : e.achieved && <Badge tone="success">{e.achievedOn ? fmt(tg.achievedOn, { date: date(e.achievedOn) }) : tg.achieved}</Badge>}
            {g.status === "active" && (
              <CorrectRecord
                endpoint={`/api/goals/${g.id}`}
                title={g.title}
                label={fmt(tg.edit, { title: g.title })}
                fields={[
                  ...(g.kind !== "lesson" ? [{ key: "target", label: tg.target, value: g.target, scale, integer: g.kind === "consistency" }] : []),
                  { key: "targetDate", label: tg.targetDate, value: g.targetDate, type: "date" as const },
                ]}
              />
            )}
            <GoalStatusButton id={g.id} status={g.status} />
          </span>
        </div>
        {e.progress != null && <MeterBar value={Math.round(e.progress * 100)} max={100} />}
        {measured && e.milestones.length > 1 && (
          <ol className="flex flex-wrap gap-1.5 text-[11px]" aria-label={tg.milestones}>
            {e.milestones.map((m) => (
              <li key={m.fraction} className={m.reachedOn ? "rounded-full bg-accent-soft px-2 py-0.5 text-accent" : "rounded-full bg-surface-2 px-2 py-0.5 text-subtle"}>
                {Math.round(m.fraction * 100)}% · {value(g, m.value)}{m.reachedOn ? ` ✓ ${date(m.reachedOn)}` : ""}
              </li>
            ))}
          </ol>
        )}
        {e.notes.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted">
            {e.notes.map((n, i) => <li key={i}>{note(n)}</li>)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <Card id="goals">
      <CardTitle icon={<Flag className="size-4" />} action={<NewGoalButton options={options} units={units} />}>
        {tg.title}
      </CardTitle>
      <p className="-mt-2 mb-2 text-xs text-muted">{tg.intro}</p>
      {active.length ? <ul className="divide-y divide-line">{active.map(row)}</ul> : <p className="py-3 text-sm text-muted">{tg.empty}</p>}
      {showAbandoned && abandoned.length > 0 && <ul className="mt-2 divide-y divide-line border-t border-line opacity-80">{abandoned.map(row)}</ul>}
      <Link href={showAbandoned ? "/progress#goals" : "/progress?goals=all#goals"} className="mt-2 inline-block text-xs text-muted hover:text-accent">
        {showAbandoned ? tg.hideAbandoned : tg.showAbandoned}
      </Link>
    </Card>
  );
}
