/**
 * Feature switches for newer features, so a broken one can be turned off without a deploy of code:
 * set FEATURES_DISABLED to a comma-separated list (e.g. "quizzes,travel") and restart.
 * Defaults are "on". Turning a feature off hides it and refuses its API calls; it never deletes data,
 * and lessons don't wait on a disabled knowledge check.
 */
export const FEATURES = ["goals", "quizzes", "templates", "travel", "catch_up"] as const;
export type Feature = (typeof FEATURES)[number];

export function disabledFeatures(): Feature[] {
  const raw = (process.env.FEATURES_DISABLED ?? "").split(",").map((s) => s.trim().toLowerCase());
  return FEATURES.filter((f) => raw.includes(f));
}

export const featureEnabled = (f: Feature) => !disabledFeatures().includes(f);

/** Unknown names in FEATURES_DISABLED (reported by the health check so typos are visible). */
export function unknownFeatureNames(): string[] {
  return (process.env.FEATURES_DISABLED ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && !(FEATURES as readonly string[]).includes(s));
}
