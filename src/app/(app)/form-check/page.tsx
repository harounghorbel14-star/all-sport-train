import { requireUser } from "@/lib/auth/server";
import { listFormChecks } from "@/lib/services/formcheck";
import { allExercises } from "@/lib/services/exercises";
import { aiStatus } from "@/lib/ai/provider";
import { PageHeader } from "@/components/ui/primitives";
import { FormCheckApp } from "./app";

export const metadata = { title: "Form Check AI" };

export default async function FormCheckPage() {
  const { user } = await requireUser();
  const [checks, exercises] = await Promise.all([listFormChecks(user.id), allExercises()]);
  return (
    <div>
      <PageHeader eyebrow="Technique feedback" title="Form Check AI" subtitle="Upload a photo or short video of an exercise and get movement-focused feedback that separates what's visible from what's uncertain." />
      <FormCheckApp
        aiConfigured={aiStatus().configured}
        exercises={exercises.filter((e) => e.category !== "mobility").map((e) => ({ slug: e.slug, name: e.name }))}
        history={checks.map((c) => ({ id: c.id, exerciseSlug: c.exerciseSlug, createdAt: c.createdAt.toISOString(), provider: c.provider, mediaId: c.mediaId, result: c.result as never }))}
      />
    </div>
  );
}
