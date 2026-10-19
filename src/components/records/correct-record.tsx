"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";

export interface CorrectionField {
  key: string;
  label: string;
  /** Current value in storage units (kg, cm, km, seconds…). */
  value: number | string | null;
  type?: "number" | "date" | "select";
  options?: { value: string; label: string }[];
  /** Display = stored × scale (e.g. kg → lb). Converted back before saving. */
  scale?: number;
  step?: string;
  integer?: boolean;
}

/**
 * Edit button + sheet for correcting a recorded value. The server validates the change like a new
 * entry and keeps the original values in the correction log.
 */
export function CorrectRecord({ endpoint, title, fields, label }: { endpoint: string; title: string; fields: CorrectionField[]; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = (f: CorrectionField) => (f.value == null ? "" : f.type === "number" || !f.type ? String(Math.round(Number(f.value) * (f.scale ?? 1) * 100) / 100) : String(f.value));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, shown(f)])));
  const [reason, setReason] = useState("");

  async function save() {
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = values[f.key];
      if (raw === shown(f)) continue; // unchanged
      if (f.type === "date" || f.type === "select") body[f.key] = raw;
      else if (raw.trim() === "") body[f.key] = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return toast(`${f.label}: enter a number`, "error");
        const base = n / (f.scale ?? 1);
        body[f.key] = f.integer ? Math.round(base) : Math.round(base * 1000) / 1000;
      }
    }
    if (!Object.keys(body).length) return setOpen(false);
    if (reason.trim()) body.reason = reason.trim();
    setBusy(true);
    try {
      await api(endpoint, { method: "PATCH", body });
      toast("Corrected — the original is kept in your history");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button aria-label={label} className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="space-y-4">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`fix-${f.key}`}>
              {f.type === "select" ? (
                <Select id={`fix-${f.key}`} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input id={`fix-${f.key}`} type={f.type === "date" ? "date" : "number"} step={f.step ?? "any"} inputMode={f.type === "date" ? undefined : "decimal"} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
            </Field>
          ))}
          <Field label="Reason (optional)" htmlFor="fix-reason">
            <Input id="fix-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. typo, watch stopped late" />
          </Field>
          <p className="text-xs text-muted">Your original entry is kept in your correction history.</p>
          <Button className="w-full" onClick={save} loading={busy}>
            Save correction
          </Button>
        </div>
      </Sheet>
    </>
  );
}
