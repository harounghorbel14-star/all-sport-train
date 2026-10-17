"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, type ReactNode } from "react";

/** Short, tasteful burst for milestones. Disabled with reduced motion. */
export function Burst({ show }: { show: boolean }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        angle: (i / 22) * Math.PI * 2 + Math.random() * 0.3,
        dist: 70 + Math.random() * 90,
        size: 4 + Math.random() * 6,
        color: ["var(--accent)", "var(--info)", "var(--warn)", "var(--fg)"][i % 4],
      })),
    [],
  );
  if (reduced) return null;
  return (
    <AnimatePresence>
      {show && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
          {pieces.map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{ width: p.size, height: p.size, background: p.color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
              animate={{ x: Math.cos(p.angle) * p.dist, y: Math.sin(p.angle) * p.dist, opacity: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export function CelebrationCard({ title, body, icon }: { title: string; body?: string; icon?: ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      className="relative flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-3"
    >
      <Burst show />
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        {body && <p className="text-xs text-muted">{body}</p>}
      </div>
    </motion.div>
  );
}
