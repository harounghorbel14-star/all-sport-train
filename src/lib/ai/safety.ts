/**
 * Safety screening for coach conversations. The coach never diagnoses; it
 * points people to appropriate help and adapts training conservatively.
 */
export type SafetyFlag = "emergency" | "injury" | "disordered_eating" | "self_harm";

const PATTERNS: Record<SafetyFlag, RegExp[]> = {
  emergency: [/chest (pain|tightness|pressure)/i, /can'?t breathe|cannot breathe|short(ness)? of breath at rest/i, /faint(ed|ing)?|passed out|black(ed)? out/i, /irregular heart|heart (racing|palpitations)/i],
  injury: [/sharp pain/i, /\b(swollen|swelling)\b/i, /numb(ness)?|tingling/i, /\b(pop|popped|snap|snapped)\b/i, /can'?t (move|bend|straighten|put weight)/i, /\b(sprain|fracture|torn|tear|dislocat)/i, /pain (that )?(won'?t|doesn'?t) go away/i, /\bhurts? (a lot|badly|when)/i],
  disordered_eating: [/\b(purge|purging|throw(ing)? up after)/i, /starv(e|ing)/i, /\b([1-7]\d{2}|[1-9]\d?) ?(k?cal|calories) (a|per) day/i, /laxative/i, /stop eating/i, /hate my body/i],
  self_harm: [/kill myself|suicid|self[- ]harm|hurt myself|end my life/i],
};

export function screen(text: string): SafetyFlag[] {
  return (Object.keys(PATTERNS) as SafetyFlag[]).filter((k) => PATTERNS[k].some((r) => r.test(text)));
}

export const SAFETY_MESSAGES: Record<SafetyFlag, string> = {
  emergency:
    "⚠️ Chest pain, fainting, trouble breathing or an irregular heartbeat can be serious. Stop exercising now. If symptoms are severe or don't settle quickly, contact emergency services. Please get checked by a medical professional before training again.",
  injury:
    "Please stop any movement that causes sharp pain, swelling, numbness or loss of function. I can't diagnose injuries — a doctor or physiotherapist can assess it properly. Meanwhile I'll keep your training away from the affected area.",
  disordered_eating:
    "Your wellbeing matters more than any number. Very low intake or compensating behaviours can seriously harm your health. Please consider talking to a doctor, a registered dietitian, or an eating-disorder support line in your country. I won't create restrictive diets, but I'm happy to help with balanced, sustainable eating.",
  self_harm:
    "I'm really glad you said something. If you're thinking about hurting yourself, please reach out right now to someone you trust or a local crisis line (in many countries you can call or text a helpline any time; in an emergency call your local emergency number). You don't have to go through this alone.",
};

/** Muscles to avoid when the user reports discomfort in a body area. */
export function areasFromText(text: string): string[] {
  const t = text.toLowerCase();
  const map: [RegExp, string[]][] = [
    [/shoulder/, ["front_delts", "side_delts", "rear_delts"]],
    [/wrist/, ["forearms"]],
    [/elbow/, ["triceps", "biceps"]],
    [/knee/, ["quads"]],
    [/(lower )?back/, ["lower_back"]],
    [/hamstring/, ["hamstrings"]],
    [/chest|pec/, ["chest", "upper_chest"]],
    [/hip/, ["hip_flexors", "glutes"]],
    [/calf|calves|ankle/, ["calves"]],
  ];
  return [...new Set(map.filter(([r]) => r.test(t)).flatMap(([, m]) => m))];
}

export const COACH_RULES = `Safety rules you must always follow:
- You are a fitness coach, not a medical professional. Never diagnose injuries, illnesses or conditions.
- If the user mentions pain, tell them to stop movements that cause it and to seek a qualified professional when appropriate.
- Never promise specific physique changes, height increases, bone-structure changes, or transformation deadlines. Results depend on consistency, genetics, recovery, nutrition, age and training history.
- Never recommend extreme diets, crash dieting, aggressive calorie deficits, or supplements/drugs with health risks. For users under 18, never suggest calorie deficits.
- Do not encourage attempting advanced skills before prerequisites are met.
- Calorie numbers are estimates — say so.
- Workouts shown in the app come from the training engine; refer to them rather than inventing a different plan.`;
