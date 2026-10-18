import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/roles";
import { CATEGORIES } from "@/lib/content/sports/types";
import { adminListContent } from "@/lib/services/sports";
import { Card, PageHeader, Stat } from "@/components/ui/primitives";
import { SportsAdmin } from "./manager";

export const metadata = { title: "Sports content" };

export default async function AdminSportsPage() {
  const { user } = await requireUser();
  if (!isAdmin(user)) redirect("/today");
  const data = await adminListContent();
  const q = data.queue;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Sports content" subtitle="Add sports, disciplines and regional variants; write lessons, drills, rules summaries and metrics; review and publish. New content is saved as a draft and stays hidden until published." />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><Stat label="Sports" value={data.sports.length} hint={`${data.sports.filter((s) => s.contentStatus === "published").length} published`} /></Card>
        <Card><Stat label="Full learning systems" value={data.sports.filter((s) => s.availability === "full").length} /></Card>
        <Card><Stat label="Awaiting review" value={q.lessons.length + q.drills.length + q.rulesets.length + q.sports.length} /></Card>
        <Card><Stat label="Sources" value={data.sources.length} /></Card>
      </div>
      <SportsAdmin
        sports={data.sports.map((s) => ({ id: s.id, slug: s.slug, name: s.name, categorySlug: s.categorySlug, availability: s.availability, contentStatus: s.contentStatus, isCustom: s.isCustom, lessons: s._count.lessons, drills: s._count.drills, rulesets: s._count.rulesets }))}
        queue={[
          ...q.sports.map((s) => ({ type: "sport" as const, id: s.id, title: s.name, sport: s.name, status: s.contentStatus })),
          ...q.lessons.map((l) => ({ type: "lesson" as const, id: l.id, title: l.title, sport: l.sport.name, status: l.contentStatus })),
          ...q.drills.map((d) => ({ type: "drill" as const, id: d.id, title: d.title, sport: d.sport.name, status: d.contentStatus })),
          ...q.rulesets.map((r) => ({ type: "ruleset" as const, id: r.id, title: r.name, sport: r.sport.name, status: r.contentStatus })),
        ]}
        sources={data.sources.map((s) => ({ slug: s.slug, title: s.title, publisher: s.publisher, url: s.url, kind: s.kind }))}
        categories={CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
