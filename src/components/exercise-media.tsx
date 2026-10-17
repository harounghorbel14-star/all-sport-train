import { PersonStanding } from "lucide-react";
import { PATTERN_LABELS } from "@/lib/content/exercises";

/**
 * Reusable exercise media slot. Shows a real video only when a verified URL
 * has been configured for the exercise (admins can add one); otherwise an
 * honest illustrated placeholder pointing to the written tutorial.
 */
export function ExerciseMedia({ name, pattern, mediaUrl }: { name: string; pattern: string; mediaUrl: string | null }) {
  if (mediaUrl) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-black">
        <video src={mediaUrl} controls playsInline preload="metadata" className="aspect-video w-full" aria-label={`${name} demonstration`} />
      </div>
    );
  }
  return (
    <div className="relative grid aspect-[16/7] place-items-center overflow-hidden rounded-[var(--radius-card)] border border-line bg-gradient-to-br from-surface-2 via-surface to-accent-soft">
      <div aria-hidden className="absolute -end-10 -top-10 size-48 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative text-center">
        <PersonStanding className="mx-auto size-14 text-accent" aria-hidden />
        <p className="num mt-2 text-2xl font-bold uppercase">{PATTERN_LABELS[pattern] ?? pattern}</p>
        <p className="mt-1 text-xs text-muted">No video demonstration yet — follow the written tutorial below.</p>
      </div>
    </div>
  );
}
