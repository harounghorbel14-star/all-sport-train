import { PrismaClient } from "@prisma/client";
import { EXERCISE_CATALOG } from "../src/lib/content/exercises";
import { LOCAL_FOODS } from "../src/lib/content/foods";
import { exerciseToDb } from "../src/lib/server/exercise-mapper";
import { addDays, todayKey, weekStart } from "../src/lib/domain/dates";

const db = new PrismaClient();

export async function seed(client: PrismaClient = db) {
  // Exercises: upsert by slug so admin-added custom exercises are kept.
  for (const ex of EXERCISE_CATALOG) {
    const data = exerciseToDb(ex);
    await client.exercise.upsert({ where: { slug: ex.slug }, create: data, update: data });
  }

  // Local food database (shared entries have no owner).
  const existing = await client.food.count({ where: { ownerId: null, source: "local" } });
  if (existing === 0) {
    await client.food.createMany({
      data: LOCAL_FOODS.map((f) => ({
        name: f.name,
        category: f.category,
        kcalPer100g: f.kcal,
        proteinG: f.protein,
        carbsG: f.carbs,
        fatG: f.fat,
        fiberG: f.fiber ?? null,
        servings: JSON.stringify(f.servings),
        source: "local",
        isEstimate: true,
      })),
    });
  }

  // Rolling community challenges for the current and next month.
  const today = todayKey("UTC");
  const monthStart = today.slice(0, 8) + "01";
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const monthEnd = addDays(nextMonth, -1);
  const label = new Date(monthStart + "T00:00:00Z").toLocaleString("en", { month: "long", timeZone: "UTC" });
  const challenges = [
    { slug: `pushups-${monthStart}`, title: `${label} 1,000 Push-Ups`, description: "Accumulate 1,000 push-up reps (any variation) across the month. Spread it out — 35 a day gets you there.", metric: "pushup_reps", target: 1000 },
    { slug: `workouts-${monthStart}`, title: `${label} 12 Sessions`, description: "Complete 12 workouts this month. Rest days are part of the plan.", metric: "workouts", target: 12 },
    { slug: `mobility-${monthStart}`, title: `${label} Mobility Habit`, description: "Complete 10 mobility sessions this month.", metric: "mobility_sessions", target: 10 },
    { slug: `active-${monthStart}`, title: `${label} 600 Active Minutes`, description: "Log 600 minutes of any activity — training, sports, walking.", metric: "active_minutes", target: 600 },
  ];
  for (const c of challenges) {
    await client.challenge.upsert({
      where: { slug: c.slug },
      create: { ...c, startsOn: monthStart, endsOn: monthEnd },
      update: {},
    });
  }
  const ws = weekStart(today);
  return { exercises: EXERCISE_CATALOG.length, foods: LOCAL_FOODS.length, challenges: challenges.length, weekStart: ws };
}

if (process.argv[1]?.includes("seed")) {
  seed()
    .then((r) => console.log("Seed complete", r))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
