import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { db } from "@/lib/server/db";
import { SPORT_BY_SLUG } from "@/lib/content/sports";
import { allExercises } from "@/lib/services/exercises";
import { formatDistance } from "@/lib/format";
import { Badge, ButtonLink, Card, CardTitle, PageHeader, Stat } from "@/components/ui/primitives";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: SPORT_BY_SLUG.get((await params).slug)?.name ?? "Sport" };
}

export default async function SportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sport = SPORT_BY_SLUG.get(slug);
  if (!sport) notFound();
  const { user, profile } = await requireUser();
  const [agg, exercises] = await Promise.all([
    db.activityEntry.aggregate({ where: { userId: user.id, sport: slug }, _count: true, _sum: { durationMin: true, distanceKm: true } }),
    allExercises(),
  ]);
  const related = exercises.filter((e) => e.sports.includes(slug)).slice(0, 10);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sports Explorer"
        title={sport.name}
        subtitle={`Tracks: ${sport.primaryMetrics.join(", ")}.`}
        action={sport.workoutBased ? <ButtonLink href="/today">Train today</ButtonLink> : <ButtonLink href={`/activity?sport=${slug}`}>Log a session</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><Stat label="Sessions logged" value={agg._count} /></Card>
        <Card><Stat label="Total time" value={Math.round((agg._sum.durationMin ?? 0) / 6) / 10} unit="h" /></Card>
        <Card><Stat label="Distance" value={sport.distance ? formatDistance(agg._sum.distanceKm ?? 0, profile.units as "metric") : "—"} /></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Getting started</CardTitle>
          <ul className="space-y-2 text-sm text-muted">{sport.beginner.map((b) => <li key={b}>• {b}</li>)}</ul>
        </Card>
        <Card>
          <CardTitle>What you can track</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge>Duration</Badge>
            <Badge>Intensity / RPE</Badge>
            {sport.distance && <Badge>Distance</Badge>}
            {sport.fields.map((f) => <Badge key={f.key}>{f.label}</Badge>)}
          </div>
          <p className="mt-3 text-xs text-subtle">Energy estimate uses MET values of {sport.met.light}/{sport.met.moderate}/{sport.met.vigorous} for light/moderate/vigorous{sport.distance === "km" && ["running", "cycling", "walking"].includes(slug) ? ", refined by your pace when distance is entered" : ""}.</p>
        </Card>
      </div>
      <Card>
        <CardTitle>Session templates</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {sport.templates.map((t) => (
            <div key={t.title} className="rounded-xl bg-surface-2 p-4">
              <div className="flex items-center justify-between"><p className="font-semibold">{t.title}</p><Badge tone="info">{t.durationMin} min · {t.intensity}</Badge></div>
              <ol className="mt-2 space-y-1 text-sm text-muted">{t.structure.map((s, i) => <li key={s}>{i + 1}. {s}</li>)}</ol>
            </div>
          ))}
        </div>
      </Card>
      {related.length > 0 && (
        <Card>
          <CardTitle>Useful exercises for {sport.name.toLowerCase()}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {related.map((e) => <Link key={e.slug} href={`/exercises/${e.slug}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm hover:text-accent">{e.name}</Link>)}
          </div>
        </Card>
      )}
    </div>
  );
}
