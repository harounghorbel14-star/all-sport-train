"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";

export function ClearCoachButton({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm(t.privacy.clearConfirm)) return;
    setBusy(true);
    try {
      await api("/api/coach", { method: "DELETE" });
      toast(t.privacy.cleared);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="danger" disabled={disabled} loading={busy} icon={<Trash2 className="size-3.5" />} onClick={run}>
      {t.privacy.clearCoach}
    </Button>
  );
}
