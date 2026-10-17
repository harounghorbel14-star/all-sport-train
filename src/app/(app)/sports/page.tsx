import Link from "next/link";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { AVAILABILITY_LABELS, type Availability } from "@/lib/content/sports/types";
import { mySports, publishedSports, searchSports } from "@/lib/services/sports";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cx } from "@/lib/cx";
import { AvailabilityBadge } from "@/components/sports/badges";
import { ScheduleEditor } from "./schedule";

export const metadata = { title: "Sports" };

export default async function SportsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; availability?: string }> }) {
  const { user, profile } = await requireUser();
  const sp = await searchParams;
  const availability = sp.availability && sp.availability in AVAILABILITY_LABELS ? sp.availability : undefined;
  const q = sp.q?.slice(0, 60);
  const [{ sports, categories }, mine, all] = await Promise.all([searchSports({ q, category: sp.category, availability }), mySports(user.id), publishedSports()]);
  const wanted = new Set([...mine.map((s) => s.slug), ...profile.sports, ...Object.values(profile.sportSchedule).flat()]);
  const scheduleSports = all.filter((s) => wanted.has(s.slug)).map((s) => ({ slug: s.slug, name: s.name }));
  const filtered = Boolean(q || sp.category || availability);
  const counts = { full: all.filter((s) => s.availability === "full").length, total: all.length };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, category: sp.category, availability, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/sports?${s}` : "/sports";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Multisport"
        title="Sports"
        subtitle={`${counts.total} sports and disciplines in the catalog — ${counts.full} with a full learning system so far. The catalog keeps growing; it doesn't cover every sport in the world.`}
      />

      {mine.length > 0 && !filtered && (
        <section aria-labelledby="my-sports">
          <h2 id="my-sports" className="num mb-3 text-2xl font-bold uppercase">
            My sports
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mine.map((s) => (
              <Link key={s.slug} href={`/sports/${s.slug}`}>
                <Card interactive className="h-full">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{s.name}</p>
                    <Badge>{s.level}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{s.summary}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="catalog" className="space-y-4">
        <h2 id="catalog" className="num text-2xl font-bold uppercase">
          Catalog
        </h2>
        <form action="/sports" className="flex gap-2" role="search">
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          {availability && <input type="hidden" name="availability" value={availability} />}
          <label htmlFor="sport-q" className="sr-only">
            Search sports
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input id="sport-q" name="q" defaultValue={q} placeholder="Search sports, disciplines or aliases (e.g. soccer, muay thai)" className="h-11 w-full rounded-xl border border-line bg-surface-2 ps-9 pe-3 text-sm focus:border-accent focus:outline-none" />
          </div>
          <button type="submit" className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg">
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2" aria-label="Filter by category">
          <FilterLink href={href({ category: undefined })} active={!sp.category}>
            All categories
          </FilterLink>
          {categories.map((c) => (
            <FilterLink key={c.slug} href={href({ category: c.slug })} active={sp.category === c.slug}>
              {c.name}
            </FilterLink>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by availability">
          <FilterLink href={href({ availability: undefined })} active={!availability}>
            Any status
          </FilterLink>
          {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((a) => (
            <FilterLink key={a} href={href({ availability: a })} active={availability === a}>
              {AVAILABILITY_LABELS[a].label}
            </FilterLink>
          ))}
        </div>

        {sports.length === 0 ? (
          <EmptyState title="No sports match" body="Try another spelling or a broader category. Admins can add sports that aren't in the catalog yet." action={<Link href="/sports" className="text-sm text-accent underline">Clear filters</Link>} />
        ) : (
          categories
            .filter((c) => sports.some((s) => s.categorySlug === c.slug))
            .map((c) => (
              <div key={c.slug}>
                <h3 className="mb-1 font-semibold">{c.name}</h3>
                <p className="mb-3 text-xs text-muted">{c.description}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sports
                    .filter((s) => s.categorySlug === c.slug)
                    .map((s) => (
                      <Link key={s.slug} href={`/sports/${s.slug}`}>
                        <Card interactive className="h-full">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{s.name}</p>
                            <AvailabilityBadge availability={s.availability} />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{s.summary}</p>
                          {mine.some((m) => m.slug === s.slug) && <p className="mt-2 text-[11px] font-semibold text-accent">In my sports</p>}
                        </Card>
                      </Link>
                    ))}
                </div>
              </div>
            ))
        )}
        <Card className="text-xs text-muted">
          <ul className="space-y-1">
            {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((a) => (
              <li key={a}>
                <AvailabilityBadge availability={a} /> <span className="ms-1">{AVAILABILITY_LABELS[a].body}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card>
        <CardTitle>My weekly schedule</CardTitle>
        <ScheduleEditor initial={profile.sportSchedule} trainingDays={profile.trainingDays} sports={scheduleSports} />
        {scheduleSports.length === 0 && <p className="mt-2 text-xs text-subtle">Join a sport from the catalog to add it to your schedule.</p>}
      </Card>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "true" : undefined} className={cx("rounded-full border px-3 py-1.5 text-xs font-medium", active ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface-2 hover:border-accent")}>
      {children}
    </Link>
  );
}
