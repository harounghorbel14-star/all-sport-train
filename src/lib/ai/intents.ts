export type Intent =
  | "workout_today"
  | "short_workout"
  | "first_pullup"
  | "fatigue_adapt"
  | "teach_exercise"
  | "analyze_progress"
  | "next_block"
  | "meal_suggestion"
  | "plateau"
  | "general";

export function detectIntent(text: string): { intent: Intent; minutes?: number } {
  const t = text.toLowerCase();
  const minutes = t.match(/(\d{1,3})\s*(min|minutes|mins)\b/);
  if (minutes) return { intent: "short_workout", minutes: Math.min(120, Math.max(10, Number(minutes[1]))) };
  if (/(can'?t|cannot|unable to|never done).{0,20}pull[- ]?up|first pull[- ]?up/.test(t)) return { intent: "first_pullup" };
  if (/(tired|sore|fatigued|aching|ache|achy|hurt|pain|exhausted).{0,40}|(shoulders?|knees?|back|wrists?|elbows?) (feel|are|is)/.test(t) && /(adapt|adjust|modify|change|workout|train|today|feel|feels)/.test(t)) return { intent: "fatigue_adapt" };
  if (/(teach|how (do|to|should) i|proper|technique|form).{0,40}/.test(t)) return { intent: "teach_exercise" };
  if (/(analy[sz]e|review|look at|how am i doing).{0,40}(week|month|progress|training)|last (four|4|few) weeks/.test(t)) return { intent: "analyze_progress" };
  if (/(next|new).{0,20}(block|phase|four[- ]week|4[- ]week|program)/.test(t)) return { intent: "next_block" };
  if (/\b(meals?|eat(ing)?|food|breakfast|lunch|dinner|snacks?|recipes?|protein)\b/.test(t)) return { intent: "meal_suggestion" };
  if (/(slow(ed)?|plateau|stuck|stall(ed)?|not progressing|no progress)/.test(t)) return { intent: "plateau" };
  if (/(workout|session|train(ing)?).{0,20}(today|now)|create my workout|what should i (do|train)/.test(t)) return { intent: "workout_today" };
  return { intent: "general" };
}
