import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { profileView } from "@/lib/services/profile";
import { OnboardingWizard } from "./wizard";
import { publishedSports } from "@/lib/services/sports";

export const metadata = { title: "Set up your plan" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await currentUser();
  if (!user?.profile) redirect("/login");
  const { edit } = await searchParams;
  if (user.profile.onboardingCompleted && !edit) redirect("/today");
  const p = profileView(user.profile);
  const initial = user.profile.onboardingCompleted
    ? {
        experience: p.experience === "zero" ? "beginner" : p.experience,
        startFromZero: p.startFromZero,
        goals: p.goals,
        emphasis: p.emphasis,
        sports: p.sports,
        location: p.location,
        equipment: p.equipment,
        daysPerWeek: p.daysPerWeek,
        trainingDays: p.trainingDays,
        sessionMinutes: p.sessionMinutes,
        activityLevel: p.activityLevel,
        ageRange: p.ageRange ?? "",
        sex: p.sex ?? "",
        limitations: p.limitations,
        limitationNotes: p.limitationNotes ?? "",
        exercisePrefs: p.exercisePrefs,
        dietPrefs: p.dietPrefs,
        allergies: p.allergies.join(", "),
        height: p.heightCm ? String(p.heightCm) : "",
        weight: p.weightKg ? String(p.weightKg) : "",
      }
    : undefined;
  return (
    <main id="main" className="relative min-h-dvh overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 start-1/2 h-96 w-[800px] -translate-x-1/2 rounded-full bg-accent/10 blur-[110px]" />
      <div className="relative">
        <OnboardingWizard name={p.displayName} initial={initial} sports={(await publishedSports()).filter((x) => !x.parentSlug).map((x) => ({ slug: x.slug, name: x.name }))} />
      </div>
    </main>
  );
}
