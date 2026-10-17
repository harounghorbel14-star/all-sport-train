"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { CelebrationCard } from "@/components/ui/celebration";
import { Star } from "lucide-react";

export function StartSkill({ slug, disabled }: { slug: string; disabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      disabled={disabled}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/skills/${slug}`, { method: "POST" });
          toast("Skill path started — it's now part of your sessions");
          router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : "Could not start", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {disabled ? "Locked" : "Start this skill"}
    </Button>
  );
}

export function AttemptForm({ slug, metric, target, best }: { slug: string; metric: "reps" | "seconds"; target: number; best: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  async function submit() {
    const v = Number(value);
    if (!v) return;
    setBusy(true);
    try {
      const r = await api<{ advanced: boolean; completed: boolean }>(`/api/skills/${slug}/attempt`, { body: { value: v } });
      if (r.completed) setCelebrate("Skill complete!");
      else if (r.advanced) setCelebrate("Step unlocked!");
      else toast(`Logged ${v}${metric === "seconds" ? "s" : " reps"} — keep building toward ${target}.`, "info");
      setValue("");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {celebrate && <CelebrationCard icon={<Star className="size-5" />} title={celebrate} body="Progress recorded from your logged attempt." />}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted" htmlFor={`att-${slug}`}>
          Best clean {metric === "seconds" ? "hold (s)" : "set (reps)"} today
        </label>
        <Input id={`att-${slug}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} className="h-9 w-24" />
        <Button size="sm" onClick={submit} loading={busy} disabled={!value}>
          Log attempt
        </Button>
      </div>
      {best ? <p className="text-[11px] text-subtle">Best so far on this step: {best}</p> : null}
    </div>
  );
}

export function PrereqTest({ exercise, metric }: { exercise: string; metric: "reps" | "seconds" }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <Input aria-label={`Test result (${metric})`} inputMode="numeric" placeholder={metric === "seconds" ? "sec" : "reps"} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} className="h-8 w-20 px-2 text-sm" />
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        disabled={!value}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/skills/test", { body: { exercise, metric, value: Number(value) } });
            toast("Test logged");
            router.refresh();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Could not log", "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        Log test
      </Button>
    </span>
  );
}
