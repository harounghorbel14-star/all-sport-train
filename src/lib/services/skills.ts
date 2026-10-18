import type { SkillProgress } from "@prisma/client";
import { db } from "../server/db";
import { badRequest, notFound } from "../server/errors";
import { SKILLS, SKILL_BY_SLUG, type SkillDef } from "../content/skills";
import { getProfile } from "./profile";
import { evaluateAchievements } from "./gamification";

type Bests = Map<string, { reps: number; seconds: number }>;

/**
 * Best reps / seconds the user has recorded per exercise (logged sets from workouts that weren't
 * discarded, or tests), for many exercises in three grouped queries instead of three per exercise.
 */
async function loadBests(userId: string, slugs: string[]): Promise<Bests> {
  const exercises = await db.exercise.findMany({ where: { slug: { in: [...new Set(slugs)] } }, select: { id: true, slug: true } });
  const ids = exercises.map((e) => e.id);
  const [sets, prs] = await Promise.all([
    db.setLog.groupBy({ by: ["exerciseId"], where: { exerciseId: { in: ids }, skipped: false, session: { userId, status: { not: "abandoned" } } }, _max: { reps: true, seconds: true } }),
    db.personalRecord.groupBy({ by: ["exerciseId", "metric"], where: { userId, exerciseId: { in: ids }, metric: { in: ["reps", "seconds"] } }, _max: { value: true } }),
  ]);
  const out: Bests = new Map();
  for (const e of exercises) {
    const set = sets.find((x) => x.exerciseId === e.id)?._max;
    const pr = (metric: string) => prs.find((x) => x.exerciseId === e.id && x.metric === metric)?._max.value ?? 0;
    out.set(e.slug, { reps: Math.max(set?.reps ?? 0, pr("reps")), seconds: Math.max(set?.seconds ?? 0, pr("seconds")) });
  }
  return out;
}

function equipmentOk(skill: SkillDef, owned: string[]) {
  return skill.equipmentAny.some((set) => set.every((e) => owned.includes(e)));
}

function buildState(skill: SkillDef, owned: string[], bests: Bests, progress: SkillProgress | null) {
  const prereqs = skill.prerequisites.map((pr) => {
    const best = bests.get(pr.exercise)?.[pr.metric] ?? 0;
    return { ...pr, best, met: best >= pr.value };
  });
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

export async function skillState(userId: string, skill: SkillDef, owned: string[]) {
  const [bests, progress] = await Promise.all([
    loadBests(userId, skill.prerequisites.map((p) => p.exercise)),
    db.skillProgress.findUnique({ where: { userId_skillSlug: { userId, skillSlug: skill.slug } } }),
  ]);
  return buildState(skill, owned, bests, progress);
}

export async function listSkills(userId: string) {
  const [p, bests, progress] = await Promise.all([
    getProfile(userId),
    loadBests(userId, SKILLS.flatMap((s) => s.prerequisites.map((pr) => pr.exercise))),
    db.skillProgress.findMany({ where: { userId } }),
  ]);
  return SKILLS.map((s) => buildState(s, p.equipment, bests, progress.find((x) => x.skillSlug === s.slug) ?? null));
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
  const prevBest = (await loadBests(userId, [step.exercise])).get(step.exercise)?.[step.target.metric] ?? 0;
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
