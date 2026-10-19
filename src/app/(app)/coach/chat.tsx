"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Bot, ClipboardList, Dumbbell, GraduationCap, Info, Send, Trash2, TrendingUp, Trophy, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CoachAction } from "@/lib/ai/coach";
import { api } from "@/lib/client/api";
import { Badge, Button, Card, Notice, PageHeader, cx } from "@/components/ui/primitives";
import { BarChart } from "@/components/ui/charts";
import { useToast } from "@/components/ui/overlay";

interface Msg {
  id: string;
  role: string;
  content: string;
  provider: string | null;
  action: CoachAction[];
  createdAt: string;
}

const SPORT_PROMPTS = (name: string) => [
  `Build me a 45 minute ${name} practice`,
  `What should I learn next in ${name}?`,
  `Explain the main ${name} rules`,
  `Plan my ${name} week`,
  `Review my ${name} progress`,
  `${name} safety tips`,
];

const PROMPTS = [
  "Create my workout for today",
  "I only have 20 minutes",
  "I cannot do a pull-up yet",
  "My shoulders feel tired. Adapt my workout.",
  "Teach me how to perform a proper push-up",
  "Analyze my last four weeks",
  "Create my next four-week training block",
  "Suggest a balanced meal",
  "Explain why my progress has slowed",
];

/** Minimal, safe markdown: **bold**, bullet and numbered lists, paragraphs. No raw HTML. */
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|(?<![A-Za-z0-9])_[^_]+_(?![A-Za-z0-9]))/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.length > 2 && part.startsWith("_") && part.endsWith("_") ? <em key={i} className="text-muted">{part.slice(1, -1)}</em> : <span key={i}>{part}</span>,
    );
  return (
    <div className="prose-coach text-sm leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-•*]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*([-•*]|\d+\.)\s+/, ""));
          return ordered ? <ol key={i}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol> : <ul key={i}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l)}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function ActionCard({ a }: { a: CoachAction }) {
  if (a.type === "workout")
    return (
      <Link href={`/workout/${a.planId}`} className="mt-2 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3 hover:border-accent">
        <Dumbbell className="size-5 text-accent" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{a.title}</p>
          <p className="text-xs text-muted">~{a.minutes} min · open to edit or start</p>
        </div>
      </Link>
    );
  if (a.type === "exercise")
    return (
      <Link href={`/exercises/${a.slug}`} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm hover:border-accent">
        <Info className="size-4 text-accent" /> Full tutorial: {a.name}
      </Link>
    );
  if (a.type === "skill")
    return (
      <Link href={`/academy/${a.slug}`} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm hover:border-accent">
        <GraduationCap className="size-4 text-accent" /> Open skill path: {a.name}
      </Link>
    );
  if (a.type === "analysis")
    return (
      <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
          <TrendingUp className="size-3.5" /> Workouts per week · {a.adherence}% adherence
        </p>
        <BarChart height={90} data={a.weeks.map((w, i) => ({ label: `W${i + 1}`, value: w.workouts, highlight: i === a.weeks.length - 1 }))} />
      </div>
    );
  if (a.type === "sport")
    return (
      <Link href={`/sports/${a.slug}`} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm hover:border-accent">
        <Trophy className="size-4 text-accent" /> Open {a.name} hub
      </Link>
    );
  if (a.type === "practice")
    return (
      <Link href={`/practice/${a.planId}`} className="mt-2 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3 hover:border-accent">
        <ClipboardList className="size-5 text-accent" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{a.title}</p>
          <p className="text-xs text-muted">~{a.minutes} min · open to adjust, log results and complete</p>
        </div>
      </Link>
    );
  if (a.type === "lesson")
    return (
      <Link href={`/sports/${a.sport}/lessons/${a.slug}`} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm hover:border-accent">
        <BookOpen className="size-4 text-accent" /> Next lesson: {a.title}
      </Link>
    );
  return (
    <Link href={a.href} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm hover:border-accent">
      {a.label} →
    </Link>
  );
}

export function CoachChat({
  initial,
  ai,
  nutritionShared,
  sports,
  initialSport,
}: {
  initial: Msg[];
  ai: { configured: boolean; model: string | null };
  nutritionShared: boolean;
  sports: { slug: string; name: string }[];
  initialSport: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [sport, setSport] = useState(initialSport);
  const sportName = sports.find((s) => s.slug === sport)?.name;
  const prompts = sportName ? SPORT_PROMPTS(sportName) : PROMPTS;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(message: string) {
    if (!message.trim() || sending) return;
    setSending(true);
    setText("");
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "user", content: message, provider: null, action: [], createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const r = await api<{ messages: Msg[] }>("/api/coach", { body: { message, ...(sport ? { sport } : {}) } });
      setMessages(r.messages);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(message);
      toast(e instanceof Error ? e.message : "The coach is unavailable", "error");
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    if (!confirm("Clear your conversation history?")) return;
    await api("/api/coach", { method: "DELETE" });
    setMessages([]);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <PageHeader
        eyebrow="Personal coach"
        title="AI Coach"
        subtitle="Grounded in your plan, history and recovery. Not a medical service — for pain or health concerns, see a qualified professional."
        action={
          <div className="flex items-center gap-2">
            <Badge tone={ai.configured ? "accent" : "neutral"}>{ai.configured ? "AI connected" : "Rule-based mode"}</Badge>
            {messages.length > 0 && <Button variant="ghost" size="sm" onClick={clear} icon={<Trash2 className="size-4" />} aria-label="Clear conversation" />}
          </div>
        }
      />
      {ai.configured && (
        <details className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
          <summary className="cursor-pointer font-medium text-fg">What is sent to the AI provider?</summary>
          <p className="mt-2">
            To write each answer, your message, the recent conversation and a short summary of your training data are sent to the AI provider (Anthropic): display name, age
            range, experience, goals, schedule, equipment, any limitations you entered, your four-week training summary, today&apos;s check-in result, Academy skills and — when you
            ask about a sport — your level, results and recent activities in it. Today&apos;s food log, diet preferences and allergies are sent only if you switched on nutrition
            sharing in Settings. Your email, body weight, measurements and photos are not sent. Answers are training guidance, not medical advice; clear the conversation at any
            time with the bin icon.
          </p>
        </details>
      )}
      {!ai.configured && (
        <Notice tone="info" icon={<Info className="size-4 text-info" />}>
          No AI provider is configured, so the coach uses built-in rules and your real training data. Everything here still works — set <code className="rounded bg-surface-3 px-1">ANTHROPIC_API_KEY</code> on the server for conversational answers.
        </Notice>
      )}
      <div className="mt-4 flex-1 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <Card className="text-center">
            <Bot className="mx-auto size-10 text-accent" />
            <p className="mt-2 font-semibold">How can I help today?</p>
            <p className="text-sm text-muted">Try one of these:</p>
          </Card>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cx("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-surface-3" : "bg-accent text-accent-fg")}>
                {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div className={cx("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-surface-3" : "border border-line bg-surface")}>
                {m.role === "user" ? <p className="text-sm">{m.content}</p> : <Markdown text={m.content} />}
                {m.action.map((a, i) => (
                  <ActionCard key={i} a={a} />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-fg">
              <Bot className="size-4" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface px-4 py-3" aria-label="Coach is typing">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-2 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-20 mt-4 space-y-2 bg-bg/80 pt-2 backdrop-blur lg:bottom-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {prompts.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={sending} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>
        {sports.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="coach-sport" className="text-muted">
              Coaching for
            </label>
            <select id="coach-sport" value={sport} onChange={(e) => setSport(e.target.value)} className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs">
              <option value="">General training (auto-detect sport)</option>
              {sports.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <form onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor="coach-input" className="sr-only">
            Message the coach
          </label>
          <input
            id="coach-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Ask your coach…"
            className="h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-4 focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="lg" disabled={!text.trim()} loading={sending} icon={<Send className="size-4" />} aria-label="Send" />
        </form>
        <p className="text-[10px] text-subtle">
          {nutritionShared ? "Nutrition logs are shared with the coach." : "Nutrition logs are not shared with the coach."} <Link href="/profile" className="underline">Change</Link>
        </p>
      </div>
    </div>
  );
}
