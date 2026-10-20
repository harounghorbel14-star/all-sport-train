"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, CalendarPlus, Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { fmt } from "@/lib/i18n";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";

function useRun() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(path: string, init: { method?: string; body?: unknown }, done: string, after?: (r: Record<string, unknown>) => void) {
    setBusy(true);
    try {
      const r = await api<Record<string, unknown>>(path, init);
      toast(done);
      after?.(r);
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run, t, toast };
}

/** On a workout plan: save it as a new template, or update an existing one from it. */
export function SaveAsTemplate({ planId, title, templates }: { planId: string; title: string; templates: { id: string; name: string }[] }) {
  const { busy, run, t } = useRun();
  const tt = t.templates;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(title);
  const [folder, setFolder] = useState("");
  const [replaceId, setReplaceId] = useState("");
  async function save() {
    const body = replaceId ? { planId, replaceId } : { planId, name: name.trim() || title, folder: folder.trim() || null };
    if (await run("/api/templates", { body }, replaceId ? tt.updated : tt.saved)) setOpen(false);
  }
  return (
    <>
      <Button size="sm" variant="outline" icon={<BookmarkPlus className="size-3.5" />} onClick={() => setOpen(true)}>
        {tt.save}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tt.saveTitle}>
        <div className="space-y-4">
          <p className="text-xs text-muted">{tt.saveHint}</p>
          {templates.length > 0 && (
            <Field label={tt.update} htmlFor="tpl-replace">
              <Select id="tpl-replace" value={replaceId} onChange={(e) => setReplaceId(e.target.value)}>
                <option value="">{tt.newTemplate}</option>
                {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </Field>
          )}
          {!replaceId && (
            <>
              <Field label={tt.name} htmlFor="tpl-name">
                <Input id="tpl-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={tt.folder} htmlFor="tpl-folder">
                <Input id="tpl-folder" maxLength={30} value={folder} onChange={(e) => setFolder(e.target.value)} />
              </Field>
            </>
          )}
          <Button className="w-full" loading={busy} onClick={save}>
            {tt.save}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** Schedule / rename / duplicate / delete for one template. */
export function TemplateActions({ id, name, today, restoreDays }: { id: string; name: string; today: string; restoreDays: number }) {
  const { busy, run, t, toast } = useRun();
  const tt = t.templates;
  const [sheet, setSheet] = useState<"schedule" | "rename" | null>(null);
  const [date, setDate] = useState(today);
  const [newName, setNewName] = useState(name);
  const icon = "grid size-8 place-items-center rounded-lg text-muted hover:text-accent disabled:opacity-50";
  return (
    <span className="flex items-center gap-0.5" role="group" aria-label={fmt(tt.actionsFor, { name })}>
      <button className={icon} aria-label={`${tt.schedule}: ${name}`} onClick={() => setSheet("schedule")}>
        <CalendarPlus className="size-4" />
      </button>
      <button className={icon} aria-label={`${tt.rename}: ${name}`} onClick={() => setSheet("rename")}>
        <Pencil className="size-4" />
      </button>
      <button className={icon} aria-label={`${tt.duplicate}: ${name}`} disabled={busy} onClick={() => run(`/api/templates/${id}`, { body: { action: "duplicate" } }, tt.duplicated)}>
        <Copy className="size-4" />
      </button>
      <button className={`${icon} hover:text-danger`} aria-label={`${tt.delete}: ${name}`} disabled={busy} onClick={() => confirm(fmt(tt.deleteConfirm, { days: restoreDays })) && run(`/api/templates/${id}`, { method: "DELETE" }, tt.deleted)}>
        <Trash2 className="size-4" />
      </button>
      <Sheet open={sheet === "schedule"} onClose={() => setSheet(null)} title={fmt(tt.scheduleTitle, { name })}>
        <div className="space-y-4">
          <Field label={tt.date} htmlFor={`tpl-date-${id}`}>
            <Input id={`tpl-date-${id}`} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Button
            className="w-full"
            loading={busy}
            onClick={async () => {
              const ok = await run(`/api/templates/${id}`, { body: { action: "schedule", dateKey: date } }, tt.scheduled, (r) => {
                if (r.replacedAutomatic) toast(tt.replacedToday);
                for (const w of (r.warnings as string[] | undefined) ?? []) toast(w, "error");
              });
              if (ok) setSheet(null);
            }}
          >
            {tt.scheduleConfirm}
          </Button>
        </div>
      </Sheet>
      <Sheet open={sheet === "rename"} onClose={() => setSheet(null)} title={fmt(tt.renameTitle, { name })}>
        <div className="space-y-4">
          <Field label={tt.name} htmlFor={`tpl-rename-${id}`}>
            <Input id={`tpl-rename-${id}`} maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <Button className="w-full" loading={busy} onClick={async () => (await run(`/api/templates/${id}`, { method: "PATCH", body: { name: newName.trim() } }, tt.renamed)) && setSheet(null)}>
            {tt.rename}
          </Button>
        </div>
      </Sheet>
    </span>
  );
}

export function RestoreTemplate({ id, name }: { id: string; name: string }) {
  const { busy, run, t } = useRun();
  return (
    <Button size="sm" variant="ghost" loading={busy} icon={<RotateCcw className="size-3.5" />} aria-label={`${t.templates.restore}: ${name}`} onClick={() => run(`/api/templates/${id}`, { body: { action: "restore" } }, t.templates.restored)}>
      {t.templates.restore}
    </Button>
  );
}
