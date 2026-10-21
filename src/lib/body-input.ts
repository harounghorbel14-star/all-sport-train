import { cmToIn, inToCm, kgToLb, lbToKg } from "./format";

/** Stored ranges (metric). The API validates the same numbers (see validation.ts). */
export const HEIGHT_CM = { min: 100, max: 250 } as const;
export const WEIGHT_KG = { min: 25, max: 350 } as const;

export type Units = "metric" | "imperial";
/** What the user typed, in their units. Imperial height is feet + inches. */
export interface BodyFields {
  units: Units;
  height: string; // cm (metric)
  heightFt: string; // imperial
  heightIn: string; // imperial
  weight: string; // kg or lb
}

/** Keeps digits and one decimal separator; a comma is a decimal separator ("72,5" → "72.5"), never dropped. */
export function cleanDecimal(raw: string) {
  const s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const i = s.indexOf(".");
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
}

const num = (s: string) => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(cleanDecimal(t));
  return Number.isFinite(n) ? n : NaN;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export const heightRangeText = (units: Units) => {
  if (units === "metric") return `${HEIGHT_CM.min}–${HEIGHT_CM.max} cm`;
  const a = cmToIn(HEIGHT_CM.min);
  const b = cmToIn(HEIGHT_CM.max);
  return `${Math.floor(a / 12)} ft ${Math.ceil(a % 12)} in – ${Math.floor(b / 12)} ft ${Math.floor(b % 12)} in`;
};
export const weightRangeText = (units: Units) => (units === "metric" ? `${WEIGHT_KG.min}–${WEIGHT_KG.max} kg` : `${Math.ceil(kgToLb(WEIGHT_KG.min))}–${Math.floor(kgToLb(WEIGHT_KG.max))} lb`);

/**
 * Converts what the user typed to stored metric values and explains any problem per field.
 * Empty fields are fine (both are optional); nothing is guessed — out-of-range values are errors, not "fixed".
 */
export function parseBody(f: BodyFields): { heightCm: number | null; weightKg: number | null; errors: { height?: string; weight?: string } } {
  const errors: { height?: string; weight?: string } = {};
  let heightCm: number | null = null;
  if (f.units === "metric") {
    const h = num(f.height);
    if (h != null) heightCm = h;
  } else {
    const ft = num(f.heightFt);
    const inch = num(f.heightIn);
    if (ft != null || inch != null) {
      if (Number.isNaN(ft) || Number.isNaN(inch) || (inch ?? 0) >= 12) heightCm = NaN;
      else heightCm = inToCm((ft ?? 0) * 12 + (inch ?? 0));
    }
  }
  if (heightCm != null) {
    if (Number.isNaN(heightCm) || heightCm < HEIGHT_CM.min || heightCm > HEIGHT_CM.max) {
      errors.height = f.units === "imperial" && (num(f.heightIn) ?? 0) >= 12 ? "Inches must be 0–11 (use the feet box for whole feet)." : `Height must be ${heightRangeText(f.units)}.`;
      heightCm = null;
    } else heightCm = r1(heightCm);
  }
  let weightKg: number | null = null;
  const w = num(f.weight);
  if (w != null) {
    const kg = f.units === "imperial" ? lbToKg(w) : w;
    if (Number.isNaN(kg) || kg < WEIGHT_KG.min || kg > WEIGHT_KG.max) errors.weight = `Weight must be ${weightRangeText(f.units)}.`;
    else weightKg = r1(kg);
  }
  return { heightCm, weightKg, errors };
}

/** Typed values from stored metric ones, in the given units (for prefill and unit switches). */
export function bodyFieldsFrom(heightCm: number | null, weightKg: number | null, units: Units): BodyFields {
  if (units === "metric") return { units, height: heightCm ? String(r1(heightCm)) : "", heightFt: "", heightIn: "", weight: weightKg ? String(r1(weightKg)) : "" };
  const totalIn = heightCm ? Math.round(cmToIn(heightCm)) : null;
  return {
    units,
    height: "",
    heightFt: totalIn != null ? String(Math.floor(totalIn / 12)) : "",
    heightIn: totalIn != null ? String(totalIn % 12) : "",
    weight: weightKg ? String(Math.round(kgToLb(weightKg))) : "",
  };
}

/**
 * Switching units converts what was already typed, so the numbers keep their meaning
 * (180 cm doesn't silently become 180 inches). An entry that can't be read is cleared rather than guessed at.
 */
export function switchUnits(f: BodyFields, units: Units): BodyFields {
  if (units === f.units) return f;
  const parsed = parseBody(f);
  const next = bodyFieldsFrom(parsed.heightCm, parsed.weightKg, units);
  return {
    ...next,
    ...(parsed.errors.height ? (units === "metric" ? { height: "" } : { heightFt: "", heightIn: "" }) : {}),
    ...(parsed.errors.weight ? { weight: "" } : {}),
  };
}
