import Link from "next/link";
import { CalendarCheck, ChevronRight, Dumbbell, Flame, GraduationCap, HeartPulse, Sparkles, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { formatRecord, type Units } from "@/lib/format";
import { db } from "@/lib/server/db";
import { todayKey, weekday } from "@/lib/domain/dates";
import { formatDateKey } from "@/lib/format";
import { getDictionary, fmt } from "@/lib/i18n";
import { activeSession, getOrCreateTodayPlan, readinessFor, roadmapFor, weekPreview } from "@/lib/services/workouts";
import { streakSummary, weeklyMissions } from "@/lib/services/gamification";
import { nutritionDay } from "@/lib/services/nutrition";
import { listSkills } from "@/lib/services/skills";
import { exerciseLookup } from "@/lib/services/views";
import { READINESS_ADVICE } from "@/lib/domain/readiness";
import { ButtonLink, Card, CardTitle, Badge, Notice } from "@/components/ui/primitives";
import { cx } from "@/lib/cx";
import { MeterBar, ProgressRing } from "@/components/ui/charts";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/ui/motion";
import { WorkoutSections } from "@/components/workout/block-list";
import { CheckInCard, RegenerateButtons, StartWorkoutButton } from "./widgets";
import { CoachSuggestion } from "./recommendation";
import { RestorePlanButton } from "@/components/calendar/plan-actions";
import { nextRecommendation } from "@/lib/services/recommendation";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await requireUser();
  const t = getDictionary(profile.locale);
  const { welcome } = await searchParams;
  const today = todayKey(profile.timezone);
  const [{ plan, workout }, week, streak, missions, readiness, roadmap, nutrition, skills, active, lookup, prs, recommendation] = await Promise.all([
    getOrCreateTodayPlan(user.id),
    weekPreview(user.id),
    streakSummary(user.id),
    weeklyMissions(user.id),
    readinessFor(user.id, today),
    roadmapFor(profile, today),
    nutritionDay(user.id, today),
    listSkills(user.id),
    activeSession(user.id),
    exerciseLookup(),
    db.personalRecord.findMany({ where: { userId: user.id }, orderBy: { achievedAt: "desc" }, take: 4, include: { exercise: { select: { name: true, slug: true } } } }),
    nextRecommendation(user.id),
  ]);

  const plannedToday = profile.trainingDays.includes(weekday(today));
  const doneToday = plan.status === "completed";
  const inProgressSkill = skills.find((s) => s.progress && !s.completed);
  const nextSkill = inProgressSkill ?? skills.find((s) => s.unlocked && !s.progress);
  const advice = readiness.band ? READINESS_ADVICE[readiness.band] : null;

  // Recommended next action from real state
  let next: { title: string; body: string; href: string; icon: typeof Sparkles };
  if (!readiness.checkIn) next = { title: t.today.nextCheckIn, body: t.today.nextCheckInBody, href: "#checkin", icon: HeartPulse };
  else if (!doneToday && (plannedToday || active)) next = { title: active ? t.today.nextFinish : t.today.nextTrain, body: `${workout.title} · ~${workout.estimatedMinutes} min`, href: active ? `/live/${active.id}` : `/workout/${plan.id}`, icon: Dumbbell };
  else if (roadmap.dayInWeek >= 6) next = { title: t.today.nextReview, body: t.today.nextReviewBody, href: "/plans#review", icon: CalendarCheck };
  else if (!plannedToday) next = { title: t.today.nextRecovery, body: t.today.nextRecoveryBody, href: "/recovery", icon: HeartPulse };
  else next = { title: t.today.nextFuel, body: t.today.nextFuelBody, href: "/nutrition", icon: Sparkles };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{formatDateKey(today, profile.locale, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="num mt-1 text-4xl font-bold uppercase sm:text-5xl">{fmt(t.today.greeting, { name: profile.displayName })}</h1>
        </div>
        <Link href="/plans" className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium">
          {fmt(t.today.weekPhase, { week: roadmap.week, phase: roadmap.phase.name })}
          {roadmap.deload && <Badge tone="info">{t.today.deload}</Badge>}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </header>

      {welcome && (
        <Notice tone="accent" icon={<Sparkles className="size-4 text-accent" />}>
          <p className="font-semibold">{t.today.planReadyTitle}</p>
          <p className="text-xs text-muted">{t.today.planReadyBody}</p>
        </Notice>
      )}

      {!active && <CoachSuggestion rec={recommendation} />}

      <Stagger className="grid gap-5 lg:grid-cols-3">
        {/* Today's session */}
        <StaggerItem className="lg:col-span-2">
          <Card className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full bg-accent/10 blur-3xl" />
            <CardTitle icon={<Dumbbell className="size-4" />} action={<Link href={`/workout/${plan.id}`} className="text-xs font-semibold text-accent">{t.today.viewEdit}</Link>}>
              {t.today.todaysSession}
            </CardTitle>
            {doneToday ? (
              <div className="py-6 text-center">
                <p className="num text-4xl font-bold uppercase text-accent">{t.today.doneTitle}</p>
                <p className="mt-2 text-sm text-muted">{t.today.doneBody}</p>
              </div>
            ) : plan.status === "cancelled" && !active ? (
              <div className="py-6 text-center">
                <p className="num text-3xl font-bold uppercase">{t.today.cancelledTitle}</p>
                <p className="mt-2 text-sm text-muted">{fmt(t.today.cancelledBody, { title: workout.title })}</p>
                <div className="mt-4 flex justify-center">
                  <RestorePlanButton planId={plan.id} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="num text-3xl font-bold uppercase">{workout.title}</h2>
                    <p className="text-sm text-muted">
                      {fmt(t.today.sessionMeta, { minutes: workout.estimatedMinutes, count: workout.main.length })}
                      {!plannedToday && t.today.bonusDay}
                    </p>
                  </div>
                  {readiness.band && <Badge tone={readiness.band === "rest" ? "warn" : readiness.band === "easy" ? "info" : "accent"}>{fmt(t.today.readiness, { band: readiness.band })}</Badge>}
                </div>
                {!plannedToday && !active && <p className="mt-3 text-sm text-muted">{t.today.restBody}</p>}
                {advice && readiness.band !== "normal" && readiness.band !== "ready" && <p className="mt-2 text-xs text-muted">{advice.body}</p>}
                <div className="mt-2">
                  <WorkoutSections workout={{ ...workout, warmup: [], cooldown: [] }} lookup={lookup} compact />
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <StartWorkoutButton planId={plan.id} activeSessionId={active?.id} label={!plannedToday && !active ? t.today.trainAnyway : undefined} />
                  {!active && plan.status === "planned" && <RegenerateButtons />}
                </div>
              </>
            )}
          </Card>
        </StaggerItem>

        {/* Streak & level */}
        <StaggerItem>
          <Card className="h-full">
            <CardTitle icon={<Flame className="size-4" />}>{t.today.weekly}</CardTitle>
            <div className="flex items-center gap-5">
              <ProgressRing value={streak.weekly.percent / 100} size={116} label={fmt(t.today.sessionsOfTarget, { done: streak.weekly.done, target: streak.weekly.target })}>
                <div>
                  <p className="num text-3xl font-bold">
                    {streak.weekly.done}/{streak.weekly.target}
                  </p>
                  <p className="text-[10px] uppercase text-subtle">{t.today.sessions}</p>
                </div>
              </ProgressRing>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-subtle">{t.today.streak}</p>
                  <p className="num flex items-center gap-1 text-3xl font-bold">
                    <AnimatedNumber value={streak.current} /> <Flame className={cx("size-5", streak.current ? "text-warn" : "text-subtle")} />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-subtle">{t.today.weeklyStreak}</p>
                  <p className="num text-xl font-bold">{fmt(t.today.weeksShort, { n: streak.weeklyStreak })}</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold">
                  {fmt(t.today.level, { level: streak.level.level, title: streak.level.title })}
                </span>
                <span className="text-subtle">
                  {streak.level.into}/{streak.level.needed} XP
                </span>
              </div>
              <MeterBar value={streak.level.into} max={streak.level.needed} />
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1" aria-label={t.today.thisWeek}>
              {week.map((d) => (
                <div key={d.dateKey} className="text-center">
                  <p className={cx("text-[10px]", d.isToday ? "font-bold text-accent" : "text-subtle")}>{formatDateKey(d.dateKey, profile.locale, { weekday: "narrow" })}</p>
                  <div
                    title={d.completed.join(", ") || (d.planned ? t.today.planned : t.today.rest)}
                    className={cx("mx-auto mt-1 grid size-7 place-items-center rounded-full text-[10px] font-bold", d.completed.length ? "bg-accent text-accent-fg" : d.planned ? "border border-dashed border-subtle" : "bg-surface-3")}
                  >
                    {d.completed.length ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>
            {streak.current === 0 && streak.longest > 0 && <p className="mt-3 text-xs text-muted">{t.today.streakRestart}</p>}
          </Card>
        </StaggerItem>

        {/* Next action */}
        <StaggerItem>
          <Link href={next.href} className="block h-full">
            <Card interactive className="h-full border-accent/30 bg-gradient-to-br from-accent-soft to-surface">
              <CardTitle icon={<Target className="size-4" />}>{t.today.nextAction}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-fg">
                  <next.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{next.title}</p>
                  <p className="text-xs text-muted">{next.body}</p>
                </div>
              </div>
            </Card>
          </Link>
        </StaggerItem>

        {/* Check-in */}
        <StaggerItem>
          <Card id="checkin" className="h-full">
            <CardTitle icon={<HeartPulse className="size-4" />}>{t.today.checkIn}</CardTitle>
            <CheckInCard dateKey={today} existing={readiness.checkIn} />
          </Card>
        </StaggerItem>

        {/* Roadmap */}
        <StaggerItem>
          <Card className="h-full">
            <CardTitle icon={<CalendarCheck className="size-4" />} action={<Link href="/plans" className="text-xs font-semibold text-accent">{t.common.seeAll}</Link>}>
              {t.today.roadmap}
            </CardTitle>
            <p className="num text-3xl font-bold">
              {fmt(t.today.weekOf, { week: Math.min(roadmap.week, 24) })} <span className="text-lg text-subtle">/ 24</span>
            </p>
            <p className="text-sm text-muted">
              {fmt(t.today.phase, { index: roadmap.phase.index, name: roadmap.phase.name, focus: roadmap.phase.focus })}
            </p>
            <MeterBar className="mt-3" value={roadmap.progressPercent} max={100} />
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {roadmap.phase.milestones.slice(0, 3).map((m) => (
                <li key={m} className="flex gap-2">
                  <span className="text-accent">◆</span> {m}
                </li>
              ))}
            </ul>
          </Card>
        </StaggerItem>

        {/* Skill */}
        <StaggerItem>
          <Card className="h-full">
            <CardTitle icon={<GraduationCap className="size-4" />}>{t.today.nextSkill}</CardTitle>
            {nextSkill ? (
              <Link href={`/academy/${nextSkill.skill.slug}`} className="block">
                <p className="font-semibold">{nextSkill.skill.name}</p>
                {nextSkill.nextStep && (
                  <p className="text-sm text-muted">
                    {fmt(t.today.nextStep, { title: nextSkill.nextStep.title })} — {nextSkill.nextStep.target.sets}×{nextSkill.nextStep.target.value}
                    {nextSkill.nextStep.target.metric === "seconds" ? "s" : ""}
                  </p>
                )}
                {nextSkill.progress && <MeterBar className="mt-3" value={nextSkill.progress.stepIndex} max={nextSkill.skill.steps.length} />}
              </Link>
            ) : (
              <Link href="/academy" className="text-sm text-accent">
                {t.today.academyPrompt}
              </Link>
            )}
          </Card>
        </StaggerItem>

        {/* Nutrition */}
        <StaggerItem>
          <Link href="/nutrition" className="block h-full">
            <Card interactive className="h-full">
              <CardTitle icon={<Sparkles className="size-4" />}>{t.today.nutrition}</CardTitle>
              <div className="flex items-center gap-4">
                <ProgressRing value={nutrition.goals.kcal ? nutrition.summary.total.kcal / nutrition.goals.kcal : 0} size={88} stroke={8} label={t.today.caloriesLogged}>
                  <span className="num text-lg font-bold">{nutrition.summary.total.kcal}</span>
                </ProgressRing>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted">{t.today.goal}</span> {nutrition.goals.kcal ? `~${nutrition.goals.kcal} ${t.common.kcal}` : t.today.notSet}
                  </p>
                  <p>
                    <span className="text-muted">{t.today.protein}</span> {Math.round(nutrition.summary.total.proteinG)} g{nutrition.goals.proteinG ? ` / ${nutrition.goals.proteinG} g` : ""}
                  </p>
                  <p>
                    <span className="text-muted">{t.today.water}</span> {(nutrition.waterMl / 1000).toFixed(1)} / {(nutrition.waterGoalMl / 1000).toFixed(1)} L
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </StaggerItem>

        {/* PRs */}
        <StaggerItem>
          <Card className="h-full">
            <CardTitle icon={<Trophy className="size-4" />}>{t.today.recentPrs}</CardTitle>
            {prs.length ? (
              <ul className="space-y-2">
                {prs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <Link href={`/exercises/${r.exercise.slug}`} className="truncate hover:text-accent">
                      {r.exercise.name}
                    </Link>
                    <span className="num text-lg font-bold text-accent">
                      {formatRecord(r.value, r.metric, profile.units as Units)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.today.noPrs}</p>
            )}
          </Card>
        </StaggerItem>

        {/* Missions */}
        <StaggerItem>
          <Card className="h-full">
            <CardTitle icon={<Target className="size-4" />} action={<Link href="/challenges" className="text-xs font-semibold text-accent">{t.common.seeAll}</Link>}>
              {t.today.missions}
            </CardTitle>
            <ul className="space-y-2.5">
              {missions.missions.slice(0, 4).map((m) => (
                <li key={m.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className={cx(m.done && "text-accent")}>{m.title}</span>
                    <span className="text-subtle">
                      {Math.min(m.progress, m.target)}/{m.target}
                    </span>
                  </div>
                  <MeterBar value={m.progress} max={m.target} />
                </li>
              ))}
            </ul>
          </Card>
        </StaggerItem>
      </Stagger>
      {profile.startFromZero && (
        <Card>
          <CardTitle icon={<Sparkles className="size-4" />}>{t.today.zeroGuide}</CardTitle>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li>• {fmt(t.today.zeroShort, { days: profile.daysPerWeek })}</li>
            <li>• {t.today.zeroDemo}</li>
            <li>• {t.today.zeroHabit}</li>
            <li>• {t.today.zeroReview}</li>
          </ul>
          <div className="mt-3">
            <ButtonLink href="/recovery" variant="outline" size="sm">
              {t.today.zeroMobility}
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
