import { z } from "zod";
import { db } from "../server/db";
import { badRequest, conflict, notFound } from "../server/errors";
import { parseJson } from "../server/json";
import { addDays, todayKey } from "../domain/dates";
import { EQUIPMENT } from "../content/types";
import { dateKeySchema, LOCATIONS } from "../validation";
import { getProfile } from "./profile";
import { generateForUser } from "./workouts";

const MAX_DAYS = 60;
export const travelSchema = z.object({
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  equipment: z.array(z.enum(EQUIPMENT)).max(30).default([]),
  location: z.enum(LOCATIONS).default("mixed"),
  sessionMinutes: z.number().int().min(10).max(120).optional(),
  note: z.string().trim().max(200).optional(),
});
const pairsSchema = z.array(z.object({ originalId: z.string(), replacementId: z.string() }));

function view(t: Awaited<ReturnType<typeof db.travelPeriod.findFirstOrThrow>>) {
  return { ...t, equipment: parseJson(t.equipment, z.array(z.string()), []), adapted: parseJson(t.adapted, pairsSchema, []) };
}

async function own(userId: string, id: string) {
  const t = await db.travelPeriod.findFirst({ where: { id, userId } });
  if (!t) throw notFound("Trip not found");
  return t;
}

/** Adds a trip. It can't overlap another one, end in the past, or run longer than 60 days. Session length is capped at the usual length. */
export async function createTravel(userId: string, raw: z.input<typeof travelSchema>) {
  const input = travelSchema.parse(raw);
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  if (input.endDate < input.startDate) throw badRequest("The trip must end on or after its first day");
  if (input.endDate < today) throw badRequest("That trip is already over");
  if (input.startDate > addDays(today, 365)) throw badRequest("Plan trips up to a year ahead");
  if (addDays(input.startDate, MAX_DAYS - 1) < input.endDate) throw badRequest(`Trips can be at most ${MAX_DAYS} days`);
  const overlap = await db.travelPeriod.findFirst({ where: { userId, status: "active", startDate: { lte: input.endDate }, endDate: { gte: input.startDate } } });
  if (overlap) throw conflict(`This overlaps your trip from ${overlap.startDate} to ${overlap.endDate}.`);
  const minutes = input.sessionMinutes != null ? Math.min(input.sessionMinutes, p.sessionMinutes) : null;
  return view(await db.travelPeriod.create({ data: { userId, startDate: input.startDate, endDate: input.endDate, equipment: JSON.stringify(input.equipment), location: input.location, sessionMinutes: minutes, note: input.note ?? null } }));
}

/** Current and upcoming trips, plus the last few past or cancelled ones. */
export async function listTravel(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const rows = await db.travelPeriod.findMany({ where: { userId }, orderBy: { startDate: "desc" }, take: 20 });
  const all = rows.map(view);
  return { today, current: all.filter((t) => t.status === "active" && t.endDate >= today).reverse(), past: all.filter((t) => t.status !== "active" || t.endDate < today).slice(0, 5) };
}

/**
 * What adapting a trip would change: automatic workouts already scheduled inside the trip (from today on)
 * would be regenerated for the trip's equipment and time; workouts the user created or edited are kept.
 * Nothing changes until applyTravel is called with the chosen plans.
 */
export async function previewTravel(userId: string, id: string) {
  const t = await own(userId, id);
  if (t.status !== "active") throw conflict("This trip was cancelled");
  const today = todayKey((await getProfile(userId)).timezone);
  const from = t.startDate > today ? t.startDate : today;
  const plans = await db.workoutPlan.findMany({ where: { userId, scheduledOn: { gte: from, lte: t.endDate }, status: "planned" }, orderBy: { scheduledOn: "asc" } });
  const out = [];
  for (const plan of plans) {
    if (plan.source !== "engine") {
      out.push({ planId: plan.id, dateKey: plan.scheduledOn!, current: plan.title, change: "keep" as const, reason: "You created or edited this workout, so it's kept. Check it suits your trip's equipment." });
      continue;
    }
    const { workout } = await generateForUser(userId, {}, plan.scheduledOn!);
    out.push({ planId: plan.id, dateKey: plan.scheduledOn!, current: plan.title, change: "adapt" as const, proposed: { title: workout.title, minutes: workout.estimatedMinutes, exercises: workout.main.length } });
  }
  return { trip: view(t), changes: out };
}

/** Applies the previewed changes for the chosen plans. Originals are archived (never deleted) and come back if the trip is cancelled. */
export async function applyTravel(userId: string, id: string, planIds: string[]) {
  const t = await own(userId, id);
  if (t.status !== "active") throw conflict("This trip was cancelled");
  const today = todayKey((await getProfile(userId)).timezone);
  const pairs = parseJson(t.adapted, pairsSchema, []);
  const done: { dateKey: string; title: string }[] = [];
  for (const planId of [...new Set(planIds)].slice(0, 60)) {
    const plan = await db.workoutPlan.findFirst({ where: { id: planId, userId, status: "planned", source: "engine", scheduledOn: { gte: t.startDate > today ? t.startDate : today, lte: t.endDate } } });
    if (!plan) continue; // changed since the preview (started, edited, moved): left alone
    const { workout } = await generateForUser(userId, {}, plan.scheduledOn!);
    const replacement = await db.$transaction(async (tx) => {
      await tx.workoutPlan.update({ where: { id: plan.id }, data: { status: "archived", dailyKey: null } });
      return tx.workoutPlan.create({ data: { userId, title: workout.title, focus: workout.focus, scheduledOn: plan.scheduledOn, source: "engine", content: JSON.stringify(workout) } });
    });
    pairs.push({ originalId: plan.id, replacementId: replacement.id });
    done.push({ dateKey: plan.scheduledOn!, title: workout.title });
  }
  await db.travelPeriod.update({ where: { id: t.id }, data: { adapted: JSON.stringify(pairs) } });
  return { adapted: done };
}

/**
 * Cancels a trip. Adapted workouts from today on that haven't been started or changed get their
 * originals back; anything already done during the trip stays as it happened.
 */
export async function cancelTravel(userId: string, id: string) {
  const t = await own(userId, id);
  if (t.status !== "active") return { trip: view(t), restored: 0 };
  const today = todayKey((await getProfile(userId)).timezone);
  let restored = 0;
  for (const pair of parseJson(t.adapted, pairsSchema, [])) {
    const replacement = await db.workoutPlan.findFirst({ where: { id: pair.replacementId, userId, status: "planned", source: "engine", scheduledOn: { gte: today } } });
    const original = await db.workoutPlan.findFirst({ where: { id: pair.originalId, userId, status: "archived" } });
    if (!replacement || !original) continue;
    await db.$transaction([db.workoutPlan.update({ where: { id: replacement.id }, data: { status: "archived" } }), db.workoutPlan.update({ where: { id: original.id }, data: { status: "planned" } })]);
    restored++;
  }
  return { trip: view(await db.travelPeriod.update({ where: { id: t.id }, data: { status: "cancelled" } })), restored };
}
