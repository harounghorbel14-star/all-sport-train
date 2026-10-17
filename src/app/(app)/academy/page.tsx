import Link from "next/link";
import { Check, Lock, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { listSkills } from "@/lib/services/skills";
import { SKILL_CATEGORY_LABELS, type SkillCategory } from "@/lib/content/skills";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { MeterBar } from "@/components/ui/charts";
import { cx } from "@/lib/cx";

export const metadata = { title: "Calisthenics Academy" };

const DIFF = ["", "Foundation", "Beginner", "Intermediate", "Advanced", "Elite"];

export default async function AcademyPage() {
  const { user } = await requireUser();
  const skills = await listSkills(user.id);
  const cats = Object.keys(SKILL_CATEGORY_LABELS) as SkillCategory[];
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Signature program"
        title="Calisthenics Academy"
        subtitle="Structured skill paths with prerequisites, step-by-step progressions and safety notes. Advanced skills stay locked until your logged numbers show you're ready."
      />
      {cats.map((cat) => {
        const list = skills.filter((s) => s.skill.category === cat || s.skill.alsoIn?.includes(cat));
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="num mb-3 text-2xl font-bold uppercase">
              {SKILL_CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => {
                const status = s.completed ? "done" : s.progress ? "active" : !s.hasEquipment ? "equipment" : !s.prerequisitesMet ? "locked" : "available";
                return (
                  <Link key={s.skill.slug + cat} href={`/academy/${s.skill.slug}`}>
                    <Card interactive className={cx("h-full", status === "active" && "border-accent/50")}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{s.skill.name}</p>
                        {status === "done" && <Badge tone="accent"><Check className="size-3" /> Done</Badge>}
                        {status === "active" && <Badge tone="info">In progress</Badge>}
                        {status === "locked" && <Badge><Lock className="size-3" /> Prerequisites</Badge>}
                        {status === "equipment" && <Badge tone="warn"><Wrench className="size-3" /> Equipment</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted">{s.skill.summary}</p>
                      <div className="mt-3 flex items-center gap-1" aria-label={`Difficulty ${s.skill.difficulty} of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={cx("h-1.5 w-5 rounded-full", n <= s.skill.difficulty ? "bg-accent" : "bg-surface-3")} />
                        ))}
                        <span className="ms-2 text-[11px] text-subtle">{DIFF[s.skill.difficulty]}</span>
                      </div>
                      {s.progress && <MeterBar className="mt-3" value={s.completed ? s.skill.steps.length : s.progress.stepIndex} max={s.skill.steps.length} />}
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
