"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Badge, Button, Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

type Status = "draft" | "review" | "published";
type ContentType = "sport" | "lesson" | "drill" | "ruleset";

interface SportRow {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  availability: string;
  contentStatus: string;
  isCustom: boolean;
  lessons: number;
  drills: number;
  rulesets: number;
}
interface QueueItem {
  type: ContentType;
  id: string;
  title: string;
  sport: string;
  status: string;
}
interface Source {
  slug: string;
  title: string;
  publisher: string;
  url: string | null;
  kind: string;
}
interface Detail {
  sport: {
    id: string;
    slug: string;
    name: string;
    categorySlug: string;
    parentSlug: string | null;
    summary: string;
    aliases: string[];
    availability: string;
    contentStatus: string;
    met: [number, number, number];
    distanceUnit: string | null;
    profile: Record<string, unknown>;
  };
  metrics: { key: string; label: string; kind: string; scope: string }[];
  lessons: { id: string; slug: string; title: string; level: string; contentStatus: string }[];
  drills: { id: string; slug: string; title: string; level: string; contentStatus: string }[];
  rulesets: { id: string; slug: string; name: string; verification: string; contentStatus: string; reviewedAt: string | null }[];
}

const STATUS_TONE: Record<string, "success" | "info" | "warn"> = { published: "success", review: "info", draft: "warn" };

const TEMPLATES: Record<"lesson" | "drill" | "ruleset" | "metric", unknown> = {
  lesson: {
    slug: "new-lesson",
    title: "Lesson title",
    level: "beginner",
    order: 10,
    summary: "One-sentence summary.",
    content: { objectives: ["What the learner will be able to do"], keyPoints: ["Key teaching point"], steps: ["Step 1"], mistakes: ["Common mistake"], safety: ["Safety note"] },
    prerequisites: [],
    drillSlugs: [],
    requiresSupervision: false,
    sources: ["apex-editorial"],
  },
  drill: {
    slug: "new-drill",
    title: "Drill title",
    purpose: "What this drill develops.",
    level: "beginner",
    focus: "technique",
    durationMin: 10,
    setting: "solo",
    minPlayers: 1,
    equipment: [],
    contact: "none",
    requiresSupervision: false,
    metricKey: null,
    content: { setup: ["Setup"], instructions: ["Instruction"], coachingPoints: ["Coaching point"] },
  },
  ruleset: {
    slug: "new-ruleset",
    name: "Ruleset name (edition)",
    governingBody: "Governing body",
    scope: "Which competitions this covers",
    editionNote: "Summary of the edition reviewed; rules change — check the current rulebook.",
    points: [{ topic: "Scoring", text: "Plain-language summary of the rule." }],
    verification: "unverified",
    sources: ["source-slug"],
  },
  metric: { key: "new_metric", label: "Metric label", kind: "number", scope: "performance", direction: "higher", unit: "reps", min: 0, max: 1000, measurement: "How to measure it consistently." },
};

export function SportsAdmin({ sports, queue, sources, categories }: { sports: SportRow[]; queue: QueueItem[]; sources: Source[]; categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [creating, setCreating] = useState(false);

  async function setStatus(type: ContentType, id: string, status: Status) {
    try {
      await api("/api/admin/content-status", { body: { type, id, status } });
      toast(`Moved to ${status}`);
      router.refresh();
      if (detail) await open(detail.sport.slug);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update", "error");
    }
  }

  async function open(slug: string) {
    try {
      setCreating(false);
      setDetail(await api<Detail>(`/api/admin/sports/${slug}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load", "error");
    }
  }

  const list = sports.filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.slug.includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Review queue</CardTitle>
        {queue.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting — all content is published.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {queue.map((q) => (
              <li key={`${q.type}-${q.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Badge>{q.type}</Badge> <span className="font-medium">{q.title}</span> <span className="text-muted">· {q.sport}</span> <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                </span>
                <StatusButtons status={q.status} onSet={(s) => setStatus(q.type, q.id, s)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardTitle action={<Button size="sm" onClick={() => { setDetail(null); setCreating(true); }}>New sport</Button>}>Sports</CardTitle>
          <Input aria-label="Filter sports" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <ul className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto text-sm">
            {list.map((s) => (
              <li key={s.id}>
                <button onClick={() => open(s.slug)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-surface-2">
                  <span>
                    {s.name}
                    {s.isCustom && <span className="text-xs text-subtle"> · edited</span>}
                  </span>
                  <span className="flex gap-1">
                    <Badge tone={STATUS_TONE[s.contentStatus]}>{s.contentStatus}</Badge>
                    <Badge>{s.lessons}L/{s.drills}D/{s.rulesets}R</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          {(creating || detail) && <SportForm key={detail?.sport.slug ?? "new"} detail={detail} categories={categories} sports={sports} onSaved={(slug) => { router.refresh(); open(slug); }} />}
          {detail && (
            <>
              <Card>
                <CardTitle action={<StatusButtons status={detail.sport.contentStatus} onSet={(s) => setStatus("sport", detail.sport.id, s)} />}>{detail.sport.name} content</CardTitle>
                <ContentList title="Lessons" items={detail.lessons.map((l) => ({ id: l.id, label: `${l.title} (${l.level})`, status: l.contentStatus }))} onSet={(id, s) => setStatus("lesson", id, s)} />
                <ContentList title="Drills" items={detail.drills.map((d) => ({ id: d.id, label: `${d.title} (${d.level})`, status: d.contentStatus }))} onSet={(id, s) => setStatus("drill", id, s)} />
                <ContentList title="Rulesets" items={detail.rulesets.map((r) => ({ id: r.id, label: `${r.name} · ${r.verification} · reviewed ${r.reviewedAt ? r.reviewedAt.slice(0, 10) : "never"}`, status: r.contentStatus }))} onSet={(id, s) => setStatus("ruleset", id, s)} />
                <p className="mt-3 text-xs text-muted">Metrics: {detail.metrics.map((m) => `${m.label} (${m.kind}, ${m.scope})`).join(", ") || "none"}</p>
              </Card>
              <ContentEditor slug={detail.sport.slug} onSaved={() => { router.refresh(); open(detail.sport.slug); }} />
            </>
          )}
          {!creating && !detail && (
            <Card>
              <p className="text-sm text-muted">Select a sport to edit it and manage its lessons, drills, rulesets and metrics — or create a new sport, discipline or regional variant.</p>
            </Card>
          )}
        </div>
      </div>

      <SourceForm sources={sources} onSaved={() => router.refresh()} />
    </div>
  );
}

function StatusButtons({ status, onSet }: { status: string; onSet: (s: Status) => void }) {
  return (
    <span className="flex gap-1">
      {status !== "draft" && (
        <Button size="sm" variant="ghost" onClick={() => onSet("draft")}>
          {status === "published" ? "Unpublish" : "Back to draft"}
        </Button>
      )}
      {status === "draft" && (
        <Button size="sm" variant="secondary" onClick={() => onSet("review")}>
          Send to review
        </Button>
      )}
      {status !== "published" && (
        <Button size="sm" onClick={() => onSet("published")}>
          Publish
        </Button>
      )}
    </span>
  );
}

function ContentList({ title, items, onSet }: { title: string; items: { id: string; label: string; status: string }[]; onSet: (id: string, s: Status) => void }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                {i.label} <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
              </span>
              <StatusButtons status={i.status} onSet={(s) => onSet(i.id, s)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SportForm({ detail, categories, sports, onSaved }: { detail: Detail | null; categories: { slug: string; name: string }[]; sports: SportRow[]; onSaved: (slug: string) => void }) {
  const toast = useToast();
  const s = detail?.sport;
  const [f, setF] = useState({
    slug: s?.slug ?? "",
    name: s?.name ?? "",
    categorySlug: s?.categorySlug ?? categories[0].slug,
    parentSlug: s?.parentSlug ?? "",
    summary: s?.summary ?? "",
    aliases: s?.aliases.join(", ") ?? "",
    availability: s?.availability ?? "basic",
    metLight: String(s?.met[0] ?? 3),
    metModerate: String(s?.met[1] ?? 5),
    metVigorous: String(s?.met[2] ?? 7),
    distanceUnit: s?.distanceUnit ?? "",
    profile: JSON.stringify(s?.profile ?? { beginner: ["Start with short, easy sessions."] }, null, 2),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    let profile: unknown;
    try {
      profile = JSON.parse(f.profile || "{}");
    } catch {
      return toast("Profile must be valid JSON", "error");
    }
    setBusy(true);
    try {
      await api("/api/admin/sports", {
        body: {
          slug: f.slug,
          name: f.name,
          categorySlug: f.categorySlug,
          parentSlug: f.parentSlug || null,
          summary: f.summary,
          aliases: f.aliases.split(",").map((a) => a.trim()).filter(Boolean),
          availability: f.availability,
          metLight: Number(f.metLight),
          metModerate: Number(f.metModerate),
          metVigorous: Number(f.metVigorous),
          distanceUnit: f.distanceUnit || null,
          profile,
        },
      });
      toast(s ? "Sport saved" : "Sport created as a draft — publish it when reviewed");
      onSaved(f.slug);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>{s ? `Edit ${s.name}` : "New sport, discipline or variant"}</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug" htmlFor="sf-slug" hint="lowercase, dashes; can't be changed later">
          <Input id="sf-slug" value={f.slug} onChange={set("slug")} disabled={Boolean(s)} />
        </Field>
        <Field label="Name" htmlFor="sf-name">
          <Input id="sf-name" value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Category" htmlFor="sf-cat">
          <Select id="sf-cat" value={f.categorySlug} onChange={set("categorySlug")}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Parent sport" htmlFor="sf-parent" optional hint="for disciplines and regional variants">
          <Select id="sf-parent" value={f.parentSlug} onChange={set("parentSlug")}>
            <option value="">None</option>
            {sports.filter((x) => x.slug !== f.slug).map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Availability" htmlFor="sf-av">
          <Select id="sf-av" value={f.availability} onChange={set("availability")}>
            <option value="full">Learning system available</option>
            <option value="basic">In development</option>
            <option value="external">Requires external instruction</option>
          </Select>
        </Field>
        <Field label="Aliases" htmlFor="sf-alias" optional hint="comma-separated">
          <Input id="sf-alias" value={f.aliases} onChange={set("aliases")} />
        </Field>
        <Field label="MET light / moderate / vigorous" htmlFor="sf-met1" hint="approximate Compendium values">
          <div className="flex gap-2">
            <Input id="sf-met1" aria-label="MET light" inputMode="decimal" value={f.metLight} onChange={set("metLight")} />
            <Input aria-label="MET moderate" inputMode="decimal" value={f.metModerate} onChange={set("metModerate")} />
            <Input aria-label="MET vigorous" inputMode="decimal" value={f.metVigorous} onChange={set("metVigorous")} />
          </div>
        </Field>
        <Field label="Distance unit" htmlFor="sf-dist" optional>
          <Select id="sf-dist" value={f.distanceUnit} onChange={set("distanceUnit")}>
            <option value="">No distance</option>
            <option value="km">Kilometres</option>
            <option value="m">Metres</option>
          </Select>
        </Field>
      </div>
      <Field label="Summary" htmlFor="sf-summary">
        <Textarea id="sf-summary" value={f.summary} onChange={set("summary")} maxLength={400} />
      </Field>
      <Field label="Profile (JSON)" htmlFor="sf-profile" hint="introduction, history, equipment, positions, formations, techniqueAreas, tactics, conditioning, safety, ageGuidance, supervisionNote, beginner, milestones, weeklyStructure, templates, externalResources…">
        <Textarea id="sf-profile" value={f.profile} onChange={set("profile")} rows={10} className="font-mono text-xs" />
      </Field>
      <Button className="mt-3" onClick={save} loading={busy}>
        {s ? "Save sport" : "Create draft"}
      </Button>
    </Card>
  );
}

function ContentEditor({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<keyof typeof TEMPLATES>("lesson");
  const [json, setJson] = useState(JSON.stringify(TEMPLATES.lesson, null, 2));
  const [busy, setBusy] = useState(false);
  async function save() {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      return toast("Content must be valid JSON", "error");
    }
    setBusy(true);
    try {
      await api(`/api/admin/sports/${slug}/content`, { body: { type, data } });
      toast(type === "metric" ? "Metric saved" : "Saved as draft — publish it from the list when reviewed");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardTitle>Add or update content</CardTitle>
      <p className="mb-2 text-xs text-muted">Using an existing slug updates that item and returns it to draft. Rulesets must cite at least one registered source; never enter rules you haven&apos;t checked against that source.</p>
      <Field label="Type" htmlFor="ce-type">
        <Select
          id="ce-type"
          value={type}
          onChange={(e) => {
            const t = e.target.value as keyof typeof TEMPLATES;
            setType(t);
            setJson(JSON.stringify(TEMPLATES[t], null, 2));
          }}
        >
          <option value="lesson">Lesson</option>
          <option value="drill">Drill</option>
          <option value="ruleset">Ruleset</option>
          <option value="metric">Metric</option>
        </Select>
      </Field>
      <Field label="JSON" htmlFor="ce-json">
        <Textarea id="ce-json" value={json} onChange={(e) => setJson(e.target.value)} rows={14} className="font-mono text-xs" />
      </Field>
      <Button className="mt-3" onClick={save} loading={busy}>
        Save
      </Button>
    </Card>
  );
}

function SourceForm({ sources, onSaved }: { sources: Source[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ slug: "", title: "", publisher: "", url: "", kind: "governing_body", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/sources", { body: { ...f, url: f.url || null, notes: f.notes || null } });
      toast("Source saved");
      setF({ slug: "", title: "", publisher: "", url: "", kind: "governing_body", notes: "" });
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardTitle>Source registry</CardTitle>
      <ul className="mb-4 max-h-60 space-y-1 overflow-y-auto text-sm">
        {sources.map((s) => (
          <li key={s.slug}>
            <span className="font-mono text-xs text-subtle">{s.slug}</span> — {s.title} <span className="text-muted">({s.publisher})</span>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="ms-1 text-xs text-accent underline">
                link
              </a>
            ) : (
              <span className="ms-1 text-xs text-subtle">no URL</span>
            )}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug" htmlFor="src-slug">
          <Input id="src-slug" value={f.slug} onChange={set("slug")} />
        </Field>
        <Field label="Title" htmlFor="src-title">
          <Input id="src-title" value={f.title} onChange={set("title")} />
        </Field>
        <Field label="Publisher" htmlFor="src-pub">
          <Input id="src-pub" value={f.publisher} onChange={set("publisher")} />
        </Field>
        <Field label="URL" htmlFor="src-url" optional hint="https only — only add URLs you have verified">
          <Input id="src-url" type="url" value={f.url} onChange={set("url")} />
        </Field>
        <Field label="Kind" htmlFor="src-kind">
          <Select id="src-kind" value={f.kind} onChange={set("kind")}>
            <option value="governing_body">Governing body</option>
            <option value="education">Education</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="src-notes" optional>
          <Input id="src-notes" value={f.notes} onChange={set("notes")} />
        </Field>
      </div>
      <Button className="mt-3" onClick={save} loading={busy}>
        Save source
      </Button>
    </Card>
  );
}
