export type Units = "metric" | "imperial";

export const kgToLb = (kg: number) => kg * 2.20462;
export const lbToKg = (lb: number) => lb / 2.20462;
export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (inch: number) => inch * 2.54;
export const kmToMi = (km: number) => km * 0.621371;
export const miToKm = (mi: number) => mi / 0.621371;

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function formatWeight(kg: number | null | undefined, units: Units) {
  if (kg == null) return "—";
  return units === "imperial" ? `${round(kgToLb(kg))} lb` : `${round(kg)} kg`;
}
export function formatLength(cm: number | null | undefined, units: Units) {
  if (cm == null) return "—";
  return units === "imperial" ? `${round(cmToIn(cm))} in` : `${round(cm)} cm`;
}
export function formatDistance(km: number | null | undefined, units: Units) {
  if (km == null) return "—";
  return units === "imperial" ? `${round(kmToMi(km), 2)} mi` : `${round(km, 2)} km`;
}
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
export function formatPace(km: number, minutes: number, units: Units) {
  if (!km || !minutes) return "—";
  const dist = units === "imperial" ? kmToMi(km) : km;
  const per = minutes / dist;
  const m = Math.floor(per);
  const s = Math.round((per - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /${units === "imperial" ? "mi" : "km"}`;
}
/** Format a YYYY-MM-DD key without time-zone drift. */
export function formatDateKey(key: string, locale = "en", opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: "UTC" });
}
export const kcalRange = (low: number, high: number) => (low === high ? `~${low}` : `${low}–${high}`);

/** A personal record or logged value in the user's units: "12 reps", "45 s", "100 lb". */
export function formatRecord(value: number, metric: string, units: Units) {
  if (metric === "loadKg") return formatWeight(value, units);
  if (metric === "seconds") return `${round(value)} s`;
  return `${round(value)} reps`;
}
