import Link from "next/link";
import { Bot, Database, Eye, Link2, Lock, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { privacySummary } from "@/lib/services/account";
import { aiConfigured } from "@/lib/server/env";
import { fmt, getDictionary } from "@/lib/i18n";
import { Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { ClearCoachButton } from "./clear-coach";

export const metadata = { title: "Privacy center" };

/** One place for what's stored, who sees it, what leaves the app, retention, export and deletion. */
export default async function PrivacyPage() {
  const { user, profile } = await requireUser();
  const t = getDictionary(profile.locale).privacy;
  const s = await privacySummary(user.id);
  const ai = aiConfigured();
  const rows: [keyof typeof s.counts, string, string | null][] = [
    ["workouts", t.workouts, "/plans"],
    ["activities", t.activities, "/activity"],
    ["foods", t.foods, "/nutrition"],
    ["water", t.water, "/nutrition"],
    ["measurements", t.measurements, "/progress"],
    ["photos", t.photos, "/progress"],
    ["formChecks", t.formChecks, "/form-check"],
    ["coachMessages", t.coachMessages, "/coach"],
    ["posts", t.posts, "/community"],
    ["goals", t.goals, "/progress#goals"],
    ["quizAttempts", t.quizAttempts, null],
    ["templates", t.templates, "/plans#templates"],
    ["trips", t.trips, "/plans#travel"],
    ["corrections", t.corrections, null],
  ];
  const vis = s.sharing.visibility === "public" ? t.visPublic : s.sharing.visibility === "friends" ? t.visFriends : t.visPrivate;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader eyebrow={getDictionary(profile.locale).nav.profile} title={t.title} subtitle={t.intro} />
      <Card>
        <CardTitle icon={<Database className="size-4" />}>{t.stored}</CardTitle>
        <ul className="divide-y divide-line text-sm">
          {rows.map(([k, label, href]) => (
            <li key={k} className="flex items-center justify-between gap-2 py-2">
              <span>{label}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-muted">{s.counts[k]}</span>
                {href && (
                  <Link href={href} className="text-xs text-accent underline" aria-label={`${t.manage}: ${label}`}>
                    {t.manage}
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle icon={<Eye className="size-4" />}>{t.sharing}</CardTitle>
        <ul className="space-y-1 text-sm">
          <li>{fmt(t.visibility, { value: vis })}</li>
          <li>{fmt(t.shareWorkouts, { value: s.sharing.shareWorkouts ? t.on : t.off })}</li>
        </ul>
        <p className="mt-2 text-xs text-muted">{t.alwaysPrivate}</p>
        <Link href="/profile#privacy" className="mt-2 inline-block text-sm text-accent underline">{t.editSharing}</Link>
      </Card>
      <Card>
        <CardTitle icon={<Bot className="size-4" />}>{t.ai}</CardTitle>
        <p className="text-sm text-muted">{ai ? t.aiOn : t.aiOff}</p>
        {ai && (
          <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-muted">
            <li>{t.aiSent}</li>
            <li>{fmt(t.aiNutrition, { value: s.sharing.nutritionInCoach ? t.on : t.off })}</li>
            <li>{t.aiFormCheck}</li>
          </ul>
        )}
        <div className="mt-3">
          <ClearCoachButton disabled={s.counts.coachMessages === 0} />
        </div>
      </Card>
      <Card>
        <CardTitle icon={<Link2 className="size-4" />}>{t.connected}</CardTitle>
        <ul className="space-y-1 text-sm">
          <li>{fmt(t.google, { value: s.connected.google ? t.connectedYes : t.connectedNo })}</li>
          <li className="text-muted">{t.health}</li>
        </ul>
      </Card>
      <Card>
        <CardTitle icon={<Timer className="size-4" />}>{t.retention}</CardTitle>
        <ul className="list-disc space-y-1 ps-5 text-sm text-muted">
          <li>{t.retGuest}</li>
          <li>{t.retTemplates}</li>
          <li>{t.retForm}</li>
          <li>{t.retAccount}</li>
        </ul>
      </Card>
      <Card>
        <CardTitle icon={<Lock className="size-4" />}>{t.yourData}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent">{t.export}</a>
          <Link href="/profile#data" className="inline-flex h-10 items-center rounded-xl bg-danger/15 px-4 text-sm font-semibold text-danger hover:bg-danger/25">{t.delete}</Link>
        </div>
      </Card>
    </div>
  );
}
