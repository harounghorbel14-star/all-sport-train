"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { WEEKDAYS } from "@/lib/labels";
import { Button, Select, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function ScheduleEditor({ initial, trainingDays, sports }: { initial: Record<string, string[]>; trainingDays: number[]; sports: { slug: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sched, setSched] = useState<Record<string, string[]>>(initial);
  const [saving, setSaving] = useState(false);
  const order = [1, 2, 3, 4, 5, 6, 0];
  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { sportSchedule: sched } });
      toast("Schedule saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {order.map((d) => {
          const list = sched[String(d)] ?? [];
          return (
            <div key={d} className={cx("rounded-xl border p-2", trainingDays.includes(d) ? "border-accent/40" : "border-line")}>
              <p className="text-xs font-semibold">{WEEKDAYS[d]}</p>
              <p className="mb-1 text-[10px] text-subtle">{trainingDays.includes(d) ? "Training day" : "Rest / free"}</p>
              <ul className="space-y-1">
                {list.map((s) => (
                  <li key={s} className="flex items-center justify-between rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px]">
                    {sports.find((x) => x.slug === s)?.name}
                    <button aria-label={`Remove ${s}`} onClick={() => setSched({ ...sched, [d]: list.filter((x) => x !== s) })} className="text-subtle">×</button>
                  </li>
                ))}
              </ul>
              {list.length < 4 && (
                <Select aria-label={`Add sport on ${WEEKDAYS[d]}`} className="mt-1 h-8 px-2 text-[11px]" value="" onChange={(e) => e.target.value && setSched({ ...sched, [d]: [...list, e.target.value] })}>
                  <option value="">+ Add</option>
                  {sports.filter((s) => !list.includes(s.slug)).map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </Select>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-subtle">Plan sports around your strength sessions. Hard sport days count toward recovery — keep at least one full rest day.</p>
      <Button className="mt-3" onClick={save} loading={saving}>Save schedule</Button>
    </div>
  );
}
