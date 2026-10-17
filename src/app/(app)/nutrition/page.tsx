import { requireUser } from "@/lib/auth/server";
import { todayKey } from "@/lib/domain/dates";
import { listSavedMeals, nutritionDay, nutritionWeek } from "@/lib/services/nutrition";
import { aiStatus } from "@/lib/ai/provider";
import { PageHeader } from "@/components/ui/primitives";
import { NutritionApp } from "./nutrition-app";

export const metadata = { title: "Nutrition" };

export default async function NutritionPage() {
  const { user, profile } = await requireUser();
  const today = todayKey(profile.timezone);
  const [day, week, meals] = await Promise.all([nutritionDay(user.id, today), nutritionWeek(user.id, today), listSavedMeals(user.id)]);
  return (
    <div>
      <PageHeader eyebrow="Fuel & recovery" title="Nutrition" subtitle="Log meals, track water and see trends. All values are estimates — food labels, recipes and portions vary." />
      <NutritionApp today={today} initialDay={JSON.parse(JSON.stringify(day))} initialWeek={week} initialMeals={JSON.parse(JSON.stringify(meals))} aiConfigured={aiStatus().configured} under18={profile.ageRange === "under18"} />
    </div>
  );
}
