import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { allExercises } from "@/lib/services/exercises";
import { db } from "@/lib/server/db";
import { Card, CardTitle, PageHeader, Stat } from "@/components/ui/primitives";
import { ExerciseAdmin } from "./form";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const { user } = await requireUser();
  if (user.role !== "admin") redirect("/today");
  const [exercises, users, reports] = await Promise.all([allExercises(), db.user.count(), db.report.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 20 })]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Admin" subtitle="Manage the exercise library and review community reports." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><Stat label="Users" value={users} /></Card>
        <Card><Stat label="Exercises" value={exercises.length} hint={`${exercises.filter((e) => e.isCustom).length} custom`} /></Card>
        <Card><Stat label="Open reports" value={reports.length} /></Card>
      </div>
      <Card>
        <CardTitle>Add or update an exercise</CardTitle>
        <ExerciseAdmin existing={exercises.map((e) => ({ slug: e.slug, name: e.name, isCustom: e.isCustom }))} />
      </Card>
      <Card>
        <CardTitle>Open reports</CardTitle>
        {reports.length === 0 ? <p className="text-sm text-muted">No open reports.</p> : (
          <ul className="space-y-2 text-sm">{reports.map((r) => <li key={r.id}>{r.targetType} {r.targetId}: {r.reason}</li>)}</ul>
        )}
        <p className="mt-2 text-xs text-subtle">Content with 3+ reports is hidden automatically pending review.</p>
      </Card>
    </div>
  );
}
