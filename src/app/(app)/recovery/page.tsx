import { HeartPulse, Moon } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { recoveryOverview } from "@/lib/services/recovery";
import { MOBILITY_ROUTINES, POSTURE_QUESTIONS } from "@/lib/content/mobility";
import { exerciseLookup } from "@/lib/services/views";
import { formatDateKey } from "@/lib/format";
import { Card, CardTitle, PageHeader, Notice } from "@/components/ui/primitives";
import { BarChart } from "@/components/ui/charts";
import { CheckInCard } from "../today/widgets";
import { MobilityRoutines, PostureCheck } from "./client";

export const metadata = { title: "Recovery & Mobility" };

export default async function RecoveryPage() {
  const { user, profile } = await requireUser();
  const [o, lookup] = await Promise.all([recoveryOverview(user.id), exerciseLookup()]);
  const done = new Set(o.mobility.filter((m) => m.dateKey === o.today).map((m) => m.routineSlug));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recover to progress" title="Recovery & Mobility" subtitle="Sleep, energy and soreness guide how hard you train — readiness only ever reduces load, it never pushes you harder." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle icon={<HeartPulse className="size-4" />}>Today&apos;s check-in</CardTitle>
          {o.advice && (
            <div className="mb-3">
              <Notice tone={o.band === "rest" ? "warn" : "accent"}>
                <p className="font-semibold">{o.advice.title}</p>
                <p className="text-xs text-muted">{o.advice.body}</p>
              </Notice>
            </div>
          )}
          <CheckInCard dateKey={o.today} existing={o.todayCheck} />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Readiness · last 14 days</CardTitle>
          {o.checkIns.length ? (
            <BarChart unit="/100" data={o.checkIns.map((c) => ({ label: formatDateKey(c.dateKey, profile.locale, { day: "numeric" }), value: c.readiness, highlight: c.dateKey === o.today }))} />
          ) : (
            <p className="text-sm text-muted">Check in for a few days to see your readiness trend.</p>
          )}
          {o.checkIns.some((c) => c.sleepHours) && (
            <div className="mt-5">
              <p className="mb-1 flex items-center gap-1 text-xs text-subtle"><Moon className="size-3" /> Sleep (hours)</p>
              <BarChart height={90} color="var(--info)" unit="h" data={o.checkIns.map((c) => ({ label: formatDateKey(c.dateKey, profile.locale, { day: "numeric" }), value: c.sleepHours ?? 0 }))} />
            </div>
          )}
          <p className="mt-3 text-xs text-subtle">Rest days logged here keep your streak going. Sleep is entered manually — no device permissions are requested.</p>
        </Card>
      </div>
      <section>
        <h2 className="num mb-3 text-2xl font-bold uppercase">Mobility & posture routines</h2>
        <MobilityRoutines today={o.today} routines={MOBILITY_ROUTINES} lookup={Object.fromEntries(Object.entries(lookup).map(([k, v]) => [k, { name: v.name, steps: v.steps }]))} doneToday={[...done]} />
      </section>
      <Card>
        <CardTitle>Posture self-check (educational)</CardTitle>
        <PostureCheck questions={POSTURE_QUESTIONS.map((q) => ({ ...q }))} routines={Object.fromEntries(MOBILITY_ROUTINES.map((r) => [r.slug, r.name]))} />
      </Card>
    </div>
  );
}
