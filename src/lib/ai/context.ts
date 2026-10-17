import { db } from "../server/db";
import { addDays, todayKey } from "../domain/dates";
import { SKILL_BY_SLUG } from "../content/skills";
import { getProfile, type ProfileView } from "../services/profile";
import { roadmapFor, readinessFor } from "../services/workouts";
import { nutritionDay } from "../services/nutrition";

export interface FourWeekStats {
  weeks: { start: string; workouts: number; minutes: number; sets: number; reps: number; avgRpe: number | null }[];
  totalWorkouts: number;
  planned: number;
  adherence: number;
  topExercises: { name: string; sessions: number; best: number; unit: string; first: number }[];
  painDays: number;
  avgReadiness: number | null;
}

/** Real training statistics for the last 28 days (shared by the rule-based coach and AI context). */
export async function fourWeekStats(userId: string, p: ProfileView, today: string): Promise<FourWeekStats> {
  const from = addDays(today, -27);
  const [sessions, checkIns] = await Promise.all([
    db.workoutSession.findMany({
      where: { userId, status: "completed", dateKey: { gte: from } },
      orderBy: { dateKey: "asc" },
      include: { sets: { where: { skipped: false }, include: { exercise: { select: { name: true, isTimed: true } } } } },
    }),
    db.checkIn.findMany({ where: { userId, dateKey: { gte: from } } }),
  ]);
  const weeks = [0, 1, 2, 3].map((i) => {
    const start = addDays(from, i * 7);
    const end = addDays(start, 6);
    const s = sessions.filter((x) => x.dateKey! >= start && x.dateKey! <= end);
    const rpes = s.map((x) => x.rpe).filter((x): x is number => x != null);
    return {
      start,
      workouts: s.length,
      minutes: Math.round(s.reduce((t, x) => t + (x.durationSeconds ?? 0), 0) / 60),
      sets: s.reduce((t, x) => t + x.sets.length, 0),
      reps: s.reduce((t, x) => t + x.sets.reduce((u, y) => u + (y.reps ?? 0), 0), 0),
      avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    };
  });
  const byExercise = new Map<string, { sessions: Set<string>; best: number; first: number | null; unit: string }>();
  for (const s of sessions) {
    for (const set of s.sets) {
      const v = set.exercise.isTimed ? (set.seconds ?? 0) : (set.reps ?? 0);
      const cur = byExercise.get(set.exercise.name) ?? { sessions: new Set(), best: 0, first: null, unit: set.exercise.isTimed ? "s" : "reps" };
      cur.sessions.add(s.id);
      cur.best = Math.max(cur.best, v);
      cur.first ??= v;
      byExercise.set(set.exercise.name, cur);
    }
  }
  const topExercises = [...byExercise.entries()]
    .map(([name, v]) => ({ name, sessions: v.sessions.size, best: v.best, unit: v.unit, first: v.first ?? 0 }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6);
  const planned = p.daysPerWeek * 4;
  const readiness = checkIns.map((c) => c.readiness);
  return {
    weeks,
    totalWorkouts: sessions.length,
    planned,
    adherence: planned ? Math.round((sessions.length / planned) * 100) : 0,
    topExercises,
    painDays: checkIns.filter((c) => c.pain).length,
    avgReadiness: readiness.length ? Math.round(readiness.reduce((a, b) => a + b, 0) / readiness.length) : null,
  };
}

/** Compact, factual context for the AI model. No secrets, no raw media. */
export async function buildCoachContext(userId: string) {
  const p = await getProfile(userId);
  const today = todayKey(p.timezone);
  const [roadmap, readiness, stats, skills] = await Promise.all([
    roadmapFor(p, today),
    readinessFor(userId, today),
    fourWeekStats(userId, p, today),
    db.skillProgress.findMany({ where: { userId }, take: 5, orderBy: { updatedAt: "desc" } }),
  ]);
  const nutrition = p.nutritionInCoach ? await nutritionDay(userId, today) : null;
  const lines = [
    `Today: ${today}. Name: ${p.displayName}. Age range: ${p.ageRange ?? "not shared"}.`,
    `Experience: ${p.experience}${p.startFromZero ? " (start-from-zero mode)" : ""}. Goals: ${p.goals.join(", ") || "none"}. Emphasis: ${p.emphasis}.`,
    `Trains ${p.daysPerWeek}×/week, ${p.sessionMinutes} min sessions, location: ${p.location}. Equipment: ${p.equipment.join(", ") || "none (bodyweight only)"}.`,
    `Limitations: ${p.limitations.join(", ") || "none reported"}${p.limitationNotes ? ` (${p.limitationNotes})` : ""}. Sports: ${p.sports.join(", ") || "none listed"}.`,
    `Roadmap: week ${roadmap.week}, phase ${roadmap.phase.index} "${roadmap.phase.name}" (${roadmap.phase.focus})${roadmap.deload ? ", deload week" : ""}.`,
    `Today's readiness: ${readiness.band ?? "no check-in yet"}.`,
    `Last 4 weeks: ${stats.totalWorkouts} workouts of ~${stats.planned} planned (${stats.adherence}% adherence). Weekly workouts: ${stats.weeks.map((w) => w.workouts).join("/")}. Pain reported on ${stats.painDays} day(s). Avg readiness: ${stats.avgReadiness ?? "n/a"}.`,
    `Most-trained exercises: ${stats.topExercises.map((e) => `${e.name} (${e.sessions} sessions, first ${e.first}${e.unit} → best ${e.best}${e.unit})`).join("; ") || "none yet"}.`,
    `Academy skills: ${skills.map((s) => `${SKILL_BY_SLUG.get(s.skillSlug)?.name ?? s.skillSlug} step ${s.stepIndex + 1}${s.unlockedAt ? " (completed)" : ""}`).join("; ") || "none started"}.`,
  ];
  if (nutrition) {
    lines.push(`Nutrition today (user enabled sharing): ${nutrition.summary.total.kcal} kcal logged, ${nutrition.summary.total.proteinG} g protein; goal ${nutrition.goals.kcal ?? "not set"} kcal. Diet prefs: ${p.dietPrefs.join(", ") || "none"}; allergies: ${p.allergies.join(", ") || "none"}.`);
  } else {
    lines.push(`Nutrition context: not shared by the user. Diet prefs: ${p.dietPrefs.join(", ") || "none"}; allergies: ${p.allergies.join(", ") || "none"}.`);
  }
  return { profile: p, today, roadmap, readiness, stats, text: lines.join("\n") };
}
