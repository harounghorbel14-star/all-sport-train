import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/roles";
import { aiConfigured } from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { coverage } from "@/lib/services/research";
import { Badge, Card, CardTitle, Notice, PageHeader, Stat } from "@/components/ui/primitives";
import { AvailabilityBadge } from "@/components/sports/badges";
import { ResearchConsole } from "./console";

export const metadata = { title: "Research coverage" };

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { user } = await requireUser();
  if (!isAdmin(user)) redirect("/today");
  const sp = await searchParams;
  const [rows, sourcesTotal, sourcesOpened, sourcesBlocked] = await Promise.all([
    coverage(),
    db.contentSource.count(),
    db.contentSource.count({ where: { accessedAt: { not: null } } }),
    db.contentSource.count({ where: { checkStatus: { in: ["blocked", "robots_disallowed"] } } }),
  ]);
  const list = sp.filter === "flagged" ? rows.filter((r) => r.outdatedRules.length || r.safetyReviews) : sp.filter === "full" ? rows.filter((r) => r.availability === "full") : rows;
  const sum = (k: "claimsVerified" | "claimsAwaiting" | "tasksOpen" | "gaps") => rows.reduce((n, r) => n + r[k], 0);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Research coverage" subtitle="What has been researched, inspected, verified and published for each sport — and what is still missing. Nothing reaches users until a reviewer verifies or publishes it." />
      {sourcesOpened === 0 && (
        <Notice tone="warn">
          No source has been opened and read yet. The research imported so far comes from search-result snippets only, because this environment&apos;s network policy blocked the official sites. Treat every finding as a lead to check.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card><Stat label="Sources registered" value={sourcesTotal} /></Card>
        <Card><Stat label="Sources inspected" value={sourcesOpened} hint="actually opened" /></Card>
        <Card><Stat label="Sources blocked" value={sourcesBlocked} /></Card>
        <Card><Stat label="Verified claims" value={sum("claimsVerified")} /></Card>
        <Card><Stat label="Awaiting verification" value={sum("claimsAwaiting")} /></Card>
        <Card><Stat label="Open research tasks" value={sum("tasksOpen")} hint={`${sum("gaps")} user questions`} /></Card>
      </div>
      <Card>
        <CardTitle
          action={
            <span className="flex gap-2 text-xs">
              {[["", "All"], ["full", "Learning systems"], ["flagged", "Needs review"]].map(([k, l]) => (
                <Link key={k} href={k ? `/admin/research?filter=${k}` : "/admin/research"} className={(sp.filter ?? "") === k ? "font-semibold text-accent" : "text-muted"}>
                  {l}
                </Link>
              ))}
            </span>
          }
        >
          Coverage by sport ({list.length})
        </CardTitle>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="text-subtle">
              <tr>
                {["Sport", "Lessons", "Drills", "Rulesets (verified)", "Sources (opened/cited)", "Claims ✓ / pending", "Open tasks", "Review", "Missing", "Last research"].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.slug} className="align-top">
                  <td className="px-2 py-2">
                    <Link href={`/sports/${r.slug}`} className="font-semibold hover:text-accent">{r.name}</Link>
                    <div className="mt-1"><AvailabilityBadge availability={r.availability as "full" | "basic" | "external"} /></div>
                  </td>
                  <td className="px-2 py-2">{r.lessons}</td>
                  <td className="px-2 py-2">{r.drills}</td>
                  <td className="px-2 py-2">{r.rulesets} ({r.rulesetsVerified})</td>
                  <td className="px-2 py-2">{r.sourcesOpened}/{r.sourcesCited}</td>
                  <td className="px-2 py-2">{r.claimsVerified} / {r.claimsAwaiting}</td>
                  <td className="px-2 py-2">{r.tasksOpen}</td>
                  <td className="px-2 py-2">
                    {r.outdatedRules.map((o) => <Badge key={o.name} tone="warn">Rules may be outdated</Badge>)}
                    {r.safetyReviews > 0 && <div className="mt-1"><Badge tone="danger">{r.safetyReviews} suggestions</Badge></div>}
                  </td>
                  <td className="px-2 py-2 text-muted">{r.missing.join(", ") || "—"}</td>
                  <td className="px-2 py-2 text-muted">{r.lastResearch ? `${r.lastResearch.at?.toISOString().slice(0, 10)} · ${r.lastResearch.status}` : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ResearchConsole aiEnabled={aiConfigured()} sports={rows.map((r) => ({ slug: r.slug, name: r.name }))} />
    </div>
  );
}
