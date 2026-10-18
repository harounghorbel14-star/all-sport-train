"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function LessonActions({ slug, lesson, state }: { slug: string; lesson: string; state: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function set(status: "in_progress" | "completed" | "reset") {
    setBusy(true);
    try {
      const r = await api<{ status: string; next: string | null }>(`/api/sports/${slug}/lessons/${lesson}`, { body: { status } });
      if (r.status === "awaiting_assessment") {
        toast("Saved. Log a result that meets the progress test to complete this lesson.");
        router.refresh();
      } else if (r.status === "completed") {
        toast("Lesson completed");
        router.push(r.next ? `/sports/${slug}/lessons/${r.next}` : `/sports/${slug}?tab=learn`);
      } else router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  if (state === "completed" || state === "awaiting_assessment")
    return (
      <Button variant="secondary" onClick={() => set("reset")} loading={busy}>
        {state === "completed" ? "Mark as not completed" : "Reset lesson"}
      </Button>
    );
  return (
    <>
      {state === "not_started" && (
        <Button variant="secondary" onClick={() => set("in_progress")} loading={busy}>
          Start lesson
        </Button>
      )}
      <Button onClick={() => set("completed")} loading={busy}>
        Mark lesson complete
      </Button>
    </>
  );
}
