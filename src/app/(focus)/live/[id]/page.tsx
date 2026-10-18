import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { completedSummary, getSession } from "@/lib/services/workouts";
import { exerciseLookup } from "@/lib/services/views";
import { AppError } from "@/lib/server/errors";
import { LiveWorkout } from "./live";

export const metadata = { title: "Live workout" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, profile } = await requireUser();
  const { id } = await params;
  let data;
  try {
    data = await getSession(user.id, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  if (data.session.status === "abandoned") redirect("/today");
  const [lookup, summary] = await Promise.all([exerciseLookup(), data.session.status === "completed" ? completedSummary(user.id, id) : null]);
  return (
    <LiveWorkout
      session={{
        id: data.session.id,
        status: data.session.status,
        startedAt: data.session.startedAt.toISOString(),
        pausedAt: data.session.pausedAt?.toISOString() ?? null,
        pausedSeconds: data.session.pausedSeconds,
        currentIndex: data.session.currentIndex,
        planId: data.session.planId,
      }}
      initialSets={data.session.sets.map((s) => ({ blockIndex: s.blockIndex, setNumber: s.setNumber, reps: s.reps, seconds: s.seconds, loadKg: s.loadKg, rpe: s.rpe, skipped: s.skipped }))}
      workout={data.workout}
      lookup={lookup}
      units={profile.units as "metric" | "imperial"}
      initialSummary={summary}
    />
  );
}
