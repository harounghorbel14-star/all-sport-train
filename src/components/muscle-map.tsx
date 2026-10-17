"use client";

import { motion } from "framer-motion";
import { cx } from "./ui/primitives";

export const MUSCLE_REGIONS = [
  { id: "shoulders", label: "Shoulders", muscles: ["front_delts", "side_delts", "rear_delts"] },
  { id: "chest", label: "Chest", muscles: ["chest", "upper_chest"] },
  { id: "arms", label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { id: "back", label: "Back & lats", muscles: ["lats", "upper_back", "traps"] },
  { id: "core", label: "Abs & core", muscles: ["abs", "obliques", "deep_core"] },
  { id: "legs", label: "Legs & glutes", muscles: ["quads", "hamstrings", "glutes", "calves"] },
] as const;
export type RegionId = (typeof MUSCLE_REGIONS)[number]["id"];

/** Stylised, clickable body map. Every region is also a real button for keyboard and screen-reader users. */
export function MuscleMap({ selected, onToggle }: { selected: RegionId[]; onToggle: (id: RegionId) => void }) {
  const on = (id: RegionId) => selected.includes(id);
  const fill = (id: RegionId) => (on(id) ? "var(--accent)" : "var(--surface-3)");
  const shape = (id: RegionId, el: React.ReactNode) => (
    <motion.g
      key={id}
      role="button"
      tabIndex={-1}
      aria-hidden
      onClick={() => onToggle(id)}
      whileHover={{ scale: 1.03 }}
      style={{ cursor: "pointer", transformOrigin: "center", transformBox: "fill-box" }}
      animate={{ opacity: on(id) ? 1 : 0.85 }}
    >
      {el}
    </motion.g>
  );
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 200 330" className="h-72 w-auto shrink-0" aria-hidden>
        <circle cx="100" cy="30" r="20" fill="var(--surface-2)" stroke="var(--line)" />
        {shape("back", <path d="M68 62 Q100 52 132 62 L136 120 Q100 130 64 120 Z" fill={on("back") ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--surface-2)"} stroke="var(--line)" />)}
        {shape("shoulders", <g fill={fill("shoulders")}><ellipse cx="58" cy="72" rx="16" ry="13" /><ellipse cx="142" cy="72" rx="16" ry="13" /></g>)}
        {shape("chest", <g fill={fill("chest")}><rect x="70" y="66" width="28" height="30" rx="10" /><rect x="102" y="66" width="28" height="30" rx="10" /></g>)}
        {shape("arms", <g fill={fill("arms")}><rect x="36" y="86" width="18" height="70" rx="9" /><rect x="146" y="86" width="18" height="70" rx="9" /><rect x="30" y="158" width="16" height="50" rx="8" /><rect x="154" y="158" width="16" height="50" rx="8" /></g>)}
        {shape("core", <g fill={fill("core")}><rect x="78" y="102" width="44" height="66" rx="12" /></g>)}
        {shape("legs", <g fill={fill("legs")}><rect x="70" y="176" width="27" height="78" rx="12" /><rect x="103" y="176" width="27" height="78" rx="12" /><rect x="73" y="258" width="22" height="58" rx="10" /><rect x="105" y="258" width="22" height="58" rx="10" /></g>)}
      </svg>
      <div className="flex flex-wrap gap-2 sm:flex-col" role="group" aria-label="Focus areas">
        {MUSCLE_REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={on(r.id)}
            onClick={() => onToggle(r.id)}
            className={cx("rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", on(r.id) ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2")}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Suggest a program emphasis from selected focus areas. */
export function emphasisFromRegions(regions: RegionId[]): string {
  const s = new Set(regions);
  if (s.size === 0 || s.size >= 5) return s.size >= 5 ? "full_body" : "balanced_calisthenics";
  if (s.has("shoulders") && s.has("back")) return "v_taper";
  if (s.has("chest") && s.has("arms")) return "chest_arms";
  if (s.size === 1 && s.has("core")) return "abs_core";
  if (s.size === 1 && s.has("legs")) return "lower_body";
  if (!s.has("legs") && (s.has("chest") || s.has("back") || s.has("shoulders"))) return "upper_body";
  return "balanced_calisthenics";
}
