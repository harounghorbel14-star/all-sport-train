/**
 * Date helpers that work on calendar "date keys" (YYYY-MM-DD) in the user's
 * own time zone, so streaks and daily totals follow the user's local midnight.
 */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function dateKey(date: Date, timeZone = "UTC"): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const todayKey = (timeZone = "UTC", now = new Date()) => dateKey(now, timeZone);

const keyToUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(key: string, days: number): string {
  const t = new Date(keyToUtc(key) + days * 86_400_000);
  return t.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((keyToUtc(a) - keyToUtc(b)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** Monday-based week start. */
export function weekStart(key: string): string {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function rangeKeys(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

export const isDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(keyToUtc(s));

export function hourInZone(date: Date, timeZone = "UTC"): number {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(date);
  return Number(h) % 24;
}
