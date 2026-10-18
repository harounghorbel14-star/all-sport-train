"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, attempt } from "@/lib/client/api";
import { useToast } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";

export function JoinButton({ id, joined }: { id: string; joined: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={joined ? "ghost" : "primary"}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        if (await attempt(api(`/api/challenges/${id}`, { body: { join: !joined } }), toast)) router.refresh();
        setBusy(false);
      }}
    >
      {joined ? "Leave" : "Join"}
    </Button>
  );
}
