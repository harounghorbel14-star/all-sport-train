import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getPlan, activeSession } from "@/lib/services/workouts";
import { exerciseLookup } from "@/lib/services/views";
import { AppError } from "@/lib/server/errors";
import { PlanEditor } from "./editor";
import { SaveOffline } from "@/components/pwa/save-offline";

export const metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const { id } = await params;
  try {
    const [{ plan, workout }, lookup, active] = await Promise.all([getPlan(user.id, id), exerciseLookup(), activeSession(user.id)]);
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <SaveOffline url={`/workout/${plan.id}`} title={workout.title} kind="plan" />
        </div>
        <PlanEditor planId={plan.id} status={plan.status} initial={workout} lookup={lookup} activeSessionId={active?.planId === plan.id ? active.id : null} otherActive={!!active && active.planId !== plan.id} />
      </div>
    );
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
