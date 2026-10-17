/** Human labels for option keys used across onboarding, settings and plans. */
export const GOAL_LABELS: Record<string, string> = {
  general_fitness: "General fitness",
  strength: "Get stronger",
  muscle: "Build muscle",
  calisthenics: "Calisthenics skills",
  fat_loss: "Lose fat (sustainably)",
  athletic: "Athletic performance",
  endurance: "Endurance",
  mobility: "Flexibility & mobility",
  posture: "Better posture",
  sport_conditioning: "Sport conditioning",
  return_to_exercise: "Return after a break",
};
export const EMPHASIS_LABELS: Record<string, { label: string; body: string }> = {
  balanced_calisthenics: { label: "Balanced Calisthenics", body: "Push, pull, legs, core and skills in harmony." },
  v_taper: { label: "V-Taper", body: "Shoulders, lats and upper back prioritised — legs and core kept in." },
  chest_arms: { label: "Chest & Arms", body: "Extra pressing and arm work within a balanced week." },
  abs_core: { label: "Abs & Core", body: "Core strength and control, plus full-body sessions." },
  full_body: { label: "Full Body", body: "Every session trains the whole body." },
  upper_body: { label: "Upper Body", body: "More upper-body volume; lower body still trained weekly." },
  lower_body: { label: "Lower Body", body: "Legs and glutes focus with upper-body maintenance." },
  athletic_physique: { label: "Athletic Physique", body: "Strength, power and conditioning for an athletic build." },
};
export const EXPERIENCE_LABELS: Record<string, { label: string; body: string }> = {
  zero: { label: "Complete beginner", body: "I've never trained, or not for years." },
  beginner: { label: "Beginner", body: "Some training, but no consistent routine yet." },
  intermediate: { label: "Intermediate", body: "I train regularly and know the basics." },
  advanced: { label: "Advanced", body: "Years of consistent, structured training." },
};
export const LOCATION_LABELS: Record<string, string> = { home: "Home", gym: "Gym", outdoor: "Outdoors / park", mixed: "A mix" };
export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
  very_active: "Extremely active / physical job",
};
export const AGE_LABELS: Record<string, string> = { under18: "Under 18", "18-24": "18–24", "25-34": "25–34", "35-44": "35–44", "45-54": "45–54", "55-64": "55–64", "65+": "65+" };
export const DIET_LABELS: Record<string, string> = {
  none: "No preference",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  halal: "Halal",
  kosher: "Kosher",
  low_lactose: "Low lactose",
  gluten_free: "Gluten-free",
};
export const PREF_LABELS: Record<string, string> = {
  bodyweight: "Bodyweight",
  weights: "Weights",
  short_sessions: "Short sessions",
  low_impact: "Low impact",
  skills: "Learning skills",
  outdoors: "Training outdoors",
};
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
