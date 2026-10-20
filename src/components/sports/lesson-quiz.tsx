"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/client/api";
import { fmt } from "@/lib/i18n";
import { Badge, Button, Card, CardTitle, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { useI18n } from "@/components/providers";
import { cx } from "@/lib/cx";

type Question = { id: string; type: "single" | "multiple"; scenario: string | null; prompt: string; options: { id: string; text: string }[] };
type Review = Question & { selected: string[]; correctIds: string[]; isCorrect: boolean; explanation: string };
type Result = { correct: number; total: number; percent: number; passed: boolean; review: Review[]; lesson: "completed" | "awaiting_assessment" | null };
export interface QuizState {
  questions: number;
  passPercent: number;
  passed: boolean;
  prereqsMet: boolean;
  remainingToday: number;
  open: { id: string; questions: Question[] } | null;
  history: { id: string; correct: number | null; total: number; passed: boolean | null; submittedAt: string | Date | null }[];
}

/** Lesson knowledge check: questions come from the server without answers; grading and review come back after submitting. */
export function LessonQuiz({ slug, lesson, initial, hasProgressTest, locale }: { slug: string; lesson: string; initial: QuizState; hasProgressTest: boolean; locale: string }) {
  const { t } = useI18n();
  const tq = t.quiz;
  const router = useRouter();
  const toast = useToast();
  const [attempt, setAttempt] = useState<{ id: string; questions: Question[] } | null>(initial.open);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = initial.remainingToday - (result ? 1 : 0);

  async function start() {
    setBusy(true);
    try {
      const r = await api<{ attemptId: string; questions: Question[] }>(`/api/sports/${slug}/lessons/${lesson}/quiz`, { method: "POST" });
      setAttempt({ id: r.attemptId, questions: r.questions });
      setAnswers({});
      setResult(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!attempt) return;
    setBusy(true);
    try {
      const r = await api<Result>(`/api/quiz-attempts/${attempt.id}`, { body: { answers } });
      setResult(r);
      setAttempt(null);
      if (r.lesson === "completed") toast(tq.lessonDone);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.common.error, "error");
    } finally {
      setBusy(false);
    }
  }
  const toggle = (q: Question, id: string) =>
    setAnswers((a) => ({ ...a, [q.id]: q.type === "single" ? [id] : (a[q.id] ?? []).includes(id) ? (a[q.id] ?? []).filter((x) => x !== id) : [...(a[q.id] ?? []), id] }));
  const text = (q: Review, ids: string[]) => ids.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join("; ");
  const answeredCount = attempt ? attempt.questions.filter((q) => (answers[q.id] ?? []).length).length : 0;

  return (
    <Card id="quiz">
      <CardTitle action={<Badge tone={initial.passed || result?.passed ? "success" : "neutral"}>{initial.passed || result?.passed ? tq.passed : tq.notPassed}</Badge>}>{tq.title}</CardTitle>
      <p className="text-sm text-muted">{fmt(tq.intro, { count: initial.questions, percent: initial.passPercent })}</p>
      <p className="mt-1 text-xs text-subtle">{hasProgressTest ? tq.requiredWithTest : tq.required} {tq.unreviewed}</p>

      {result && (
        <div className="mt-4 space-y-3" role="status" aria-live="polite">
          <Notice tone={result.passed ? "accent" : "warn"}>
            <p className="font-semibold">{fmt(tq.result, { correct: result.correct, total: result.total, percent: result.percent })}</p>
            <p className="text-xs">{result.passed ? (result.lesson === "awaiting_assessment" ? tq.lessonWaiting : tq.passMsg) : tq.failMsg}</p>
          </Notice>
          <ol className="space-y-3">
            {result.review.map((q, i) => (
              <li key={q.id} className={cx("rounded-xl border p-3 text-sm", q.isCorrect ? "border-accent/40" : "border-warn/50")}>
                <p className="flex items-start gap-2 font-medium">
                  {q.isCorrect ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-label={tq.right} /> : <XCircle className="mt-0.5 size-4 shrink-0 text-warn" aria-label={tq.wrong} />}
                  <span>{i + 1}. {q.prompt}</span>
                </p>
                <p className="mt-1 text-xs text-muted">{q.selected.length ? fmt(tq.yourAnswer, { answer: text(q, q.selected) }) : tq.noAnswer}</p>
                {!q.isCorrect && <p className="text-xs">{fmt(tq.correctAnswer, { answer: text(q, q.correctIds) })}</p>}
                <p className="mt-1 text-xs text-muted">{q.explanation}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {attempt ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {attempt.questions.map((q, i) => (
            <fieldset key={q.id} className="space-y-2 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-medium">
                {i + 1}. {q.prompt}
              </legend>
              {q.scenario && <p className="text-xs text-muted">{q.scenario}</p>}
              <p className="text-[11px] uppercase tracking-wide text-subtle">{q.type === "single" ? tq.chooseOne : tq.chooseAll}</p>
              {q.options.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 text-sm hover:bg-surface-2">
                  <input type={q.type === "single" ? "radio" : "checkbox"} name={`q-${q.id}`} className="mt-1 accent-[var(--accent)]" checked={(answers[q.id] ?? []).includes(o.id)} onChange={() => toggle(q, o.id)} />
                  <span>{o.text}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">{fmt(tq.answered, { n: answeredCount, total: attempt.questions.length })}</span>
            <Button type="submit" loading={busy}>
              {tq.submit}
            </Button>
          </div>
        </form>
      ) : !initial.prereqsMet ? (
        <p className="mt-3 text-sm text-muted">{tq.prereq}</p>
      ) : remaining > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant={initial.passed || result?.passed ? "secondary" : "primary"} loading={busy} onClick={start}>
            {result ? tq.retry : initial.open ? tq.resume : initial.history.length ? tq.retry : tq.start}
          </Button>
          <span className="text-xs text-subtle">{fmt(tq.remaining, { n: remaining })}</span>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{tq.noneLeft}</p>
      )}

      {initial.history.length > 0 && (
        <details className="mt-4 text-xs text-muted">
          <summary className="cursor-pointer">{tq.history}</summary>
          <ul className="mt-2 space-y-1">
            {initial.history.map((h) => (
              <li key={h.id}>
                {h.submittedAt ? new Date(h.submittedAt).toLocaleDateString(locale) : ""} · {fmt(tq.result, { correct: h.correct ?? 0, total: h.total, percent: h.total ? Math.round(((h.correct ?? 0) / h.total) * 100) : 0 })} · {h.passed ? tq.passed : tq.notPassed}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
