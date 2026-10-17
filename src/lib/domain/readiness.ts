export interface CheckInInput {
  sleepHours?: number | null;
  energy: number; // 1..5
  soreness: number; // 1..5 (5 = very sore)
  stress?: number | null; // 1..5
  pain?: boolean;
}

export type ReadinessBand = "rest" | "easy" | "normal" | "ready";

/**
 * Subjective readiness score (0–100). Used to recommend *reducing* load —
 * never to push harder than planned.
 */
export function readinessScore(c: CheckInInput): number {
  const sleep = c.sleepHours == null ? 0.6 : Math.min(1, Math.max(0, (c.sleepHours - 4) / 4)); // 4h→0, 8h→1
  const energy = (c.energy - 1) / 4;
  const soreness = 1 - (c.soreness - 1) / 4;
  const stress = c.stress == null ? 0.6 : 1 - (c.stress - 1) / 4;
  let score = 100 * (0.3 * sleep + 0.3 * energy + 0.25 * soreness + 0.15 * stress);
  if (c.pain) score = Math.min(score, 35);
  return Math.round(score);
}

export function readinessBand(score: number, pain = false): ReadinessBand {
  if (pain || score < 35) return "rest";
  if (score < 55) return "easy";
  if (score < 80) return "normal";
  return "ready";
}

export const READINESS_ADVICE: Record<ReadinessBand, { title: string; body: string; volume: number }> = {
  rest: {
    title: "Recovery day recommended",
    body: "Take a rest day or do gentle mobility. If something hurts, avoid movements that aggravate it and consider seeing a qualified professional.",
    volume: 0,
  },
  easy: {
    title: "Go lighter today",
    body: "We reduced volume and kept intensity easy. Stop any movement that causes pain.",
    volume: 0.6,
  },
  normal: { title: "Train as planned", body: "Solid readiness. Stick to the plan and keep 1–2 reps in reserve.", volume: 1 },
  ready: { title: "Feeling good", body: "Great readiness. Train as planned — no need to do extra; consistency wins.", volume: 1 },
};
