import { Award, CalendarDays, Compass, Dumbbell, Flame, Lock, Medal, Mountain, StretchHorizontal, Star, Target, Timer, Trophy, ArrowUp, Calendar, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { achievementsOverview, streakSummary, weeklyMissions } from "@/lib/services/gamification";
import { listChallenges } from "@/lib/services/challenges";
import { addDays, weekStart } from "@/lib/domain/dates";
import { Badge, Card, CardTitle, PageHeader, Stat } from "@/components/ui/primitives";
import { MeterBar, ProgressRing } from "@/components/ui/charts";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/ui/motion";
import { cx } from "@/lib/cx";
import { JoinButton } from "./join";

export const metadata = { title: "Challenges & Achievements" };

const ICONS: Record<string, typeof Flame> = { flame: Flame, calendar: Calendar, zap: Zap, "arrow-up": ArrowUp, timer: Timer, trophy: Trophy, star: Star, mountain: Mountain, dumbbell: Dumbbell, medal: Medal, stretch: StretchHorizontal, award: Award, compass: Compass };

export default async function ChallengesPage() {
  const { user, profile } = await requireUser();
  const [streak, achievements, missions, challenges] = await Promise.all([streakSummary(user.id), achievementsOverview(user.id), weeklyMissions(user.id), listChallenges(user.id)]);
  const active = new Set(streak.activeDays);
  const start = addDays(weekStart(streak.today), -7 * 15);
  const weeks = Array.from({ length: 16 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Consistency over intensity" title="Challenges" subtitle="Streaks reward showing up — rest days count, and one missed planned session per week is forgiven. Missing a day never erases your progress." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <Flame className={cx("size-10", streak.current ? "text-warn" : "text-subtle")} />
          <Stat label="Current streak" value={<AnimatedNumber value={streak.current} />} unit="days" hint={`Longest: ${streak.longest}`} />
        </Card>
        <Card><Stat label="Weekly streak" value={streak.weeklyStreak} unit="weeks" hint={`Target: ${profile.daysPerWeek} sessions/week`} /></Card>
        <Card>
          <Stat label={`Level ${streak.level.level}`} value={streak.level.title} hint={`${streak.level.xp} XP total`} />
          <MeterBar className="mt-2" value={streak.level.into} max={streak.level.needed} />
        </Card>
        <Card className="flex items-center gap-4">
          <ProgressRing value={unlocked / achievements.length} size={64} stroke={6}><span className="num text-lg font-bold">{unlocked}</span></ProgressRing>
          <Stat label="Achievements" value={`${unlocked}/${achievements.length}`} />
        </Card>
      </div>

      <Card>
        <CardTitle icon={<CalendarDays className="size-4" />}>Training calendar · 16 weeks</CardTitle>
        <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`${active.size} active days in the last 16 weeks`}>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-1">
              {w.map((d) => (
                <span key={d} title={d} className={cx("size-3.5 rounded-[4px] sm:size-4", d > streak.today ? "bg-transparent" : active.has(d) ? "bg-accent" : "bg-surface-3", d === streak.today && "ring-1 ring-fg")} />
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">Workouts, logged activities and mobility sessions all count.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Target className="size-4" />}>Weekly missions</CardTitle>
          <ul className="space-y-3">
            {missions.missions.map((m) => (
              <li key={m.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className={cx(m.done && "text-accent")}>{m.done && "✓ "}{m.title}</span>
                  <Badge tone={m.done ? "accent" : "neutral"}>+{m.xp} XP</Badge>
                </div>
                <MeterBar value={m.progress} max={m.target} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle icon={<Trophy className="size-4" />}>Monthly challenges</CardTitle>
          <ul className="space-y-4">
            {challenges.filter((c) => c.active).map((c) => (
              <li key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted">{c.description}</p>
                    <p className="mt-1 text-[11px] text-subtle">{c.daysLeft} days left · {c.participants} participant{c.participants === 1 ? "" : "s"}</p>
                  </div>
                  <JoinButton id={c.id} joined={c.joined} />
                </div>
                {c.joined && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-xs"><span>{c.progress.toLocaleString()} / {c.target.toLocaleString()}</span><span>{Math.min(100, Math.round((c.progress / c.target) * 100))}%</span></div>
                    <MeterBar value={c.progress} max={c.target} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section>
        <h2 className="num mb-3 text-2xl font-bold uppercase">Achievements</h2>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => {
            const Icon = ICONS[a.icon] ?? Award;
            const [v, t] = a.progress;
            return (
              <StaggerItem key={a.key}>
                <Card className={cx("flex h-full items-start gap-3", !a.unlockedAt && "opacity-75")}>
                  <span className={cx("grid size-12 shrink-0 place-items-center rounded-2xl", a.unlockedAt ? "bg-accent text-accent-fg" : "bg-surface-3 text-subtle")}>
                    {a.unlockedAt ? <Icon className="size-6" /> : <Lock className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-xs text-muted">{a.description}</p>
                    {a.unlockedAt ? (
                      <p className="mt-1 text-[11px] text-accent">Unlocked {new Date(a.unlockedAt).toLocaleDateString()} · +{a.xp} XP</p>
                    ) : (
                      <div className="mt-2"><MeterBar value={v} max={t} /><p className="mt-0.5 text-[10px] text-subtle">{v}/{t}</p></div>
                    )}
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>
    </div>
  );
}
