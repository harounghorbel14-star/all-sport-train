import { env } from "./server/env";

export type Tier = "free" | "pro" | "elite";
export type Feature = "advanced_analytics" | "personalized_programs" | "ai_coach_extended" | "form_check_ai" | "specialized_programs";

/** Configurable product tiers. The free tier keeps every core feature usable. */
export const TIERS: { id: Tier; name: string; tagline: string; features: string[]; unlocks: Feature[] }[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to start and stay consistent.",
    features: ["Workout tracking & live mode", "Personalised daily workouts", "Exercise library & Calisthenics Academy", "Nutrition & activity logging", "Streaks, missions & achievements", "Rule-based coach"],
    unlocks: [],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Deeper insights and personalised programming.",
    features: ["Advanced analytics", "Personalised program blocks", "Expanded AI coaching"],
    unlocks: ["advanced_analytics", "personalized_programs", "ai_coach_extended"],
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "Advanced AI coaching and form analysis.",
    features: ["Everything in Pro", "AI form analysis", "Specialised programs", "Performance insights"],
    unlocks: ["advanced_analytics", "personalized_programs", "ai_coach_extended", "form_check_ai", "specialized_programs"],
  },
];

export const tiersEnforced = () => env().ENFORCE_TIERS === "true";

export function hasFeature(tier: string, feature: Feature) {
  if (!tiersEnforced()) return true;
  return TIERS.find((t) => t.id === tier)?.unlocks.includes(feature) ?? false;
}

/** No payment provider is integrated; checkout is intentionally unavailable. */
export const paymentsConfigured = () => false;
