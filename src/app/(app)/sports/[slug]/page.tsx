import Link from "next/link";
import { TabLink } from "@/components/ui/tab-link";
import { notFound } from "next/navigation";
import { BookOpen, Bot, Check, Lock, ShieldAlert, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { AVAILABILITY_LABELS, levelRank } from "@/lib/content/sports/types";
import { todayKey } from "@/lib/domain/dates";
import { db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { allExercises } from "@/lib/services/exercises";
import { getSportHub, sportBySlug } from "@/lib/services/sports";
import { formatMetricValue } from "@/lib/sport-format";
import { formatDistance } from "@/lib/format";
import { Badge, ButtonLink, Card, CardTitle, Notice, PageHeader, Stat } from "@/components/ui/primitives";
import { cx } from "@/lib/cx";
import { AvailabilityBadge, DrillBadges, SourceList, VerificationBadge } from "@/components/sports/badges";
import { EnrollPanel, MetricPanel, PracticeBuilder } from "./client";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "learn", label: "Learn" },
  { key: "drills", label: "Drills" },
  { key: "practice", label: "Practice" },
  { key: "rules", label: "Rules" },
  { key: "progress", label: "Progress" },
  { key: "train", label: "Conditioning & safety" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: (await sportBySlug((await params).slug))?.name ?? "Sport" };
}

async function loadHub(slug: string, userId: string) {
  try {
    return await getSportHub(slug, userId);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function SportHubPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { user, profile } = await requireUser();
  const hub = await loadHub(slug, user.id);
  const { sport, profile: info, user: state } = hub;
  const sp = await searchParams;
  const tabs = TABS.filter((t) => {
    if (t.key === "learn") return hub.lessons.length > 0;
    if (t.key === "drills" || t.key === "practice") return hub.drills.length > 0;
    if (t.key === "rules") return hub.rulesets.length > 0;
    return true;
  });
  const tab: Tab = tabs.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const level = state?.enrollment?.level ?? "beginner";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={hub.parent ? `${hub.parent.name} · discipline` : "Sport"}
        title={sport.name}
        subtitle={sport.summary}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityBadge availability={sport.availability} />
            <ButtonLink href={`/coach?sport=${sport.slug}`} variant="secondary" size="sm" icon={<Bot className="size-4" />}>
              Ask the coach
            </ButtonLink>
          </div>
        }
      />
      {sport.availability !== "full" && (
        <Notice tone={sport.availability === "external" ? "warn" : "info"} icon={<ShieldAlert className="size-4" />}>
          <strong>{AVAILABILITY_LABELS[sport.availability].label}.</strong> {AVAILABILITY_LABELS[sport.availability].body}
        </Notice>
      )}
      <EnrollPanel slug={sport.slug} enrollment={state?.enrollment ? { level: state.enrollment.level, position: state.enrollment.position, supervised: state.enrollment.supervised, goals: state.enrollment.goals } : null} positions={(info.positions ?? []).map((p) => p.name)} needsSupervision={Boolean(info.supervisionNote)} />

      <nav className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 scrollbar-none" role="tablist" aria-label={`${sport.name} sections`}>
        {tabs.map((t) => (
          <TabLink key={t.key} href={t.key === "overview" ? `/sports/${slug}` : `/sports/${slug}?tab=${t.key}`} role="tab" aria-selected={t.key === tab} scroll={false} className={cx("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium", t.key === tab ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
            {t.label}
          </TabLink>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === "overview" && <Overview hub={hub} userId={user.id} units={profile.units as "metric" | "imperial"} />}
        {tab === "learn" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {state?.completedLessons.length ?? 0} of {hub.lessons.length} lessons completed. Lessons unlock when their prerequisites are done; you can open lessons one level above your own ({level}).
            </p>
            {(["beginner", "intermediate", "advanced"] as const).map((lv) => {
              const list = hub.lessons.filter((l) => l.level === lv);
              if (!list.length) return null;
              return (
                <Card key={lv}>
                  <CardTitle>{lv[0].toUpperCase() + lv.slice(1)}</CardTitle>
                  <ol className="space-y-2">
                    {list.map((l) => {
                      const done = state?.completedLessons.includes(l.slug);
                      const locked = !l.prerequisites.every((p) => state?.completedLessons.includes(p)) || levelRank(l.level) > levelRank(level) + 1;
                      const isNext = state?.nextLesson === l.slug;
                      return (
                        <li key={l.slug}>
                          <Link href={`/sports/${slug}/lessons/${l.slug}`} className={cx("flex items-start gap-3 rounded-xl border p-3 hover:border-accent", isNext ? "border-accent bg-accent-soft" : "border-line")}>
                            <span className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs", done ? "bg-accent text-accent-fg" : "bg-surface-3")}>{done ? <Check className="size-3.5" /> : locked ? <Lock className="size-3" /> : <BookOpen className="size-3" />}</span>
                            <span className="flex-1">
                              <span className="flex flex-wrap items-center gap-2 font-medium">
                                {l.title}
                                {isNext && <Badge tone="accent">Next</Badge>}
                                {l.requiresSupervision && <Badge tone="danger">Coach required</Badge>}
                              </span>
                              <span className="block text-xs text-muted">{l.summary}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              );
            })}
          </div>
        )}
        {tab === "drills" && (
          <div className="grid gap-3 md:grid-cols-2">
            {hub.drills.map((d) => (
              <Card key={d.slug} id={d.slug}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{d.title}</p>
                  <Badge tone="info">
                    {d.durationMin} min · {d.level}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{d.purpose}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{d.focus}</Badge>
                  <DrillBadges contact={d.contact} requiresSupervision={d.requiresSupervision} setting={d.setting} minPlayers={d.minPlayers} />
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-accent">How to run it</summary>
                  {d.content.setup.length > 0 && <Section title="Setup" items={d.content.setup} />}
                  <Section title="Instructions" items={d.content.instructions} ordered />
                  <Section title="Coaching points" items={d.content.coachingPoints} />
                  {d.content.progressions && <Section title="Make it harder" items={d.content.progressions} />}
                  {d.content.regressions && <Section title="Make it easier" items={d.content.regressions} />}
                  {d.equipment.length > 0 && <p className="mt-2 text-xs text-muted">Equipment: {d.equipment.join(", ")}</p>}
                  {d.content.record && <p className="mt-1 text-xs text-muted">Record: {d.content.record}</p>}
                </details>
              </Card>
            ))}
          </div>
        )}
        {tab === "practice" && (
          <div className="space-y-4">
            <PracticeBuilder slug={slug} supervised={Boolean(state?.enrollment?.supervised)} level={level} />
            {state && state.practices.length > 0 && (
              <Card>
                <CardTitle>Recent practices</CardTitle>
                <ul className="space-y-2 text-sm">
                  {state.practices.map((p) => (
                    <li key={p.id}>
                      <Link href={`/practice/${p.id}`} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 hover:text-accent">
                        <span>{p.title}</span>
                        <span className="text-xs text-muted">
                          {p.minutes} min · {p.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
        {tab === "rules" && (
          <div className="space-y-4">
            <Notice tone="info">These are plain-language summaries, not the official rulebook. Competitions, age groups and leagues often modify rules — always check the current edition from the governing body or your league.</Notice>
            {hub.rulesets.map((r) => (
              <Card key={r.slug}>
                <CardTitle action={<VerificationBadge verification={r.verification} />}>{r.name}</CardTitle>
                <p className="text-xs text-muted">
                  {r.governingBody} · {r.scope} · reviewed {r.reviewedAt ? new Date(r.reviewedAt).toISOString().slice(0, 10) : "not yet"}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  {r.points.map((p) => (
                    <div key={p.topic}>
                      <dt className="font-semibold">{p.topic}</dt>
                      <dd className="text-muted">{p.text}</dd>
                    </div>
                  ))}
                </dl>
                {r.reviewFlag && (
                  <div className="mt-3">
                    <Notice tone="warn">
                      <strong>Possibly outdated.</strong> {r.reviewFlag}
                    </Notice>
                  </div>
                )}
                <p className="mt-3 text-xs italic text-subtle">{r.editionNote}</p>
                <SourceList sources={hub.sources.filter((s) => r.sources.includes(s.slug))} />
              </Card>
            ))}
          </div>
        )}
        {tab === "progress" && (
          <div className="space-y-4">
            {state && state.milestones.length > 0 && (
              <Card>
                <CardTitle icon={<Trophy className="size-4 text-accent" />}>Milestones</CardTitle>
                <ul className="space-y-2 text-sm">
                  {state.milestones.map((m) => {
                    const metric = hub.metrics.find((x) => x.key === m.metricKey);
                    return (
                      <li key={m.title} className="flex items-start gap-2">
                        <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", m.achieved ? "bg-accent text-accent-fg" : "bg-surface-3")}>{m.achieved && <Check className="size-3" />}</span>
                        <span className="flex-1">
                          {m.title} <span className="text-xs text-muted">({m.level})</span>
                          {metric && m.best != null && <span className="block text-xs text-muted">Your best: {formatMetricValue(metric, m.best)}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            <MetricPanel
              slug={slug}
              today={todayKey(profile.timezone)}
              metrics={hub.metrics.filter((m) => m.scope === "performance").map((m) => ({ key: m.key, label: m.label, kind: m.kind, unit: m.unit, options: m.options, direction: m.direction, min: m.min, max: m.max, minAttempts: m.minAttempts, description: m.description, measurement: m.measurement }))}
              entries={state?.entries ?? []}
              personalBests={state?.personalBests ?? {}}
            />
            <p className="text-xs text-subtle">
              Progress here is only what you log. Session-level details (duration, intensity{hub.metrics.some((m) => m.scope === "session") ? `, ${hub.metrics.filter((m) => m.scope === "session").map((m) => m.label.toLowerCase()).join(", ")}` : ""}) go in the <Link href={`/activity?sport=${slug}`} className="underline">activity log</Link>.
            </p>
          </div>
        )}
        {tab === "train" && <TrainTab hub={hub} />}
      </div>
    </div>
  );
}

type Hub = Awaited<ReturnType<typeof getSportHub>>;

async function Overview({ hub, userId, units }: { hub: Hub; userId: string; units: "metric" | "imperial" }) {
  const { sport, profile: info } = hub;
  const agg = await db.activityEntry.aggregate({ where: { userId, sport: sport.slug }, _count: true, _sum: { durationMin: true, distanceKm: true } });
  const next = hub.lessons.find((l) => l.slug === hub.user?.nextLesson);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="Sessions logged" value={agg._count} />
        </Card>
        <Card>
          <Stat label="Total time" value={Math.round((agg._sum.durationMin ?? 0) / 6) / 10} unit="h" />
        </Card>
        <Card>
          <Stat label={sport.distanceUnit ? "Distance" : "Lessons done"} value={sport.distanceUnit ? formatDistance(agg._sum.distanceKm ?? 0, units) : `${hub.user?.completedLessons.length ?? 0}/${hub.lessons.length}`} />
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        {sport.workoutBased ? <ButtonLink href="/today">Train today</ButtonLink> : <ButtonLink href={`/activity?sport=${sport.slug}`}>Log a session</ButtonLink>}
        {hub.drills.length > 0 && (
          <ButtonLink href={`/sports/${sport.slug}?tab=practice`} variant="secondary">
            Build a practice
          </ButtonLink>
        )}
        {next && (
          <ButtonLink href={`/sports/${sport.slug}/lessons/${next.slug}`} variant="secondary">
            Next lesson: {next.title}
          </ButtonLink>
        )}
        {sport.slug === "calisthenics" && (
          <ButtonLink href="/academy" variant="secondary">
            Calisthenics Academy
          </ButtonLink>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {(info.introduction || info.history) && (
          <Card>
            <CardTitle>About {sport.name}</CardTitle>
            {info.introduction && <p className="text-sm text-muted">{info.introduction}</p>}
            {info.history && <p className="mt-2 text-sm text-muted">{info.history}</p>}
            {info.environment && <p className="mt-2 text-xs text-subtle">Where: {info.environment}</p>}
          </Card>
        )}
        <Card>
          <CardTitle>Getting started</CardTitle>
          {info.beginner?.length ? <Section items={info.beginner} /> : <p className="text-sm text-muted">Start with short, easy sessions and build gradually. Detailed beginner guidance for this sport is still being written.</p>}
          {info.equipment?.length ? <p className="mt-3 text-xs text-muted">Equipment: {info.equipment.join(", ")}</p> : null}
        </Card>
        {info.positions?.length ? (
          <Card>
            <CardTitle>Positions</CardTitle>
            <dl className="space-y-2 text-sm">
              {info.positions.map((p) => (
                <div key={p.name}>
                  <dt className="font-semibold">{p.name}</dt>
                  <dd className="text-muted">{p.role}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
        {info.formations?.length ? (
          <Card>
            <CardTitle>Formations & systems</CardTitle>
            <dl className="space-y-2 text-sm">
              {info.formations.map((f) => (
                <div key={f.name}>
                  <dt className="font-semibold">{f.name}</dt>
                  <dd className="text-muted">{f.description}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
        {info.techniqueAreas?.length ? (
          <Card>
            <CardTitle>Technique areas</CardTitle>
            {info.techniqueAreas.map((t) => (
              <div key={t.title} className="mb-2">
                <p className="text-sm font-semibold">{t.title}</p>
                <Section items={t.points} />
              </div>
            ))}
          </Card>
        ) : null}
        {info.tactics?.length ? (
          <Card>
            <CardTitle>Tactics</CardTitle>
            {info.tactics.map((t) => (
              <div key={t.title} className="mb-2">
                <p className="text-sm font-semibold">{t.title}</p>
                <Section items={t.points} />
              </div>
            ))}
          </Card>
        ) : null}
        {info.terminology?.length ? (
          <Card>
            <CardTitle>Terminology</CardTitle>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {info.terminology.map((t) => (
                <div key={t.term}>
                  <dt className="font-semibold">{t.term}</dt>
                  <dd className="text-xs text-muted">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
        {info.templates?.length ? (
          <Card>
            <CardTitle>Session templates</CardTitle>
            <div className="space-y-3">
              {info.templates.map((t) => (
                <div key={t.title} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{t.title}</p>
                    <Badge tone="info">
                      {t.durationMin} min · {t.intensity}
                    </Badge>
                  </div>
                  <Section items={t.structure} ordered />
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        {info.externalResources?.length ? (
          <Card>
            <CardTitle>Learn with qualified instructors</CardTitle>
            <ul className="space-y-2 text-sm">
              {info.externalResources.map((r) => (
                <li key={r.label}>
                  <p className="font-semibold">{r.label}</p>
                  <p className="text-muted">{r.note}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
      {(hub.children.length > 0 || hub.parent) && (
        <Card>
          <CardTitle>Related disciplines</CardTitle>
          <div className="flex flex-wrap gap-2">
            {hub.parent && (
              <Link href={`/sports/${hub.parent.slug}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm hover:text-accent">
                ↑ {hub.parent.name}
              </Link>
            )}
            {hub.children.map((c) => (
              <Link key={c.slug} href={`/sports/${c.slug}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm hover:text-accent">
                {c.name}
              </Link>
            ))}
          </div>
        </Card>
      )}
      <p className="text-xs text-subtle">
        Energy estimates use approximate MET values ({sport.met.join(" / ")} for light / moderate / vigorous). Content last reviewed {hub.reviewedAt ? new Date(hub.reviewedAt).toISOString().slice(0, 10) : "— not yet reviewed"}.
      </p>
    </div>
  );
}

async function TrainTab({ hub }: { hub: Hub }) {
  const info = hub.profile;
  const exercises = await allExercises();
  const known = (slugs: string[] = []) => slugs.map((s) => exercises.find((e) => e.slug === s)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const tagged = info.exerciseTags?.length ? exercises.filter((e) => info.exerciseTags!.some((t) => e.sports.includes(t))).slice(0, 12) : [];
  const conditioning = known(info.conditioning?.exercises);
  const mobility = known(info.mobility?.exercises);
  const links = (list: { slug: string; name: string }[]) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((e) => (
        <Link key={e.slug} href={`/exercises/${e.slug}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm hover:text-accent">
          {e.name}
        </Link>
      ))}
    </div>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Sport-specific conditioning</CardTitle>
        <p className="text-sm text-muted">{info.conditioning?.summary ?? "General strength and aerobic fitness support every sport."}</p>
        {links(conditioning.length ? conditioning : tagged)}
      </Card>
      {(info.mobility || mobility.length > 0) && (
        <Card>
          <CardTitle>Mobility</CardTitle>
          <p className="text-sm text-muted">{info.mobility?.summary}</p>
          {links(mobility)}
        </Card>
      )}
      <Card>
        <CardTitle icon={<ShieldAlert className="size-4 text-warn" />}>Safety & injury prevention</CardTitle>
        {info.supervisionNote && <Notice tone="warn">{info.supervisionNote}</Notice>}
        <Section items={[...(info.safety ?? []), ...(info.injuryPrevention ?? [])]} empty="Warm up, progress gradually and stop if something hurts." />
        {info.ageGuidance && <p className="mt-3 text-sm"><strong>Young athletes:</strong> <span className="text-muted">{info.ageGuidance}</span></p>}
        <p className="mt-3 text-xs text-subtle">This is general guidance, not medical advice. For pain, a suspected concussion or any injury, stop and see a qualified professional.</p>
      </Card>
      {info.recovery?.length ? (
        <Card>
          <CardTitle>Recovery</CardTitle>
          <Section items={info.recovery} />
        </Card>
      ) : null}
      {info.competitionPrep?.length ? (
        <Card>
          <CardTitle>Competition preparation</CardTitle>
          <Section items={info.competitionPrep} />
        </Card>
      ) : null}
    </div>
  );
}

function Section({ title, items, ordered, empty }: { title?: string; items: string[]; ordered?: boolean; empty?: string }) {
  if (!items.length) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  const List = ordered ? "ol" : "ul";
  return (
    <div className="mt-2">
      {title && <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{title}</p>}
      <List className={cx("space-y-1 text-sm text-muted", ordered ? "list-decimal ps-5" : "list-disc ps-5")}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </List>
    </div>
  );
}
