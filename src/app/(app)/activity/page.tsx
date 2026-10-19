import { Activity, Flame, Link2, Watch } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { CorrectRecord } from "@/components/records/correct-record";
import { activityOverview } from "@/lib/services/activity";
import { publishedSports } from "@/lib/services/sports";
import { formatDateKey, formatDistance, kcalRange } from "@/lib/format";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { BarChart } from "@/components/ui/charts";
import { ActivityLogger, DeleteActivity } from "./logger";

export const metadata = { title: "Activity & Calories" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const { user, profile } = await requireUser();
  const { sport } = await searchParams;
  const [o, sports] = await Promise.all([activityOverview(user.id), publishedSports()]);
  const bySlug = new Map(sports.map((x) => [x.slug, x]));
  const units = profile.units as "metric" | "imperial";
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Movement" title="Activity & Calories" subtitle="Every sport counts. Energy numbers are estimates from activity type, duration, intensity and body mass — shown as ranges, never exact." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Active minutes this week" value={o.week.minutes} unit="min" /></Card>
        <Card><Stat label="Sessions this week" value={o.week.sessions} /></Card>
        <Card><Stat label="Exercise energy (est.)" value={kcalRange(o.week.kcalLow, o.week.kcalHigh)} unit="kcal" hint="Net of resting energy" /></Card>
        <Card><Stat label="Distance this week" value={o.week.distanceKm ? formatDistance(o.week.distanceKm, units) : "—"} /></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={<Activity className="size-4" />}>Last 4 weeks · active minutes</CardTitle>
          {o.days.some((d) => d.minutes > 0) ? (
            <BarChart height={160} unit=" min" data={o.days.map((d) => ({ label: d.dateKey === o.today ? "Today" : formatDateKey(d.dateKey, profile.locale, { day: "numeric" }), value: d.minutes, highlight: d.dateKey === o.today }))} />
          ) : (
            <EmptyState title="No activity logged yet" body="Completed workouts appear here automatically. Log runs, rides, games and other sports below." />
          )}
        </Card>
        <Card>
          <CardTitle icon={<Flame className="size-4" />}>Daily energy (est.)</CardTitle>
          {o.tdee ? (
            <>
              <p className="num text-4xl font-bold">{kcalRange(o.tdee.low, o.tdee.high)}</p>
              <p className="text-xs text-muted">Estimated total daily expenditure before logged exercise.</p>
              <p className="mt-2 text-[11px] text-subtle">{o.tdee.method}. Logged exercise is shown separately to avoid double counting.</p>
            </>
          ) : (
            <p className="text-sm text-muted">Add height, weight and age range in your profile to see a daily energy estimate.</p>
          )}
          {!o.bodyMassKnown && <p className="mt-3 text-xs text-warn">Body mass unknown — estimates assume 70 kg with a wider range.</p>}
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Log an activity</CardTitle>
          <ActivityLogger today={o.today} units={units} initialSport={sport && bySlug.has(sport) ? sport : (profile.sports.find((s) => bySlug.has(s) && !bySlug.get(s)?.workoutBased) ?? "walking")} sports={sports.map((s) => ({ slug: s.slug, name: s.name, distance: s.distanceUnit, fields: s.metrics.filter((m) => m.scope === "session").map((m) => ({ key: m.key, label: m.label, kind: m.kind, unit: m.unit, options: m.options })) }))} />
        </Card>
        <Card>
          <CardTitle>Recent</CardTitle>
          {o.recent.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {o.recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.title ?? bySlug.get(a.sport)?.name ?? a.sport}</span>
                    <span className="text-xs text-subtle">
                      {formatDateKey(a.dateKey, profile.locale)} · {Math.round(a.durationMin)} min{a.distanceKm ? ` · ${formatDistance(a.distanceKm, units)}` : ""} · {kcalRange(a.kcalLow, a.kcalHigh)} kcal
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge tone={a.source === "workout" ? "accent" : "neutral"}>{a.source}</Badge>
                    {a.source !== "workout" && (
                      <CorrectRecord
                        endpoint={`/api/activity/${a.id}`}
                        title="Correct activity"
                        label={`Correct ${a.title ?? a.sport} on ${a.dateKey}`}
                        fields={[
                          { key: "durationMin", label: "Duration (min)", value: a.durationMin },
                          { key: "distanceKm", label: `Distance (${units === "imperial" ? "mi" : "km"})`, value: a.distanceKm, scale: units === "imperial" ? 0.621371 : 1 },
                          { key: "intensity", label: "Intensity", value: a.intensity, type: "select", options: [{ value: "light", label: "Light" }, { value: "moderate", label: "Moderate" }, { value: "vigorous", label: "Vigorous" }] },
                          { key: "dateKey", label: "Date", value: a.dateKey, type: "date" },
                        ]}
                      />
                    )}
                    {a.source !== "workout" && <DeleteActivity id={a.id} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card>
        <CardTitle icon={<Watch className="size-4" />}>Wearables & health platforms</CardTitle>
        <p className="text-sm text-muted">
          Manual logging works everywhere. Integrations (Apple Health, Google Health Connect, Strava, Garmin) need platform credentials and your explicit permission — they aren&apos;t configured on this server yet, so nothing is requested from your device. Imported activities are de-duplicated by their external ID, and workouts tracked here are never counted twice.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Apple Health", "Health Connect", "Strava", "Garmin"].map((n) => (
            <Badge key={n}><Link2 className="size-3" /> {n} · not configured</Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
