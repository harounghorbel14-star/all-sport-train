import { requireUser } from "@/lib/auth/server";
import { searchExercises } from "@/lib/services/exercises";
import { sportOptions } from "@/lib/services/sports";
import { PageHeader } from "@/components/ui/primitives";
import { ExerciseBrowser } from "./browser";

export const metadata = { title: "Exercise Library" };

export default async function ExercisesPage() {
  const { user, profile } = await requireUser();
  const [all, sports] = await Promise.all([searchExercises({}, user.id), sportOptions()]);
  const tagged = new Set(all.flatMap((e) => e.sports));
  return (
    <div>
      <PageHeader eyebrow={`${all.length} exercises`} title="Exercise Library" subtitle="Technique, breathing, common mistakes and progressions for every movement." />
      <ExerciseBrowser
        exercises={all.map((e) => ({ slug: e.slug, name: e.name, description: e.description, primaryMuscles: e.primaryMuscles, secondaryMuscles: e.secondaryMuscles, movementPattern: e.movementPattern, difficulty: e.difficulty, equipment: e.equipment, sports: e.sports, locations: e.locations, category: e.category, favorite: e.favorite }))}
        ownedEquipment={profile.equipment}
        sports={sports.filter((s) => tagged.has(s.slug))}
      />
    </div>
  );
}
