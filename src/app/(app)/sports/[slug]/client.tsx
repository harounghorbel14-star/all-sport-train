"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Trophy } from "lucide-react";
import { api } from "@/lib/client/api";
import { DIRECTION_HINT, formatMetricValue, parseTime } from "@/lib/sport-format";
import { Badge, Button, Card, CardTitle, Field, Input, Notice, Segmented, Select, Toggle } from "@/components/ui/primitives";
import { LineChart } from "@/components/ui/charts";
import { useToast } from "@/components/ui/overlay";

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;
type Level = (typeof LEVEL_OPTIONS)[number]["value"];

interface Enrollment {
  level: string;
  position: string | null;
  supervised: boolean;
  goals: string[];
}

export function EnrollPanel({ slug, enrollment, positions, needsSupervision }: { slug: string; enrollment: Enrollment | null; positions: string[]; needsSupervision: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState<Level>((enrollment?.level as Level) ?? "beginner");
  const [position, setPosition] = useState(enrollment?.position ?? "");
  const [supervised, setSupervised] = useState(enrollment?.supervised ?? false);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/sports/${slug}`, { body: { level, position: position || null, supervised, goals: enrollment?.goals ?? [] } });
      toast(enrollment ? "Saved" : "Added to your sports");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!confirm("Remove this sport from your sports? Your logged results are kept.")) return;
    await api(`/api/sports/${slug}`, { method: "DELETE" });
    router.refresh();
  }

  if (enrollment && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="accent">In my sports</Badge>
        <span className="text-muted">
          Level: {enrollment.level}
          {enrollment.position ? ` · ${enrollment.position}` : ""} · {enrollment.supervised ? "trains with a qualified coach" : "no coach recorded"}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={leave}>
          Leave
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <CardTitle>{enrollment ? "Update your profile for this sport" : "Add to my sports"}</CardTitle>
        <Segmented label="Your level" value={level} onChange={setLevel} options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        {positions.length > 0 && (
          <Field label="Position" htmlFor="enroll-position" optional>
            <Select id="enroll-position" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">Not sure yet</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Toggle
          id="enroll-supervised"
          checked={supervised}
          onChange={setSupervised}
          label="I train with a qualified coach or club"
          description={needsSupervision ? "Partner and contact drills in this sport are only included when you train under qualified supervision." : "Unlocks drills marked as needing a coach."}
        />
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            {enrollment ? "Save" : "Add sport"}
          </Button>
          {enrollment && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

const MINUTES = [20, 30, 45, 60, 90] as const;
type Focus = "balanced" | "technique" | "tactical" | "conditioning" | "game";
type Setting = "solo" | "partner" | "team";

export function PracticeBuilder({ slug, supervised, level }: { slug: string; supervised: boolean; level: string }) {
  const router = useRouter();
  const toast = useToast();
  const [minutes, setMinutes] = useState<string>("45");
  const [focus, setFocus] = useState<Focus>("balanced");
  const [setting, setSetting] = useState<Setting>("solo");
  const [players, setPlayers] = useState(2);
  const [busy, setBusy] = useState(false);

  async function build() {
    setBusy(true);
    try {
      const r = await api<{ plan: { id: string } }>(`/api/sports/${slug}/practice`, { body: { minutes: Number(minutes), focus, setting, players: setting === "solo" ? 1 : players } });
      router.push(`/practice/${r.plan.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not build a practice", "error");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Practice builder</CardTitle>
      <p className="mb-3 text-sm text-muted">
        Builds a session from this sport&apos;s drill library at your level ({level}): warm-up, main work, cooldown. Drills above your level, needing more players, or needing a coach{supervised ? "" : " (you haven't marked that you train with one)"} are left out and listed with the reason.
      </p>
      <div className="space-y-3">
        <Segmented label="Length" value={minutes} onChange={setMinutes} options={MINUTES.map((m) => ({ value: String(m), label: `${m} min` }))} />
        <Segmented
          label="Focus"
          value={focus}
          onChange={setFocus}
          options={[
            { value: "balanced", label: "Balanced" },
            { value: "technique", label: "Technique" },
            { value: "tactical", label: "Tactics" },
            { value: "conditioning", label: "Conditioning" },
            { value: "game", label: "Game play" },
          ]}
        />
        <Segmented
          label="Who's training"
          value={setting}
          onChange={setSetting}
          options={[
            { value: "solo", label: "Just me" },
            { value: "partner", label: "With a partner" },
            { value: "team", label: "Team / group" },
          ]}
        />
        {setting !== "solo" && (
          <Field label="Number of players" htmlFor="practice-players">
            <Input id="practice-players" type="number" min={2} max={40} value={players} onChange={(e) => setPlayers(Math.max(2, Math.min(40, Number(e.target.value) || 2)))} />
          </Field>
        )}
        <Button onClick={build} loading={busy}>
          Build practice
        </Button>
      </div>
    </Card>
  );
}

interface MetricDef {
  key: string;
  label: string;
  kind: string;
  unit: string | null;
  options: string[];
  direction: string;
  min: number | null;
  max: number | null;
  minAttempts: number | null;
  description: string | null;
  measurement: string | null;
}
interface Entry {
  id: string;
  metricKey: string;
  value: number;
  made: number | null;
  attempts: number | null;
  dateKey: string;
  context: string;
  notes: string | null;
}

/** Build the request body for one metric from raw form input. Returns an error string on bad input. */
export function metricInput(m: MetricDef, raw: { value: string; made: string; attempts: string }): { value?: number; made?: number; attempts?: number } | string {
  if (m.kind === "ratio") {
    const made = Number(raw.made);
    const attempts = Number(raw.attempts);
    if (!raw.made || !raw.attempts || !Number.isInteger(made) || !Number.isInteger(attempts) || attempts < 1 || made < 0 || made > attempts) return "Enter made and attempts (made can't exceed attempts)";
    return { made, attempts };
  }
  if (m.kind === "time") {
    const s = parseTime(raw.value);
    return s == null ? "Enter a time like 75, 1:15 or 1:02:30" : { value: s };
  }
  if (!raw.value) return "Enter a value";
  const v = Number(raw.value);
  return Number.isFinite(v) ? { value: v } : "Enter a number";
}

export function MetricInputs({ m, raw, setRaw, idPrefix }: { m: MetricDef; raw: { value: string; made: string; attempts: string }; setRaw: (r: { value: string; made: string; attempts: string }) => void; idPrefix: string }) {
  if (m.kind === "ratio")
    return (
      <div className="flex gap-2">
        <Field label="Made" htmlFor={`${idPrefix}-made`}>
          <Input id={`${idPrefix}-made`} inputMode="numeric" value={raw.made} onChange={(e) => setRaw({ ...raw, made: e.target.value })} />
        </Field>
        <Field label="Attempts" htmlFor={`${idPrefix}-att`}>
          <Input id={`${idPrefix}-att`} inputMode="numeric" value={raw.attempts} onChange={(e) => setRaw({ ...raw, attempts: e.target.value })} />
        </Field>
      </div>
    );
  if (m.kind === "select")
    return (
      <Field label={m.label} htmlFor={`${idPrefix}-sel`}>
        <Select id={`${idPrefix}-sel`} value={raw.value} onChange={(e) => setRaw({ ...raw, value: e.target.value })}>
          <option value="">Choose…</option>
          {m.options.map((o, i) => (
            <option key={o} value={i + 1}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    );
  return (
    <Field label={m.kind === "time" ? "Time (s or m:ss)" : `Value${m.unit ? ` (${m.unit})` : ""}`} htmlFor={`${idPrefix}-val`}>
      <Input id={`${idPrefix}-val`} inputMode="decimal" value={raw.value} onChange={(e) => setRaw({ ...raw, value: e.target.value })} placeholder={m.kind === "time" ? "e.g. 1:15" : undefined} />
    </Field>
  );
}

const EMPTY = { value: "", made: "", attempts: "" };

export function MetricPanel({ slug, today, metrics, entries, personalBests }: { slug: string; today: string; metrics: MetricDef[]; entries: Entry[]; personalBests: Record<string, { value: number; dateKey: string } | null> }) {
  const router = useRouter();
  const toast = useToast();
  const [key, setKey] = useState(metrics[0]?.key ?? "");
  const [raw, setRaw] = useState(EMPTY);
  const [context, setContext] = useState("practice");
  const [dateKey, setDateKey] = useState(today);
  const [busy, setBusy] = useState(false);
  const m = metrics.find((x) => x.key === key);

  if (!metrics.length)
    return (
      <Card>
        <CardTitle>Performance tracking</CardTitle>
        <p className="text-sm text-muted">This sport doesn&apos;t have benchmark metrics yet. Log sessions in the activity log to track time and effort.</p>
      </Card>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!m) return;
    const input = metricInput(m, raw);
    if (typeof input === "string") return toast(input, "error");
    setBusy(true);
    try {
      const r = await api<{ personalBest: boolean; previousBest: number | null; needsMoreAttempts: number | null }>(`/api/sports/${slug}/metrics`, { body: { metricKey: m.key, ...input, context, dateKey } });
      toast(r.personalBest ? "New personal best!" : r.needsMoreAttempts ? `Saved. Personal bests need at least ${r.needsMoreAttempts} attempts.` : "Result saved");
      setRaw(EMPTY);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await api(`/api/sport-metrics/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Log a result</CardTitle>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Metric" htmlFor="metric-key">
            <Select
              id="metric-key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setRaw(EMPTY);
              }}
            >
              {metrics.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          {m && (m.measurement || m.description) && <Notice tone="info">{m.measurement ?? m.description}</Notice>}
          {m && <MetricInputs m={m} raw={raw} setRaw={setRaw} idPrefix="log" />}
          {m?.kind === "ratio" && m.minAttempts && <p className="text-xs text-subtle">Personal bests count only with {m.minAttempts}+ attempts.</p>}
          <div className="flex flex-wrap gap-2">
            <Field label="Context" htmlFor="metric-context">
              <Select id="metric-context" value={context} onChange={(e) => setContext(e.target.value)}>
                <option value="practice">Practice</option>
                <option value="test">Test / benchmark</option>
                <option value="drill">Drill</option>
                <option value="match">Match / game</option>
              </Select>
            </Field>
            <Field label="Date" htmlFor="metric-date">
              <Input id="metric-date" type="date" max={today} value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" loading={busy}>
            Save result
          </Button>
        </form>
      </Card>
      {metrics.map((x) => {
        const list = entries.filter((e) => e.metricKey === x.key);
        if (!list.length) return null;
        const pb = personalBests[x.key];
        return (
          <Card key={x.key}>
            <CardTitle action={pb ? <Badge tone="accent"><Trophy className="me-1 inline size-3" />Best {formatMetricValue(x, pb.value)}</Badge> : undefined}>{x.label}</CardTitle>
            <p className="mb-2 text-xs text-subtle">
              {list.length} entries{DIRECTION_HINT[x.direction] ? ` · ${DIRECTION_HINT[x.direction]}` : ""}
            </p>
            {list.length > 1 && x.kind !== "select" && <LineChart height={120} unit={x.kind === "time" ? "s" : x.kind === "ratio" ? "%" : (x.unit ?? "")} points={list.slice(-20).map((e) => ({ label: e.dateKey.slice(5), value: e.value }))} />}
            <ul className="mt-2 divide-y divide-line text-sm">
              {list
                .slice(-8)
                .reverse()
                .map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {formatMetricValue(x, e.value)}
                      {e.attempts != null && (
                        <span className="text-xs text-muted">
                          {" "}
                          ({e.made}/{e.attempts})
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {e.dateKey} · {e.context}
                      <button onClick={() => remove(e.id)} aria-label={`Delete ${x.label} entry from ${e.dateKey}`} className="text-subtle hover:text-danger">
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
