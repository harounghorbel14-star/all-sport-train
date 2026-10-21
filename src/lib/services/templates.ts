import { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { workoutSchema, type GeneratedWorkout } from "../engine/types";
import { getPlan, validateWorkout } from "./workouts";

const MAX_TEMPLATES = 50;
const RESTORE_DAYS = 30;
const name = z.string().trim().min(1).max(60);
// Not sent → unchanged (undefined); empty → no folder (null).
const folder = z.string().trim().max(30).nullish().transform((v) => (v === undefined ? undefined : v || null));

export const templateCreateSchema = z.union([
  z.object({ planId: z.string().max(40), name: name.optional(), folder, replaceId: z.string().max(40).optional() }),
  z.object({ workout: z.unknown(), name, folder }),
]);
export const templatePatchSchema = z
  .object({ name: name.optional(), folder, workout: z.unknown().optional() })
  .refine((v) => v.name !== undefined || v.folder !== undefined || v.workout !== undefined, "Nothing to change");

function view(t: { id: string; name: string; folder: string | null; content: string; lastUsedAt: Date | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; sourcePlanId: string | null }) {
  const workout = parseJson(t.content, workoutSchema, null as unknown as GeneratedWorkout);
  return { id: t.id, name: t.name, folder: t.folder, lastUsedAt: t.lastUsedAt, deletedAt: t.deletedAt, createdAt: t.createdAt, updatedAt: t.updatedAt, sourcePlanId: t.sourcePlanId, workout, minutes: workout?.estimatedMinutes ?? null, exercises: workout?.main.length ?? 0 };
}

async function own(userId: string, id: string, opts: { deleted?: boolean } = {}) {
  const t = await db.workoutTemplate.findFirst({ where: { id, userId, deletedAt: opts.deleted ? { not: null } : null } });
  if (!t) throw notFound("Template not found");
  return t;
}

async function assertRoom(userId: string) {
  if ((await db.workoutTemplate.count({ where: { userId, deletedAt: null } })) >= MAX_TEMPLATES) throw conflict(`You can keep up to ${MAX_TEMPLATES} templates. Delete one first.`);
}

/** Saves a workout as a template — from one of the user's plans (as last saved), or from a workout body. */
export async function createTemplate(userId: string, input: z.infer<typeof templateCreateSchema>) {
  if ("planId" in input) {
    const { plan, workout } = await getPlan(userId, input.planId);
    const valid = await validateWorkout(workout);
    if (input.replaceId) {
      // "Update template from this plan": same template, new contents.
      const t = await own(userId, input.replaceId);
      return view(await db.workoutTemplate.update({ where: { id: t.id }, data: { content: JSON.stringify(valid), sourcePlanId: plan.id, ...(input.name ? { name: input.name } : {}), ...(input.folder !== undefined ? { folder: input.folder } : {}) } }));
    }
    await assertRoom(userId);
    return view(await db.workoutTemplate.create({ data: { userId, name: input.name ?? valid.title, folder: input.folder ?? null, content: JSON.stringify(valid), sourcePlanId: plan.id } }));
  }
  await assertRoom(userId);
  const valid = await validateWorkout(input.workout);
  return view(await db.workoutTemplate.create({ data: { userId, name: input.name, folder: input.folder ?? null, content: JSON.stringify(valid) } }));
}

/** Active templates (by folder, then name) and recently deleted ones that can still be restored. Older deletions are purged. */
export async function listTemplates(userId: string) {
  const cutoff = new Date(Date.now() - RESTORE_DAYS * 86_400_000);
  await db.workoutTemplate.deleteMany({ where: { userId, deletedAt: { lt: cutoff } } });
  const rows = await db.workoutTemplate.findMany({ where: { userId }, orderBy: [{ folder: "asc" }, { name: "asc" }] });
  return { templates: rows.filter((t) => !t.deletedAt).map(view), deleted: rows.filter((t) => t.deletedAt).map(view), restoreDays: RESTORE_DAYS };
}

export async function getTemplate(userId: string, id: string) {
  return view(await own(userId, id));
}

export async function updateTemplate(userId: string, id: string, input: z.infer<typeof templatePatchSchema>) {
  const t = await own(userId, id);
  const content = input.workout !== undefined ? JSON.stringify(await validateWorkout(input.workout)) : undefined;
  return view(await db.workoutTemplate.update({ where: { id: t.id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.folder !== undefined ? { folder: input.folder } : {}), ...(content ? { content } : {}) } }));
}

export async function duplicateTemplate(userId: string, id: string) {
  const t = await own(userId, id);
  await assertRoom(userId);
  return view(await db.workoutTemplate.create({ data: { userId, name: `${t.name} (copy)`.slice(0, 60), folder: t.folder, content: t.content, sourcePlanId: t.sourcePlanId } }));
}

/** Soft delete: kept for 30 days so it can be restored. Plans already scheduled from it are unaffected. */
export async function deleteTemplate(userId: string, id: string) {
  const t = await own(userId, id);
  await db.workoutTemplate.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
}

export async function restoreTemplate(userId: string, id: string) {
  const t = await own(userId, id, { deleted: true });
  await assertRoom(userId);
  return view(await db.workoutTemplate.update({ where: { id: t.id }, data: { deletedAt: null } }));
}

/** The template's workout, re-validated (exercises may have changed since it was saved). */
export async function templateWorkout(userId: string, id: string) {
  const t = await own(userId, id);
  const workout = parseJson(t.content, z.unknown(), null);
  if (!workout) throw badRequest("This template can't be read. Save it again from a plan.");
  return { template: t, workout: await validateWorkout(workout) };
}
