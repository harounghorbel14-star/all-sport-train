import Link from "next/link";
import { TabLink } from "@/components/ui/tab-link";
import { CalendarRange, Download, Dumbbell, LineChart as LineIcon, Ruler } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { CorrectRecord } from "@/components/records/correct-record";
import { analytics, monthlyReport, RANGES, type RangeKey } from "@/lib/services/progress";
import { listProgressPhotos } from "@/lib/services/media";
import { SKILL_BY_SLUG } from "@/lib/content/skills";
import { cmToIn, formatDateKey, formatLength, formatWeight, kgToLb } from "@/lib/format";
import { Card, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { BarChart, LineChart, MeterBar } from "@/components/ui/charts";
import { cx } from "@/lib/cx";
import { goalOptions, listGoals } from "@/lib/services/goals";
import { GoalsCard } from "@/components/goals/goals-card";
import { featureEnabled } from "@/lib/server/features";
import { ExercisePicker, MeasurementForm, PhotoJournal, DeleteMeasurement } from "./client";

export const metadata = { title: "Progress" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string; exercise?: string; goals?: string }> }) {
  const { user, profile } = await requireUser();
  const sp = await searchParams;
  const range = (sp.range && sp.range in RANGES ? sp.range : "12w") as RangeKey;
  const showAbandoned = sp.goals === "all";
  const [a, photos, report, goals, options] = await Promise.all([analytics(user.id, range, sp.exercise), listProgressPhotos(user.id), monthlyReport(user.id), featureEnabled("goals") ? listGoals(user.id, { includeAbandoned: showAbandoned }) : null, featureEnabled("goals") ? goalOptions(user.id) : null]);
  const units = profile.units as "metric" | "imperial";
  const label = (w: string) => formatDateKey(w, profile.locale, { month: "short", day: "numeric" });
  const weights = [...a.measurements].filter((m) => m.weightKg).map((m) => ({ label: formatDateKey(m.dateKey, profile.locale, { month: "short", day: "numeric" }), value: Math.round((units === "imperial" ? kgToLb(m.weightKg!) : m.weightKg!) * 10) / 10 }));
  const waists = [...a.measurements].filter((m) => m.waistCm).map((m) => ({ label: formatDateKey(m.dateKey, profile.locale, { month: "short", day: "numeric" }), value: Math.round((units === "imperial" ? cmToIn(m.waistCm!) : m.waistCm!) * 10) / 10 }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your data"
        title="Progress"
        subtitle="Charts use only what you've logged — nothing is invented. Body data is private and optional."
        action={
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Time range">
            {Object.keys(RANGES).map((r) => (
              <TabLink key={r} href={`/progress?range=${r}${sp.exercise ? `&exercise=${sp.exercise}` : ""}`} role="tab" aria-selected={r === range} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", r === range ? "bg-accent text-accent-fg" : "text-muted")}>
                {r}
              </TabLink>
            ))}
          </div>
        }
      />
      {!a.hasAnyData && <EmptyState icon={<LineIcon className="size-5" />} title="Your charts will fill in as you train" body="Complete a workout, log an activity or add a measurement to see your first data points." />}
      {goals && options && <GoalsCard goals={goals} options={options} units={units} locale={profile.locale} showAbandoned={showAbandoned} />}

      <Card id="monthly">
        <CardTitle icon={<CalendarRange className="size-4" />}>Monthly report</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-subtle">
                <th className="py-1 text-start font-medium" />
                <th className="text-start font-medium">{formatDateKey(`${report.previous.month}-01`, profile.locale, { month: "long" })}</th>
                <th className="text-start font-medium">{formatDateKey(`${report.current.month}-01`, profile.locale, { month: "long" })}{report.partial ? " (so far)" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Workouts", report.previous.workouts, report.current.workouts],
                ["Workout time (min)", report.previous.workoutMinutes, report.current.workoutMinutes],
                ["Active days", report.previous.activeDays, report.current.activeDays],
                ["Personal records", report.previous.personalRecords.length, report.current.personalRecords.length],
                ["Lessons completed", report.previous.lessonsCompleted.length, report.current.lessonsCompleted.length],
                ["Sport results logged", report.previous.sportResultsLogged, report.current.sportResultsLogged],
              ].map(([label, before, now]) => (
                <tr key={label} className="border-t border-line">
                  <td className="py-1.5 text-muted">{label}</td>
                  <td>{before}</td>
                  <td className="font-semibold">{now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.current.sports.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">By sport (each compared only with itself)</p>
            <ul className="space-y-1 text-sm">
              {report.current.sports.map((x) => {
                const before = report.previous.sports.find((y) => y.sport === x.sport);
                return (
                  <li key={x.sport} className="flex justify-between gap-2">
                    <span className="capitalize">{x.sport.replace(/-/g, " ")}</span>
                    <span className="text-muted">
                      {x.sessions} sessions · {x.minutes} min{before ? ` (last month: ${before.sessions} · ${before.minutes} min)` : " (not logged last month)"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {report.notes.map((n) => (
          <p key={n} className="mt-2 text-xs text-muted">{n}</p>
        ))}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><Stat label="Workouts" value={a.totals.workouts} hint={`last ${range}`} /></Card>
        <Card><Stat label="Training time" value={Math.round(a.totals.minutes / 60 * 10) / 10} unit="h" /></Card>
        <Card><Stat label="All active minutes" value={a.totals.activeMinutes} unit="min" /></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardTitle icon={<Dumbbell className="size-4" />}>Workouts per week</CardTitle>
          <BarChart data={a.perWeek.map((w, i) => ({ label: label(w.week), value: w.workouts, highlight: i === a.perWeek.length - 1 }))} />
        </Card>
        <Card>
          <CardTitle>Training minutes per week</CardTitle>
          <BarChart unit=" min" color="var(--info)" data={a.perWeek.map((w, i) => ({ label: label(w.week), value: w.minutes, highlight: i === a.perWeek.length - 1 }))} />
        </Card>
        <Card>
          <CardTitle>Total reps per week</CardTitle>
          <BarChart data={a.perWeek.map((w, i) => ({ label: label(w.week), value: w.reps, highlight: i === a.perWeek.length - 1 }))} />
          {a.perWeek.some((w) => w.loadVolumeKg > 0) && <p className="mt-2 text-xs text-muted">Loaded volume this period: {formatWeight(a.perWeek.reduce((s, w) => s + w.loadVolumeKg, 0), units)}</p>}
        </Card>
        <Card>
          <CardTitle>All activity (minutes)</CardTitle>
          <BarChart unit=" min" color="var(--warn)" data={a.perWeek.map((w, i) => ({ label: label(w.week), value: w.activeMinutes, highlight: i === a.perWeek.length - 1 }))} />
        </Card>
      </div>

      <Card>
        <CardTitle icon={<LineIcon className="size-4" />} action={<ExercisePicker options={a.trainedExercises} value={sp.exercise ?? ""} range={range} />}>
          Exercise performance
        </CardTitle>
        {!sp.exercise ? (
          <p className="text-sm text-muted">{a.trainedExercises.length ? "Choose an exercise to see your best set per session." : "Log sets in a workout to track exercise performance."}</p>
        ) : a.exerciseSeries.length ? (
          <LineChart unit={a.exerciseSeries[0].metric === "seconds" ? "s" : " reps"} points={a.exerciseSeries.map((p) => ({ label: formatDateKey(p.dateKey, profile.locale, { month: "short", day: "numeric" }), value: p.best }))} />
        ) : (
          <p className="text-sm text-muted">No sets for this exercise in the selected range.</p>
        )}
      </Card>

      {a.perWeek.some((w) => w.avgKcalEaten) && (
        <Card>
          <CardTitle>Average logged calories (days logged)</CardTitle>
          <BarChart unit=" kcal" color="var(--success)" data={a.perWeek.map((w) => ({ label: label(w.week), value: w.avgKcalEaten ?? 0 }))} />
        </Card>
      )}

      {a.skills.length > 0 && (
        <Card>
          <CardTitle>Skill progression</CardTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {a.skills.map((s) => {
              const def = SKILL_BY_SLUG.get(s.skillSlug);
              if (!def) return null;
              return (
                <li key={s.id}>
                  <Link href={`/academy/${s.skillSlug}`} className="block rounded-xl bg-surface-2 p-3">
                    <p className="text-sm font-semibold">{def.name}</p>
                    <p className="mb-2 text-xs text-subtle">{s.unlockedAt ? "Complete" : `Step ${s.stepIndex + 1} of ${def.steps.length}`}</p>
                    <MeterBar value={s.unlockedAt ? def.steps.length : s.stepIndex} max={def.steps.length} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardTitle icon={<Ruler className="size-4" />}>Body measurements</CardTitle>
          <p className="mb-3 text-xs text-muted">Optional and private. There&apos;s no need to weigh in daily — monthly is plenty for most goals.</p>
          <MeasurementForm units={units} />
          {weights.length > 1 && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-subtle">Weight trend</p>
              <LineChart points={weights} unit={units === "imperial" ? " lb" : " kg"} height={140} />
            </div>
          )}
          {waists.length > 1 && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-subtle">Waist trend</p>
              <LineChart points={waists} unit={units === "imperial" ? " in" : " cm"} height={120} color="var(--info)" />
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Measurement log</CardTitle>
          {a.measurements.length === 0 ? (
            <p className="text-sm text-muted">No measurements in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs text-subtle">
                    <th className="py-1 text-start font-medium">Date</th>
                    <th className="text-start font-medium">Weight</th>
                    <th className="text-start font-medium">Waist</th>
                    <th className="text-start font-medium">Chest</th>
                    <th className="text-start font-medium">Arm</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...a.measurements].reverse().map((m) => (
                    <tr key={m.id} className="border-t border-line">
                      <td className="py-2">{formatDateKey(m.dateKey, profile.locale, { month: "short", day: "numeric" })}{m.milestone && <span className="block text-[10px] text-accent">{m.milestone}</span>}</td>
                      <td>{formatWeight(m.weightKg, units)}</td>
                      <td>{formatLength(m.waistCm, units)}</td>
                      <td>{formatLength(m.chestCm, units)}</td>
                      <td>{formatLength(m.armCm, units)}</td>
                      <td className="flex items-center">
                        <CorrectRecord
                          endpoint={`/api/progress/measurements/${m.id}`}
                          title="Correct measurement"
                          label={`Correct measurement from ${m.dateKey}`}
                          fields={[
                            { key: "weightKg", label: `Weight (${units === "imperial" ? "lb" : "kg"})`, value: m.weightKg, scale: units === "imperial" ? 2.20462 : 1 },
                            { key: "waistCm", label: `Waist (${units === "imperial" ? "in" : "cm"})`, value: m.waistCm, scale: units === "imperial" ? 1 / 2.54 : 1 },
                            { key: "chestCm", label: `Chest (${units === "imperial" ? "in" : "cm"})`, value: m.chestCm, scale: units === "imperial" ? 1 / 2.54 : 1 },
                            { key: "armCm", label: `Arm (${units === "imperial" ? "in" : "cm"})`, value: m.armCm, scale: units === "imperial" ? 1 / 2.54 : 1 },
                          ]}
                        />
                        <DeleteMeasurement id={m.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Private photo journal</CardTitle>
        <PhotoJournal photos={photos.map((p) => ({ id: p.id, pose: p.pose, dateKey: p.dateKey }))} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Download everything you&apos;ve logged as JSON.</p>
        <a href="/api/account/export" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-accent">
          <Download className="size-4" /> Export my data
        </a>
      </Card>
    </div>
  );
}
