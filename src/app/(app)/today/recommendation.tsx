"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, Lightbulb, TrendingUp, X } from "lucide-react";
import { api } from "@/lib/client/api";
import type { Recommendation } from "@/lib/domain/recommendation";
import { Badge, Button, Card, CardTitle, Field, Input, Notice } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";

type Rec = Recommendation & { feedback: { action: string } | null };

/** The coach's suggestion for today, with the data behind it. Nothing changes until the user accepts. */
export function CoachSuggestion({ rec }: { rec: Rec }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [modifying, setModifying] = useState(false);
  const [minutes, setMinutes] = useState(String(rec.minutes));
  const [hidden, setHidden] = useState(rec.feedback?.action === "rejected");

  async function respond(body: Record<string, unknown>, done: string) {
    setBusy(String(body.action));
    try {
      await api("/api/recommendation", { body });
      toast(done);
      if (body.action === "reject") setHidden(true);
      setModifying(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(null);
    }
  }

  if (hidden)
    return (
      <p className="text-xs text-muted">
        You dismissed today&apos;s coach suggestion.{" "}
        <button className="underline" onClick={() => setHidden(false)}>
          Show it again
        </button>
      </p>
    );

  const canApply = rec.kind === "train" || rec.kind === "recover";
  const applied = rec.feedback && rec.feedback.action !== "rejected";
  return (
    <Card>
      <CardTitle icon={<Lightbulb className="size-4 text-accent" />} action={rec.difficulty === "easier" ? <Badge tone="info">Lighter</Badge> : undefined}>
        Coach suggestion: {rec.title}
      </CardTitle>
      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Why</p>
          <ul className="list-disc space-y-1 ps-5">
            {rec.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        {rec.dataGaps.length > 0 && (
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">
              <HelpCircle className="size-3.5" /> What we don&apos;t know
            </p>
            <ul className="list-disc space-y-1 ps-5 text-xs text-muted">
              {rec.dataGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
        {rec.plateaus.map((p) => (
          <Notice key={p.slug} tone="info" icon={<TrendingUp className="size-4" />}>
            <p>{p.message}</p>
            {p.alternatives.length > 0 && (
              <p className="mt-1 text-xs">
                Options:{" "}
                {p.alternatives.map((a, i) => (
                  <span key={a.slug}>
                    {i > 0 && " · "}
                    <Link href={`/exercises/${a.slug}`} className="underline">
                      {a.name}
                    </Link>{" "}
                    ({a.why})
                  </span>
                ))}
              </p>
            )}
          </Notice>
        ))}
        {rec.prerequisites.length > 0 && (
          <Notice tone="warn">
            <p className="font-medium">Missing prerequisites</p>
            <ul className="mt-1 list-disc ps-5 text-xs">
              {rec.prerequisites.map((p) => (
                <li key={p.skill + p.label}>
                  {p.skill}: {p.label} — best {p.best || "none logged"}
                  {p.source === "self_reported_test" ? " (self-reported test)" : p.source === "workout" ? " (from a workout)" : ""}, needs {p.target}
                </li>
              ))}
            </ul>
          </Notice>
        )}
        {applied ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Check className="size-3.5 text-accent" /> Applied to today&apos;s workout ({rec.feedback!.action}).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {canApply && (
              <Button size="sm" onClick={() => respond({ action: "accept" }, "Today's workout updated")} loading={busy === "accept"}>
                Accept
              </Button>
            )}
            {canApply && (
              <Button size="sm" variant="secondary" onClick={() => setModifying(true)}>
                Modify
              </Button>
            )}
            {rec.alternatives
              .filter((a) => a.href)
              .map((a) => (
                <Link key={a.label} href={a.href!} className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-medium hover:border-accent">
                  {a.label}
                </Link>
              ))}
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => respond({ action: "reject" }, "Okay — your plan stays as it is")} loading={busy === "reject"}>
              Not today
            </Button>
          </div>
        )}
        <p className="text-[11px] text-subtle">Based only on what you&apos;ve logged. A training suggestion, not medical advice.</p>
      </div>
      <Sheet open={modifying} onClose={() => setModifying(false)} title="Modify today's suggestion">
        <div className="space-y-4">
          <Field label="Session length (minutes)" htmlFor="rec-minutes">
            <Input id="rec-minutes" type="number" min={10} max={120} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {rec.alternatives
              .filter((a) => !a.href)
              .map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant="secondary"
                  onClick={() => respond({ action: "modify", minutes: a.minutes, focus: a.focus, volumeScale: a.volumeScale ?? rec.volumeScale }, "Today's workout updated")}
                  loading={busy === "modify"}
                >
                  {a.label}
                </Button>
              ))}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const m = Math.round(Number(minutes));
              if (!Number.isFinite(m) || m < 10 || m > 120) return toast("Choose between 10 and 120 minutes", "error");
              respond({ action: "modify", minutes: m, volumeScale: rec.volumeScale }, "Today's workout updated");
            }}
            loading={busy === "modify"}
          >
            Apply
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}
