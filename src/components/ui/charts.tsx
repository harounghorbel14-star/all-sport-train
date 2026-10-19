"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useState, type ReactNode } from "react";
import { cx } from "./primitives";

/** Animated progress ring. `value` is 0..1. */
export function ProgressRing({ value, size = 120, stroke = 10, children, color = "var(--accent)", label }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  const reduced = useReducedMotion();
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={reduced ? { duration: 0 } : { duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
}

/** Accessible bar chart with hover values. Zero values render as empty slots, never fabricated data. */
export function BarChart({ data, height = 140, unit = "", format = (v: number) => v.toLocaleString(), color = "var(--accent)" }: { data: BarDatum[]; height?: number; unit?: string; format?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);
  const reduced = useReducedMotion();
  return (
    <div className="min-w-0">
      <div className="flex items-end gap-1.5" style={{ height }} role="list" aria-label="Bar chart">
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            role="listitem"
            aria-label={`${d.label}: ${format(d.value)}${unit}`}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <div className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2 py-0.5 text-xs font-semibold shadow">
                {format(d.value)}
                {unit}
              </div>
            )}
            <motion.div
              className={cx("w-full rounded-t-md rounded-b-sm", d.value === 0 && "opacity-40")}
              style={{ background: d.value === 0 ? "var(--surface-3)" : d.highlight ? color : `color-mix(in srgb, ${color} 55%, transparent)` }}
              initial={{ height: 0 }}
              animate={{ height: d.value === 0 ? 3 : `${Math.max(4, (d.value / max) * 100)}%` }}
              transition={reduced ? { duration: 0 } : { delay: i * 0.03, type: "spring", stiffness: 180, damping: 22 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center text-[10px] text-subtle">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Simple line chart for time series (e.g. body weight, best reps). */
export function LineChart({ points, height = 160, unit = "", color = "var(--accent)" }: { points: { label: string; value: number }[]; height?: number; unit?: string; color?: string }) {
  const id = useId();
  const reduced = useReducedMotion();
  if (points.length === 0) return null;
  const w = 600;
  const pad = 16;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const xy = points.map((p, i) => [pad + (points.length === 1 ? (w - 2 * pad) / 2 : (i / (points.length - 1)) * (w - 2 * pad)), pad + (1 - (p.value - min) / span) * (height - 2 * pad)] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${xy[xy.length - 1][0]},${height} L${xy[0][0]},${height} Z`;
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={`Trend from ${points[0].value}${unit} to ${points[points.length - 1].value}${unit}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <motion.path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill="var(--surface)" stroke={color} strokeWidth={2}>
            <title>{`${points[i].label}: ${points[i].value}${unit}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </figcaption>
    </figure>
  );
}

export function MeterBar({ value, max, color = "var(--accent)", className }: { value: number; max: number; color?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
    </div>
  );
}
