import type { QuizContent } from "../content/sports/types";

/** What an attempt showed: question ids in order, each with its option ids in the order shown. */
export type ShownQuestion = { id: string; options: string[] };

function shuffle<T>(list: T[], rand: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picks the questions for one attempt (a random subset when `perAttempt` is set) and shuffles their options. */
export function drawQuestions(quiz: QuizContent, rand: () => number = Math.random): ShownQuestion[] {
  const picked = quiz.perAttempt ? shuffle(quiz.questions, rand).slice(0, quiz.perAttempt) : shuffle(quiz.questions, rand);
  return picked.map((q) => ({ id: q.id, options: shuffle(q.options.map((o) => o.id), rand) }));
}

/** The questions as the user sees them — never the answers or explanations. */
export function publicQuestions(quiz: QuizContent, shown: ShownQuestion[]) {
  return shown.flatMap((s) => {
    const q = quiz.questions.find((x) => x.id === s.id);
    if (!q) return [];
    return [{ id: q.id, type: q.type, scenario: q.scenario ?? null, prompt: q.prompt, options: s.options.map((id) => ({ id, text: q.options.find((o) => o.id === id)?.text ?? "" })) }];
  });
}

/**
 * Grades an attempt. A question is right only when the selected options are exactly the correct ones
 * (no partial credit on multiple-answer questions). Unanswered questions are wrong.
 */
export function grade(quiz: QuizContent, shown: ShownQuestion[], answers: Record<string, string[]>) {
  const review = publicQuestions(quiz, shown).map((q) => {
    const def = quiz.questions.find((x) => x.id === q.id)!;
    const selected = [...new Set(answers[q.id] ?? [])].filter((id) => q.options.some((o) => o.id === id));
    const isCorrect = selected.length === def.correct.length && def.correct.every((c) => selected.includes(c));
    return { ...q, selected, correctIds: def.correct, isCorrect, explanation: def.explanation };
  });
  const correct = review.filter((r) => r.isCorrect).length;
  const total = review.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percent, passPercent: quiz.passPercent, passed: total > 0 && percent >= quiz.passPercent, review };
}
