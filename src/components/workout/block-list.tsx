"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import type { Block, GeneratedWorkout } from "@/lib/engine/types";
import type { ExerciseLookup } from "@/lib/services/views";
import { MUSCLE_LABELS } from "@/lib/exercise-labels";
import { useI18n } from "../providers";
import { Badge, cx } from "../ui/primitives";

export const targetText = (b: Block) => (b.seconds ? `${b.sets} × ${b.seconds}s` : `${b.sets} × ${b.repMin}–${b.repMax}`);

const PROGRESSION_BADGE: Record<string, { label: string; tone: "accent" | "warn" | "info" }> = {
  progress: { label: "Level up", tone: "accent" },
  regress: { label: "Rebuild", tone: "warn" },
  new: { label: "New", tone: "info" },
};

export function BlockRow({ block, info, index, compact }: { block: Block; info?: ExerciseLookup[string]; index?: number; compact?: boolean }) {
  const pb = block.progression ? PROGRESSION_BADGE[block.progression] : undefined;
  return (
    <div className="flex items-start gap-3 py-3">
      {index != null && <span className="num mt-0.5 w-6 shrink-0 text-xl font-bold text-subtle">{index + 1}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/exercises/${block.exercise}`} className="font-semibold hover:text-accent">
            {info?.name ?? block.exercise}
          </Link>
          {pb && <Badge tone={pb.tone}>{pb.label}</Badge>}
        </div>
        {!compact && info && <p className="mt-0.5 text-xs text-subtle">{info.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(" · ")}</p>}
        {!compact && block.note && (
          <p className="mt-1 flex items-start gap-1 text-xs text-muted">
            <Info className="mt-0.5 size-3 shrink-0" /> {block.note}
          </p>
        )}
      </div>
      <div className="shrink-0 text-end">
        <p className="num text-lg font-bold">{targetText(block)}</p>
        {block.restSeconds > 0 && <p className="text-[11px] text-subtle">rest {block.restSeconds}s</p>}
      </div>
    </div>
  );
}

export function WorkoutSections({ workout, lookup, compact }: { workout: GeneratedWorkout; lookup: ExerciseLookup; compact?: boolean }) {
  const { t } = useI18n();
  const section = (title: string, blocks: Block[], numbered = false) =>
    blocks.length > 0 && (
      <div>
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-subtle">{title}</h3>
        <div className={cx("divide-y divide-line")}>
          {blocks.map((b, i) => (
            <BlockRow key={`${b.exercise}-${i}`} block={b} info={lookup[b.exercise]} index={numbered ? i : undefined} compact={compact} />
          ))}
        </div>
      </div>
    );
  return (
    <div>
      {section(t.workout.warmup, workout.warmup)}
      {section(t.workout.main, workout.main, true)}
      {section(t.workout.cooldown, workout.cooldown)}
    </div>
  );
}

export function MoveButtons({ onUp, onDown, disableUp, disableDown }: { onUp: () => void; onDown: () => void; disableUp?: boolean; disableDown?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col">
      <button type="button" onClick={onUp} disabled={disableUp} aria-label={t.workout.moveUp} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3 disabled:opacity-30">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" onClick={onDown} disabled={disableDown} aria-label={t.workout.moveDown} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3 disabled:opacity-30">
        <ArrowDown className="size-4" />
      </button>
    </div>
  );
}
