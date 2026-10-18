import { db } from "../server/db";
import { badRequest, notFound } from "../server/errors";
import { SKILLS, SKILL_BY_SLUG, type SkillDef } from "../content/skills";
import { getProfile } from "./profile";
import { evaluateAchievements } from "./gamification";

/** Best value the user has recorded for an exercise (logged sets or tests). */
async function bestFor(userId: string, slug: string, metric: "reps" | "seconds") {
  const ex = await db.exercise.findUnique({ where: { slug }, select: { id: true } });
  if (!ex) return 0;
  const [sets, pr] = await Promise.all([
    db.setLog.aggregate({ where: { exerciseId: ex.id, skipped: false, session: { userId, status: { not: "abandoned" } } }, _max: { reps: true, seconds: true } }),
    db.personalRecord.aggregate({ where: { userId, exerciseId: ex.id, metric }, _max: { value: true } }),
  ]);
  return Math.max(metric === "reps" ? (sets._max.reps ?? 0) : (sets._max.seconds ?? 0), pr._max.value ?? 0);
}

function equipmentOk(skill: SkillDef, owned: string[]) {
  return skill.equipmentAny.some((set) => set.every((e) => owned.includes(e)));
}

export async function skillState(userId: string, skill: SkillDef, owned: string[]) {
  const prereqs = await Promise.all(
    skill.prerequisites.map(async (pr) => {
      const best = await bestFor(userId, pr.exercise, pr.metric);
      return { ...pr, best, met: best >= pr.value };
    }),
  );
  const progress = await db.skillProgress.findUnique({ where: { userId_skillSlug: { userId, skillSlug: skill.slug } } });
  const hasEquipment = equipmentOk(skill, owned);
  const prerequisitesMet = prereqs.every((p) => p.met);
  return {
    skill,
    prereqs,
    prerequisitesMet,
    hasEquipment,
    unlocked: hasEquipment && prerequisitesMet,
    progress,
    nextStep: progress ? (skill.steps[progress.stepIndex] ?? null) : skill.steps[0],
    completed: !!progress?.unlockedAt,
  };
}

export async function listSkills(userId: string) {
  const p = await getProfile(userId);
  return Promise.all(SKILLS.map((s) => skillState(userId, s, p.equipment)));
}

export async function getSkill(userId: string, slug: string) {
  const skill = SKILL_BY_SLUG.get(slug);
  if (!skill) throw notFound("Skill not found");
  const p = await getProfile(userId);
  return skillState(userId, skill, p.equipment);
}

export async function startSkill(userId: string, slug: string) {
  const state = await getSkill(userId, slug);
  if (!state.hasEquipment) throw badRequest("This skill needs equipment you haven't selected in your profile.");
  if (!state.prerequisitesMet) throw badRequest("Build the prerequisites first — log a test once you can meet them.");
  return db.skillProgress.upsert({
    where: { userId_skillSlug: { userId, skillSlug: slug } },
    create: { userId, skillSlug: slug },
    update: {},
  });
}

/** Record a skill-step attempt. Advances only when the target is actually met. */
export async function logSkillAttempt(userId: string, slug: string, value: number) {
  const state = await getSkill(userId, slug);
  if (!state.progress) throw badRequest("Start this skill first");
  if (state.completed) return { advanced: false, completed: true, progress: state.progress };
  const step = state.skill.steps[state.progress.stepIndex];
  const ex = await db.exercise.findUnique({ where: { slug: step.exercise }, select: { id: true } });
  if (!ex) throw badRequest("Unknown exercise");
  const met = value >= step.target.value;
  const prevBest = await bestFor(userId, step.exercise, step.target.metric);
  if (value > prevBest) {
    await db.personalRecord.create({ data: { userId, exerciseId: ex.id, metric: step.target.metric, value } });
  }
  const isLast = state.progress.stepIndex >= state.skill.steps.length - 1;
  const progress = await db.skillProgress.update({
    where: { id: state.progress.id },
    data: {
      attempts: { increment: 1 },
      bestValue: met ? null : Math.max(state.progress.bestValue ?? 0, value),
      bestUnit: step.target.metric,
      stepIndex: met && !isLast ? state.progress.stepIndex + 1 : state.progress.stepIndex,
      unlockedAt: met && isLast ? new Date() : null,
    },
  });
  const achievements = met ? await evaluateAchievements(userId) : [];
  return { advanced: met, completed: !!progress.unlockedAt, progress, achievements, newBest: value > prevBest && prevBest > 0 };
}

/** Self-reported test for a prerequisite (e.g. "I can do 8 pull-ups"). Stored as a record, not a fabricated workout. */
export async function logPrerequisiteTest(userId: string, exerciseSlug: string, metric: "reps" | "seconds", value: number) {
  const ex = await db.exercise.findUnique({ where: { slug: exerciseSlug }, select: { id: true } });
  if (!ex) throw notFound("Exercise not found");
  const record = await db.personalRecord.create({ data: { userId, exerciseId: ex.id, metric, value } });
  await evaluateAchievements(userId);
  return record;
}
