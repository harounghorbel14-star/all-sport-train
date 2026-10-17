import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { SPORTS } from "@/lib/content/sports";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { ScheduleEditor } from "./schedule";

export const metadata = { title: "Sports Explorer" };

const GROUP_LABELS: Record<string, string> = { strength: "Strength & calisthenics", endurance: "Endurance", team: "Team sports", combat: "Combat sports", racket: "Racket sports", mind_body: "Mind & body", conditioning: "Conditioning" };

export default async function SportsPage() {
  const { profile } = await requireUser();
  const groups = [...new Set(SPORTS.map((s) => s.group))];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Multisport" title="Sports Explorer" subtitle="Every sport gets its own tracking fields, beginner guidance and conditioning ideas. Combine them into one weekly schedule." />
      <Card>
        <CardTitle>My weekly schedule</CardTitle>
        <ScheduleEditor initial={profile.sportSchedule} trainingDays={profile.trainingDays} sports={SPORTS.map((s) => ({ slug: s.slug, name: s.name }))} />
      </Card>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="num mb-3 text-2xl font-bold uppercase">{GROUP_LABELS[g]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SPORTS.filter((s) => s.group === g).map((s) => (
              <Link key={s.slug} href={`/sports/${s.slug}`}>
                <Card interactive className="h-full">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{s.name}</p>
                    {profile.sports.includes(s.slug) && <Badge tone="accent">Yours</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">Tracks: {s.primaryMetrics.join(" · ")}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
