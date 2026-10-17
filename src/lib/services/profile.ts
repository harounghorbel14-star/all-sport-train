import type { Profile } from "@prisma/client";
import { z } from "zod";
import { db } from "../server/db";
import { parseJson } from "../server/json";
import { notificationPrefsSchema, type OnboardingInput } from "../validation";
import { todayKey } from "../domain/dates";
import type { EngineProfile, Emphasis, Experience } from "../engine/types";
import { conflict, notFound } from "../server/errors";

const strArr = z.array(z.string());
const numArr = z.array(z.number());

export function profileView(p: Profile) {
  return {
    ...p,
    goals: parseJson(p.goals, strArr, []),
    sports: parseJson(p.sports, strArr, []),
    equipment: parseJson(p.equipment, strArr, []),
    limitations: parseJson(p.limitations, strArr, []),
    exercisePrefs: parseJson(p.exercisePrefs, strArr, []),
    dietPrefs: parseJson(p.dietPrefs, strArr, []),
    allergies: parseJson(p.allergies, strArr, []),
    trainingDays: parseJson(p.trainingDays, numArr, [1, 3, 5]),
    sportSchedule: parseJson(p.sportSchedule, z.record(z.string(), strArr), {}),
    notificationPrefs: notificationPrefsSchema.parse(parseJson(p.notificationPrefs, z.record(z.string(), z.unknown()), {})),
  };
}
export type ProfileView = ReturnType<typeof profileView>;

export async function getProfile(userId: string): Promise<ProfileView> {
  const p = await db.profile.findUnique({ where: { userId } });
  if (!p) throw notFound("Profile not found");
  return profileView(p);
}

export function toEngineProfile(p: ProfileView): EngineProfile {
  return {
    experience: p.experience as Experience,
    startFromZero: p.startFromZero,
    goals: p.goals,
    emphasis: p.emphasis as Emphasis,
    equipment: p.equipment,
    location: p.location,
    sessionMinutes: p.sessionMinutes,
    daysPerWeek: p.daysPerWeek,
    trainingDays: p.trainingDays,
    limitations: p.limitations,
    exercisePrefs: p.exercisePrefs,
  };
}

/** Distribute training days sensibly when the user didn't pick weekdays. */
export function defaultTrainingDays(daysPerWeek: number): number[] {
  const presets: Record<number, number[]> = {
    1: [3],
    2: [2, 5],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.min(7, Math.max(1, daysPerWeek))];
}

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const trainingDays = input.trainingDays.length === input.daysPerWeek ? input.trainingDays : defaultTrainingDays(input.daysPerWeek);
  const existing = await db.profile.findUnique({ where: { userId } });
  if (!existing) throw notFound("Profile not found");
  const tz = input.timezone ?? existing.timezone;
  const data = {
    ageRange: input.ageRange ?? null,
    sex: input.sex ?? null,
    experience: input.startFromZero ? "zero" : input.experience,
    startFromZero: input.startFromZero || input.experience === "zero",
    goals: JSON.stringify(input.goals),
    emphasis: input.emphasis,
    sports: JSON.stringify(input.sports),
    location: input.location,
    equipment: JSON.stringify(input.equipment),
    daysPerWeek: input.daysPerWeek,
    trainingDays: JSON.stringify([...trainingDays].sort()),
    sessionMinutes: input.sessionMinutes,
    activityLevel: input.activityLevel,
    limitations: JSON.stringify(input.limitations),
    limitationNotes: input.limitationNotes ?? null,
    exercisePrefs: JSON.stringify(input.exercisePrefs),
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    dietPrefs: JSON.stringify(input.dietPrefs),
    allergies: JSON.stringify(input.allergies),
    units: input.units ?? existing.units,
    timezone: tz,
    onboardingCompleted: true,
    programStartDate: existing.programStartDate ?? new Date(`${todayKey(tz)}T00:00:00Z`),
  };
  const updated = await db.profile.update({ where: { userId }, data });
  if (input.weightKg || input.heightCm) {
    const dk = todayKey(tz);
    const already = await db.bodyMeasurement.findFirst({ where: { userId, dateKey: dk } });
    if (!already) {
      await db.bodyMeasurement.create({
        data: { userId, dateKey: dk, weightKg: input.weightKg ?? null, heightCm: input.heightCm ?? null, milestone: "Starting point" },
      });
    }
  }
  return profileView(updated);
}

type SettingsPatch = Partial<OnboardingInput> & Record<string, unknown>;

const JSON_FIELDS = ["goals", "sports", "equipment", "limitations", "exercisePrefs", "dietPrefs", "allergies", "trainingDays"] as const;

export async function updateSettings(userId: string, patch: SettingsPatch) {
  const current = await getProfile(userId);
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if ((JSON_FIELDS as readonly string[]).includes(k)) data[k] = JSON.stringify(v);
    else if (k === "notificationPrefs") data[k] = JSON.stringify({ ...current.notificationPrefs, ...(v as object) });
    else data[k] = v;
  }
  if (typeof patch.handle === "string" && patch.handle !== current.handle) {
    const taken = await db.profile.findUnique({ where: { handle: patch.handle } });
    if (taken) throw conflict("That handle is already taken");
  }
  if (typeof patch.daysPerWeek === "number" && !patch.trainingDays) {
    data.trainingDays = JSON.stringify(defaultTrainingDays(patch.daysPerWeek));
  }
  if (patch.experience === "zero") data.startFromZero = true;
  const updated = await db.profile.update({ where: { userId }, data });
  return profileView(updated);
}

export async function uniqueHandle(base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) || "athlete";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(Math.random() * 9000 + 1000)}`;
    if (candidate.length >= 3 && !(await db.profile.findUnique({ where: { handle: candidate } }))) return candidate;
  }
  return `athlete${Date.now().toString(36)}`;
}
