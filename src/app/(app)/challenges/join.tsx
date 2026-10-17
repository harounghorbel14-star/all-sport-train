"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";

export function JoinButton({ id, joined }: { id: string; joined: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={joined ? "ghost" : "primary"}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await api(`/api/challenges/${id}`, { body: { join: !joined } }).catch(() => undefined);
        router.refresh();
        setBusy(false);
      }}
    >
      {joined ? "Leave" : "Join"}
    </Button>
  );
}
