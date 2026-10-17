"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function LessonActions({ slug, lesson, done }: { slug: string; lesson: string; done: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function set(status: "completed" | "reset") {
    setBusy(true);
    try {
      const r = await api<{ next: string | null }>(`/api/sports/${slug}/lessons/${lesson}`, { body: { status } });
      if (status === "completed") {
        toast("Lesson completed");
        router.push(r.next ? `/sports/${slug}/lessons/${r.next}` : `/sports/${slug}?tab=learn`);
      } else router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  return done ? (
    <Button variant="secondary" onClick={() => set("reset")} loading={busy}>
      Mark as not completed
    </Button>
  ) : (
    <Button onClick={() => set("completed")} loading={busy}>
      Mark lesson complete
    </Button>
  );
}
