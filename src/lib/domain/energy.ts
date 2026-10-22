/**
 * Energy estimation. All outputs are estimates with explicit uncertainty
 * ranges; nothing here is a measurement.
 *
 * Exercise: kcal ≈ MET × body mass (kg) × hours (Compendium of Physical
 * Activities convention, 1 MET ≈ 1 kcal/kg/h). Individual variation is large,
 * so a ±20% band is reported (wider when body mass is unknown).
 */
export const DEFAULT_BODY_MASS_KG = 70;

export interface EnergyEstimate {
  low: number;
  high: number;
  mid: number;
  assumedMass: boolean;
  method: string;
}

export function exerciseKcal(met: number, durationMin: number, weightKg?: number | null): EnergyEstimate {
  const assumedMass = !weightKg || weightKg <= 0;
  const mass = assumedMass ? DEFAULT_BODY_MASS_KG : (weightKg as number);
  const hours = Math.max(0, durationMin) / 60;
  // Report "net" exercise energy (subtract the 1 MET you would burn at rest) to avoid double counting with TDEE.
  const mid = Math.max(0, met - 1) * mass * hours;
  const spread = assumedMass ? 0.35 : 0.2;
  return {
    mid: Math.round(mid),
    // Rounded outwards, so a small estimate stays a range (e.g. 1–3) instead of collapsing to one number.
    low: Math.floor(mid * (1 - spread)),
    high: Math.ceil(mid * (1 + spread)),
    assumedMass,
    method: `MET ${met.toFixed(1)} × ${Math.round(mass)} kg × ${(hours).toFixed(2)} h (net of resting energy)${assumedMass ? " — body mass assumed" : ""}`,
  };
}

/** Running MET derived from speed when distance & duration are known (≈ 1 MET per km/h, clamped). */
export function runningMetFromPace(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0) return null;
  const kmh = distanceKm / (durationMin / 60);
  if (kmh < 6.5) return null; // walking pace — use walking METs instead
  return Math.min(19, Math.max(6, kmh * 1.0));
}

export function cyclingMetFromSpeed(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0) return null;
  const kmh = distanceKm / (durationMin / 60);
  if (kmh < 16) return 4.0;
  if (kmh < 19) return 6.8;
  if (kmh < 22.5) return 8.0;
  if (kmh < 25.5) return 10.0;
  if (kmh < 30.5) return 12.0;
  return 15.8;
}

export function walkingMetFromSpeed(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0) return null;
  const kmh = distanceKm / (durationMin / 60);
  if (kmh < 3.2) return 2.0;
  if (kmh < 4.8) return 3.0;
  if (kmh < 5.6) return 3.5;
  if (kmh < 6.4) return 4.3;
  return 5.0;
}

export const RPE_TO_INTENSITY = (rpe?: number | null): "light" | "moderate" | "vigorous" =>
  !rpe ? "moderate" : rpe <= 4 ? "light" : rpe <= 7 ? "moderate" : "vigorous";

export interface BodyStats {
  weightKg?: number | null;
  heightCm?: number | null;
  ageRange?: string | null;
  sex?: string | null;
  activityLevel?: string | null;
}

const AGE_MIDPOINTS: Record<string, number> = {
  under18: 16,
  "18-24": 21,
  "25-34": 30,
  "35-44": 40,
  "45-54": 50,
  "55-64": 60,
  "65+": 70,
};

export const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Mifflin–St Jeor resting energy. Returns null when inputs are missing.
 * For unspecified sex the midpoint of the two equations is used and the
 * uncertainty band is widened.
 */
export function restingEnergy(stats: BodyStats): { kcal: number; spread: number } | null {
  const { weightKg, heightCm, ageRange, sex } = stats;
  if (!weightKg || !heightCm || !ageRange || !(ageRange in AGE_MIDPOINTS)) return null;
  const age = AGE_MIDPOINTS[ageRange];
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return { kcal: base + 5, spread: 0.1 };
  if (sex === "female") return { kcal: base - 161, spread: 0.1 };
  return { kcal: base - 78, spread: 0.15 };
}

/**
 * Estimated total daily energy expenditure. Uses the activity factor for
 * non-exercise activity; logged exercise is shown separately (not added on
 * top of a "very active" factor) to avoid double counting.
 */
export function estimateTdee(stats: BodyStats): EnergyEstimate | null {
  const rest = restingEnergy(stats);
  if (!rest) return null;
  const factor = ACTIVITY_FACTORS[stats.activityLevel ?? "light"] ?? 1.375;
  const mid = rest.kcal * factor;
  return {
    mid: Math.round(mid),
    low: Math.round(mid * (1 - rest.spread)),
    high: Math.round(mid * (1 + rest.spread)),
    assumedMass: false,
    method: `Mifflin–St Jeor resting estimate × activity factor ${factor}`,
  };
}

/**
 * Suggested daily calories for a goal. Deficits are modest, and never applied
 * for users under 18 or with no body data.
 */
export function calorieGuidance(stats: BodyStats, goals: string[]): { target: number | null; note: string } {
  const tdee = estimateTdee(stats);
  if (!tdee) return { target: null, note: "Add height, weight and age range in your profile for an estimate." };
  if (stats.ageRange === "under18") {
    return {
      target: tdee.mid,
      note: "You are still growing — eat enough to fuel training and growth. We don't suggest calorie deficits for under-18s; talk to a doctor or dietitian about any weight goals.",
    };
  }
  if (goals.includes("fat_loss")) {
    return {
      target: Math.round(tdee.mid * 0.85),
      note: "A modest ~15% deficit supports gradual fat loss while protecting training quality. Adjust based on energy, hunger and progress over several weeks.",
    };
  }
  if (goals.includes("muscle")) {
    return { target: Math.round(tdee.mid * 1.07), note: "A small surplus (~5–10%) supports muscle gain without unnecessary fat gain." };
  }
  return { target: tdee.mid, note: "Maintenance estimate. Real needs vary — use trends in weight and energy to adjust." };
}

export function proteinGuidance(weightKg?: number | null, goals: string[] = []) {
  if (!weightKg) return null;
  const perKg = goals.includes("muscle") || goals.includes("fat_loss") || goals.includes("strength") ? 1.6 : 1.2;
  return { grams: Math.round(weightKg * perKg), perKg };
}
