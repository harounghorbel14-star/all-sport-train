import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, Clock, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { getSkill } from "@/lib/services/skills";
import { SKILL_BY_SLUG } from "@/lib/content/skills";
import { EQUIPMENT_LABELS } from "@/lib/content/exercises";
import { exerciseLookup } from "@/lib/services/views";
import { Badge, Card, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { cx } from "@/lib/cx";
import { AttemptForm, PrereqTest, StartSkill } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: SKILL_BY_SLUG.get((await params).slug)?.name ?? "Skill" };
}

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SKILL_BY_SLUG.has(slug)) notFound();
  const { user } = await requireUser();
  const [state, lookup] = await Promise.all([getSkill(user.id, slug), exerciseLookup()]);
  const { skill, progress } = state;
  const current = progress?.unlockedAt ? skill.steps.length : (progress?.stepIndex ?? -1);
  const equipText = skill.equipmentAny.map((set) => (set.length ? set.map((e) => EQUIPMENT_LABELS[e]).join(" + ") : "No equipment")).join(" or ");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Difficulty ${skill.difficulty}/5`} title={skill.name} subtitle={skill.summary} action={!progress && <StartSkill slug={slug} disabled={!state.unlocked} />} />
      {!state.hasEquipment && <Notice tone="warn">Needs: {equipText}. Add it in your profile if you have access to it.</Notice>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {skill.prerequisites.length > 0 && (
            <Card>
              <CardTitle icon={<Lock className="size-4" />}>Prerequisites</CardTitle>
              <ul className="space-y-3">
                {state.prereqs.map((p) => (
                  <li key={p.label} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm">
                      {p.met ? <Check className="size-4 text-accent" /> : <span className="size-4 rounded-full border border-subtle" />}
                      {p.label}
                      <span className="text-xs text-subtle">
                        (best: {p.best || "—"}
                        {p.metric === "seconds" ? "s" : ""}
                        {p.source === "workout" ? " · logged in a workout" : p.source === "self_reported_test" ? " · self-reported test" : ""})
                      </span>
                    </span>
                    {!p.met && <PrereqTest exercise={p.exercise} metric={p.metric} />}
                  </li>
                ))}
              </ul>
              {!state.prerequisitesMet && <p className="mt-3 text-xs text-muted">Train the supporting exercises below, then log a test when you can meet each target. Attempting advanced skills too early is a common cause of injury.</p>}
            </Card>
          )}

          <Card>
            <CardTitle>Progression</CardTitle>
            <ol className="relative space-y-4 border-s border-line ps-6">
              {skill.steps.map((s, i) => {
                const st = i < current ? "done" : i === current ? "current" : "next";
                return (
                  <li key={i} className="relative">
                    <span className={cx("absolute -start-[33px] top-0.5 grid size-5 place-items-center rounded-full border-2 text-[10px] font-bold", st === "done" ? "border-accent bg-accent text-accent-fg" : st === "current" ? "border-accent bg-bg text-accent" : "border-line bg-bg text-subtle")}>
                      {st === "done" ? <Check className="size-3" /> : i + 1}
                    </span>
                    <div className={cx("rounded-xl p-3", st === "current" && "border border-accent/40 bg-accent-soft")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{s.title}</p>
                        <Badge tone={st === "current" ? "accent" : "neutral"}>
                          {s.target.sets} × {s.target.value}
                          {s.target.metric === "seconds" ? "s" : " reps"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        <Link href={`/exercises/${s.exercise}`} className="underline">
                          {lookup[s.exercise]?.name}
                        </Link>
                        {s.alternatives?.length ? <> or {s.alternatives.map((a) => lookup[a]?.name).join(", ")}</> : null} — {s.tip}
                      </p>
                      {st === "current" && (
                        <div className="mt-3">
                          <AttemptForm slug={slug} metric={s.target.metric} target={s.target.value} best={progress?.bestValue ?? null} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {progress?.unlockedAt && <Notice tone="accent">Skill path complete — fantastic work. Keep practising to maintain it.</Notice>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Supporting exercises</CardTitle>
            <ul className="space-y-2">
              {skill.supporting.map((s) => (
                <li key={s}>
                  <Link href={`/exercises/${s}`} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm hover:text-accent">
                    {lookup[s]?.name}
                    <span className="text-xs text-subtle">L{lookup[s]?.difficulty}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>Common errors</CardTitle>
            <ul className="space-y-1 text-sm text-muted">
              {skill.commonErrors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle icon={<Clock className="size-4" />}>Rest & timeline</CardTitle>
            <p className="text-sm text-muted">{skill.rest}</p>
            <p className="mt-2 text-sm text-muted">{skill.typicalTimeline}</p>
            <p className="mt-2 text-xs text-subtle">Timelines vary widely with training history, bodyweight, recovery and genetics.</p>
          </Card>
          <Card>
            <CardTitle icon={<AlertTriangle className="size-4 text-warn" />}>Safety</CardTitle>
            <ul className="space-y-1 text-sm text-muted">
              {skill.safety.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
