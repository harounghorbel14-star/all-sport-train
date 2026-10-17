"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Badge, Button, Card, CardTitle, Field, Input, Notice, Segmented, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

interface Task {
  id: string;
  kind: string;
  topic: string;
  detail: string | null;
  status: string;
  priority: number;
  result: Record<string, unknown>;
  sport: { slug: string; name: string } | null;
}
interface Claim {
  id: string;
  topic: string;
  category: string;
  statement: string;
  status: string;
  evidence: string;
  confidence: string;
  origin: string;
  sourceRefs: { url?: string | null; title?: string; section?: string; accessed?: boolean }[];
  sport: { slug: string; name: string } | null;
}

const STATUS_TONE: Record<string, "success" | "info" | "warn" | "danger" | "neutral"> = { verified: "success", unverified: "warn", disputed: "danger", needs_review: "danger", queued: "neutral", blocked: "warn", done: "success" };

export function ResearchConsole({ aiEnabled, sports }: { aiEnabled: boolean; sports: { slug: string; name: string }[] }) {
  const [tab, setTab] = useState<"review" | "queue" | "claims" | "tools">("review");
  const [sport, setSport] = useState("");
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Research views"
          value={tab}
          onChange={setTab}
          options={[
            { value: "review", label: "Suggested changes" },
            { value: "queue", label: "Research queue" },
            { value: "claims", label: "Claims" },
            { value: "tools", label: "Tools" },
          ]}
        />
        {tab !== "tools" && (
          <Select aria-label="Filter by sport" value={sport} onChange={(e) => setSport(e.target.value)} className="h-9 w-auto text-sm">
            <option value="">All sports</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {tab === "review" && <Tasks sport={sport} status="needs_review" aiEnabled={aiEnabled} />}
      {tab === "queue" && <Tasks sport={sport} status="queued" aiEnabled={aiEnabled} />}
      {tab === "claims" && <Claims sport={sport} />}
      {tab === "tools" && <Tools aiEnabled={aiEnabled} />}
    </Card>
  );
}

function Tasks({ sport, status, aiEnabled }: { sport: string; status: string; aiEnabled: boolean }) {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const load = useCallback(() => {
    api<{ tasks: Task[] }>(`/api/admin/research/tasks?status=${status}&limit=100${sport ? `&sport=${sport}` : ""}`)
      .then((r) => setTasks(r.tasks))
      .catch((e) => toast(e instanceof Error ? e.message : "Could not load", "error"));
  }, [sport, status, toast]);
  useEffect(load, [load]);
  async function set(id: string, s: string) {
    await api(`/api/admin/research/tasks/${id}`, { body: { status: s } });
    load();
  }
  async function run(id: string) {
    const r = await api<{ ok: boolean; kept?: number; dropped?: number; reason?: string }>(`/api/admin/research/tasks/${id}/run`, { method: "POST" }).catch((e) => ({ ok: false, reason: e.message }) as { ok: false; reason: string });
    toast(r.ok ? `Saved ${r.kept} unverified claims (${r.dropped} dropped: citation not seen)` : `Research not run: ${r.reason}`, r.ok ? "success" : "error");
    load();
  }
  if (!tasks) return <p className="text-sm text-muted">Loading…</p>;
  if (!tasks.length) return <p className="text-sm text-muted">Nothing here.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {tasks.map((t) => {
        const r = t.result as { current?: string | null; suggested?: string | null; evidence?: string; sources?: { title: string; url: string | null; section?: string; accessed?: boolean }[] };
        return (
          <li key={t.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={t.priority === 1 ? "danger" : "neutral"}>P{t.priority}</Badge>
              <Badge>{t.kind.replace(/_/g, " ")}</Badge>
              <span className="font-medium">{t.topic}</span>
              {t.sport && <span className="text-muted">· {t.sport.name}</span>}
            </div>
            {t.detail && <p className="mt-1 text-xs text-muted">{t.detail}</p>}
            {(r.current || r.suggested) && (
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                {r.current && <p className="rounded-lg bg-surface-2 p-2"><span className="font-semibold">Current:</span> {r.current}</p>}
                {r.suggested && <p className="rounded-lg bg-accent-soft p-2"><span className="font-semibold">Suggested (unverified):</span> {r.suggested}</p>}
              </div>
            )}
            {r.sources?.length ? (
              <p className="mt-1 text-[11px] text-subtle">
                {r.evidence === "snippet" ? "Search snippet only — " : ""}
                {r.sources.map((s, i) => (
                  <span key={i}>
                    {i > 0 && "; "}
                    {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.title}</a> : s.title}
                    {s.section ? ` (${s.section})` : ""}
                  </span>
                ))}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {status === "queued" && aiEnabled && <Button size="sm" variant="secondary" onClick={() => run(t.id)}>Research with AI</Button>}
              <Button size="sm" variant="ghost" onClick={() => set(t.id, "done")}>{status === "needs_review" ? "Applied / resolved" : "Mark done"}</Button>
              <Button size="sm" variant="ghost" onClick={() => set(t.id, "dismissed")}>Dismiss</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Claims({ sport }: { sport: string }) {
  const toast = useToast();
  const [status, setStatus] = useState("unverified");
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [section, setSection] = useState("");
  const load = useCallback(() => {
    api<{ claims: Claim[] }>(`/api/admin/research/claims?status=${status}&limit=200${sport ? `&sport=${sport}` : ""}`)
      .then((r) => setClaims(r.claims))
      .catch((e) => toast(e instanceof Error ? e.message : "Could not load", "error"));
  }, [sport, status, toast]);
  useEffect(load, [load]);
  async function review(id: string, action: string) {
    try {
      await api(`/api/admin/research/claims/${id}`, { body: action === "verify" ? { action, checkedSourceUrl: url, checkedSection: section } : { action } });
      setVerifying(null);
      setUrl("");
      setSection("");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  }
  return (
    <div>
      <Select aria-label="Claim status" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 h-9 w-auto text-sm">
        {["unverified", "verified", "disputed", "outdated", "rejected"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Select>
      {!claims ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !claims.length ? (
        <p className="text-sm text-muted">No claims with this status.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {claims.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                <Badge>{c.category}</Badge>
                <Badge tone={c.evidence === "snippet" ? "warn" : "success"}>{c.evidence === "snippet" ? "snippet only" : c.evidence.replace("_", " ")}</Badge>
                <span className="font-medium">{c.topic}</span>
                {c.sport && <span className="text-muted">· {c.sport.name}</span>}
              </div>
              <p className="mt-1">{c.statement}</p>
              <p className="mt-1 text-[11px] text-subtle">
                {c.sourceRefs.map((s, i) => (
                  <span key={i}>
                    {i > 0 && "; "}
                    {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.title ?? s.url}</a> : s.title}
                    {s.section ? ` (${s.section})` : ""}
                    {s.accessed ? " ✓ opened" : ""}
                  </span>
                ))}
              </p>
              {c.status !== "verified" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setVerifying(verifying === c.id ? null : c.id)}>Verify…</Button>
                  <Button size="sm" variant="ghost" onClick={() => review(c.id, "dispute")}>Dispute</Button>
                  <Button size="sm" variant="ghost" onClick={() => review(c.id, "reject")}>Reject</Button>
                </div>
              )}
              {verifying === c.id && (
                <div className="mt-3 space-y-2 rounded-xl border border-line p-3">
                  <Notice tone="info">Only verify after opening the source yourself and confirming the claim. Record exactly where it is stated.</Notice>
                  <Field label="Source you opened (https URL)" htmlFor={`v-url-${c.id}`}>
                    <Input id={`v-url-${c.id}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={c.sourceRefs.find((s) => s.url)?.url ?? "https://"} />
                  </Field>
                  <Field label="Section / rule / page" htmlFor={`v-sec-${c.id}`}>
                    <Input id={`v-sec-${c.id}`} value={section} onChange={(e) => setSection(e.target.value)} />
                  </Field>
                  <Button size="sm" onClick={() => review(c.id, "verify")} disabled={!url.startsWith("https://") || !section.trim()}>Mark verified</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tools({ aiEnabled }: { aiEnabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    try {
      const r = await fn();
      toast(`${name}: ${JSON.stringify(r).slice(0, 160)}`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-5 text-sm">
      <div>
        <CardTitle>Research queue</CardTitle>
        <p className="mb-2 text-muted">Adds baseline tasks (rules verification, core and advanced topics) for every published sport that doesn&apos;t have them yet.</p>
        <Button size="sm" onClick={() => run("Queue", () => api("/api/admin/research/init-queue", { method: "POST" }))} loading={busy === "Queue"}>Fill research queue</Button>
      </div>
      <div>
        <CardTitle>Source monitoring</CardTitle>
        <p className="mb-2 text-muted">Checks 10 registered sources for changes (robots.txt respected). Changed sources flag the rulesets that cite them. Schedule <code>npm run research -- check-sources</code> weekly for the full list.</p>
        <Button size="sm" variant="secondary" onClick={() => run("Check", () => api("/api/admin/research/check-sources", { method: "POST" }))} loading={busy === "Check"}>Check sources now</Button>
      </div>
      <div>
        <CardTitle>AI web research</CardTitle>
        {aiEnabled ? (
          <p className="text-muted">Use “Research with AI” on queued tasks. Claims are kept only when their citation was returned by the search/fetch tools, and they stay unverified until reviewed.</p>
        ) : (
          <Notice tone="info">Not available: set ANTHROPIC_API_KEY on the server to let queued topics be researched with web search. Without it, import research runs below.</Notice>
        )}
      </div>
      <div>
        <CardTitle>Import a research run</CardTitle>
        <Field label="Research JSON (one sport)" htmlFor="research-json" hint="Same format as prisma/research/<date>/<sport>.json">
          <Textarea id="research-json" rows={6} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs" />
        </Field>
        <Button
          size="sm"
          className="mt-2"
          loading={busy === "Import"}
          onClick={() =>
            run("Import", async () => {
              let body: unknown;
              try {
                body = JSON.parse(json);
              } catch {
                throw new Error("Invalid JSON");
              }
              return api("/api/admin/research/import", { body });
            })
          }
        >
          Import
        </Button>
      </div>
    </div>
  );
}
