/** Display/parse helpers for sport metrics, shared by server and client components. */

export interface MetricLike {
  key: string;
  label: string;
  kind: string;
  unit: string | null;
  options: string[];
  direction: string;
}

/** Seconds → "m:ss" (or "h:mm:ss"); sub-minute values keep one decimal. */
export function formatSeconds(total: number) {
  if (total < 60) return `${Math.round(total * 100) / 100} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round((total % 60) * 10) / 10;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Accepts "75", "75.4", "1:15", "1:02:30". Returns seconds or null. */
export function parseTime(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (!/^\d+(\.\d+)?$|^\d+(:\d{1,2}(\.\d+)?){1,2}$/.test(t)) return null;
  return t.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function formatMetricValue(m: MetricLike, value: number) {
  if (m.kind === "time") return formatSeconds(value);
  if (m.kind === "ratio") return `${value}%`;
  if (m.kind === "select") return m.options[value - 1] ?? String(value);
  return `${Math.round(value * 100) / 100}${m.unit ? ` ${m.unit}` : ""}`;
}

export const DIRECTION_HINT: Record<string, string> = { higher: "higher is better", lower: "lower is better", none: "" };
