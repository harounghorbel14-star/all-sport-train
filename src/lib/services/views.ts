import { allExercises } from "./exercises";

/** Minimal exercise info passed to client components (keeps payloads small). */
export async function exerciseLookup() {
  const all = await allExercises();
  return Object.fromEntries(
    all.map((e) => [
      e.slug,
      {
        name: e.name,
        primaryMuscles: e.primaryMuscles,
        equipment: e.equipment,
        isTimed: e.isTimed,
        difficulty: e.difficulty,
        movementPattern: e.movementPattern,
        steps: e.steps,
        mistakes: e.mistakes,
        cues: e.cues,
        breathing: e.breathing,
        safety: e.safety,
        holdSeconds: e.holdSeconds,
        repMin: e.repMin,
        repMax: e.repMax,
        met: e.met,
      },
    ]),
  );
}
export type ExerciseLookup = Awaited<ReturnType<typeof exerciseLookup>>;
export type ExerciseInfo = ExerciseLookup[string];
