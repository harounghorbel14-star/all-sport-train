import { z } from "zod";
import { db } from "../server/db";
import { parseJson } from "../server/json";
import { log } from "../server/logger";
import { EXERCISE_CATALOG } from "../content/exercises";
import { SKILL_BY_SLUG } from "../content/skills";
import { PHASES } from "../engine/roadmap";
import { allExercises } from "../services/exercises";
import { createPlan, generateForUser } from "../services/workouts";
import { calorieGuidance, proteinGuidance } from "../domain/energy";
import { bestFoodMatch } from "../domain/nutrition";
import { AiUnavailableError, aiStatus, chat, type ChatMessage } from "./provider";
import { detectIntent, type Intent } from "./intents";
import { areasFromText, COACH_RULES, SAFETY_MESSAGES, screen } from "./safety";
import { buildCoachContext, type FourWeekStats } from "./context";
import { detectSport, sportContext, sportDraft, SPORT_RULES } from "./sport-coach";
import { sportBySlug } from "../services/sports";

export const coachActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("workout"), planId: z.string(), title: z.string(), minutes: z.number(), exercises: z.array(z.string()) }),
  z.object({ type: z.literal("exercise"), slug: z.string(), name: z.string() }),
  z.object({ type: z.literal("skill"), slug: z.string(), name: z.string() }),
  z.object({ type: z.literal("analysis"), weeks: z.array(z.object({ start: z.string(), workouts: z.number(), minutes: z.number() })), adherence: z.number() }),
  z.object({ type: z.literal("link"), href: z.string(), label: z.string() }),
  z.object({ type: z.literal("sport"), slug: z.string(), name: z.string() }),
  z.object({ type: z.literal("practice"), planId: z.string(), title: z.string(), minutes: z.number(), sport: z.string() }),
  z.object({ type: z.literal("lesson"), sport: z.string(), slug: z.string(), title: z.string() }),
]);
export type CoachAction = z.infer<typeof coachActionSchema>;

interface Draft {
  text: string;
  actions: CoachAction[];
  facts: string; // structured facts handed to the AI so it explains real data
}

const nameOf = (slug: string) => EXERCISE_CATALOG.find((e) => e.slug === slug)?.name ?? slug;

async function workoutAction(userId: string, overrides: Parameters<typeof generateForUser>[1]): Promise<{ action: CoachAction; summary: string }> {
  const { workout } = await generateForUser(userId, overrides);
  const plan = await createPlan(userId, workout, "coach");
  const list = workout.main.map((b) => `${nameOf(b.exercise)} — ${b.sets}×${b.seconds ? `${b.seconds}s` : `${b.repMin}–${b.repMax}`}`);
  return {
    action: { type: "workout", planId: plan.id, title: workout.title, minutes: workout.estimatedMinutes, exercises: workout.main.map((b) => b.exercise) },
    summary: `${workout.title} (~${workout.estimatedMinutes} min):\n${list.map((l) => `• ${l}`).join("\n")}${workout.notes.length ? `\n\n${workout.notes[0]}` : ""}`,
  };
}

function analysisText(stats: FourWeekStats) {
  if (!stats.totalWorkouts) return "I don't see any completed workouts in the last four weeks yet, so there's nothing to analyse. Log your next session and I'll have real data to work with.";
  const trend = stats.weeks.map((w) => w.workouts);
  const improving = stats.topExercises.filter((e) => e.best > e.first);
  return [
    `Over the last four weeks you completed ${stats.totalWorkouts} of about ${stats.planned} planned sessions (${stats.adherence}% adherence). Week by week: ${trend.join(" → ")}.`,
    improving.length ? `Improvements: ${improving.map((e) => `${e.name} ${e.first}→${e.best} ${e.unit}`).join(", ")}.` : "No clear performance jumps yet — that's normal early on; consistency comes first.",
    stats.painDays ? `You reported pain on ${stats.painDays} day(s). Keep avoiding movements that aggravate it, and consider a professional assessment if it persists.` : "",
    stats.adherence < 60 ? "Biggest lever right now: consistency. Consider fewer or shorter sessions you can reliably complete." : "Your consistency is solid — keep logging every set so progressions unlock at the right time.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Deterministic, data-driven response used directly when no AI is configured, and as facts for the AI otherwise. */
async function draftReply(userId: string, text: string, intent: Intent, minutes?: number): Promise<Draft> {
  const ctx = await buildCoachContext(userId);
  const p = ctx.profile;
  switch (intent) {
    case "workout_today":
    case "short_workout": {
      const { action, summary } = await workoutAction(userId, { minutes });
      const lead = ctx.readiness.band === "rest" ? "Your check-in suggests recovery, so here's a gentle mobility session:" : `Here's your ${minutes ? `${minutes}-minute ` : ""}session, built from your equipment, history and today's readiness:`;
      return { text: `${lead}\n\n${summary}\n\nOpen it to edit, swap exercises or start live mode.`, actions: [action], facts: summary };
    }
    case "fatigue_adapt": {
      const avoid = areasFromText(text);
      const { action, summary } = await workoutAction(userId, { avoidMuscles: avoid, minutes: Math.min(p.sessionMinutes, 30) });
      return {
        text: `Thanks for flagging that. I've built a lighter session that keeps load away from ${avoid.length ? "the area you mentioned" : "tired areas"}:\n\n${summary}\n\nIf it's pain rather than normal fatigue — sharp, swelling, or getting worse — stop and get it checked by a professional. A full rest day is also a great choice.`,
        actions: [action, { type: "link", href: "/recovery", label: "Open recovery routines" }],
        facts: `Adapted workout avoiding: ${avoid.join(", ") || "general fatigue"}\n${summary}`,
      };
    }
    case "first_pullup": {
      const hasBar = p.equipment.includes("pullup_bar");
      const skill = SKILL_BY_SLUG.get("first-pull-up")!;
      const t = hasBar
        ? `That's one of the most common goals — and very achievable. Your path in the Academy:\n\n${skill.steps.map((s, i) => `${i + 1}. ${s.title} — ${s.target.sets}×${s.target.value}${s.target.metric === "seconds" ? "s" : ""}`).join("\n")}\n\nAdd inverted or band rows and hollow holds 2–3× per week. Pulling recovers best with ~48 h between hard sessions. Typical timelines range from weeks to several months — your starting strength and bodyweight matter, so focus on steady progress.`
        : "To train toward a pull-up you'll need somewhere to hang from — a doorway pull-up bar or a sturdy bar at a park. Until then, build pulling strength with band rows, very sturdy table rows or prone Y-T-W raises, plus hollow holds. Add the pull-up bar in your profile when you get one and I'll switch your plan over.";
      return { text: t, actions: hasBar ? [{ type: "skill", slug: skill.slug, name: skill.name }] : [{ type: "link", href: "/profile", label: "Update equipment" }], facts: t };
    }
    case "teach_exercise": {
      const all = await allExercises();
      const match = bestFoodMatch(text.replace(/teach me|how (do|to|should) i|proper|perform|technique|form|a |do /gi, " "), all);
      if (!match) {
        return { text: "Which exercise would you like to learn? For example: “Teach me a proper push-up”.", actions: [{ type: "link", href: "/exercises", label: "Browse the exercise library" }], facts: "No exercise matched." };
      }
      const e = match.food;
      const t = `**${e.name}** — ${e.description}\n\n**How to do it**\n${e.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n**Breathing:** ${e.breathing}\n\n**Common mistakes:** ${e.mistakes.join("; ")}.${e.easier.length ? `\n\n**Too hard?** Try ${e.easier.map(nameOf).join(" or ")}.` : ""}${e.safety.length ? `\n\n**Safety:** ${e.safety.join(" ")}` : ""}`;
      return { text: t, actions: [{ type: "exercise", slug: e.slug, name: e.name }], facts: t };
    }
    case "analyze_progress":
    case "plateau": {
      let t = analysisText(ctx.stats);
      if (intent === "plateau") {
        t += `\n\nCommon reasons progress slows: inconsistent sessions, too little sleep, not enough protein or total food, training too close to failure every set, or staying on the same variation too long. ${ctx.stats.avgReadiness != null && ctx.stats.avgReadiness < 55 ? "Your recent readiness scores are low, so recovery is a likely factor." : ""} Progress also naturally slows as you get stronger — that's not failure.`;
      }
      return {
        text: t,
        actions: [{ type: "analysis", weeks: ctx.stats.weeks.map((w) => ({ start: w.start, workouts: w.workouts, minutes: w.minutes })), adherence: ctx.stats.adherence }],
        facts: JSON.stringify(ctx.stats),
      };
    }
    case "next_block": {
      const next = PHASES.find((ph) => ph.index === Math.min(6, ctx.roadmap.phase.index + 1))!;
      const t = `You're in week ${ctx.roadmap.week}, phase ${ctx.roadmap.phase.index} (${ctx.roadmap.phase.name}). Next block: **${next.name}** — ${next.focus}.\n\nGoals:\n${next.goals.map((g) => `• ${g}`).join("\n")}\n\nMilestones to aim for:\n${next.milestones.map((m) => `• ${m}`).join("\n")}\n\nYour sessions adapt automatically from your logged sets and weekly reviews; completing your weekly review is how you tell me to repeat, deload or move on.`;
      return { text: t, actions: [{ type: "link", href: "/plans", label: "Open your roadmap" }], facts: t };
    }
    case "meal_suggestion": {
      const g = calorieGuidance(p, p.goals);
      const protein = proteinGuidance(p.weightKg, p.goals);
      const veg = p.dietPrefs.includes("vegan") || p.dietPrefs.includes("vegetarian");
      const meal = veg
        ? "Lentil and chickpea bowl with brown rice, roasted vegetables and a tahini drizzle"
        : "Grilled chicken or fish, rice or potatoes, a big serving of vegetables and a little olive oil";
      const t = `A balanced plate: roughly half vegetables, a quarter protein, a quarter starchy carbs, plus some healthy fat. For example: ${meal}.${protein ? ` A daily protein target around ${protein.grams} g (≈${protein.perKg} g/kg) suits your goals.` : ""}${g.target ? ` Your estimated daily energy target is ~${g.target} kcal — an estimate, so adjust based on energy levels and trends.` : ""} ${g.note}${p.allergies.length ? `\n\nRemember to avoid: ${p.allergies.join(", ")}.` : ""}`;
      return { text: t, actions: [{ type: "link", href: "/nutrition", label: "Log a meal" }], facts: t };
    }
    default: {
      const t = `I can build today's workout, adapt it when you're tired or short on time, teach technique, analyse your last four weeks, plan your next block, or suggest balanced meals. Try one of the prompts below.`;
      return { text: t, actions: [], facts: "" };
    }
  }
}

const SYSTEM = (ctx: string, sport?: string) => `You are APEX Coach, a knowledgeable, encouraging strength & calisthenics coach inside a fitness app${sport ? " that also coaches many sports" : ""}.
Be concise, practical and warm. Use short paragraphs or bullet points. Never shame the user.

${COACH_RULES}
${sport ? `\n${SPORT_RULES}\n` : ""}
User context (from their logged data):
${ctx}${sport ? `\n\nSport context:\n${sport}` : ""}`;

/** General fitness modalities: only treated as a sport conversation when the user picked them explicitly. */
const FITNESS_MODALITIES = new Set(["mobility", "hiit", "yoga", "pilates", "gym", "strength", "athletic", "walking"]);

/** Which sport (if any) this message should be answered for. */
async function resolveSport(text: string, intent: Intent, explicit?: string) {
  const slug = explicit ?? (await detectSport(text));
  if (!slug) return null;
  const sport = await sportBySlug(slug);
  if (!sport) return null;
  if (!explicit && FITNESS_MODALITIES.has(slug)) return null;
  // Workout-based sports (calisthenics, strength…) use the workout engine for workout requests.
  if (sport.workoutBased && intent !== "general") return null;
  return sport.slug;
}

export async function coachReply(userId: string, text: string, sportSlug?: string) {
  await db.coachMessage.create({ data: { userId, role: "user", content: text } });
  const flags = screen(text);
  const { intent, minutes } = detectIntent(text);

  // Crisis-level concerns get a direct, safe response without training content.
  if (flags.includes("self_harm") || flags.includes("emergency")) {
    const msg = flags.map((f) => SAFETY_MESSAGES[f]).join("\n\n");
    return db.coachMessage.create({ data: { userId, role: "assistant", content: msg, provider: "rules" } });
  }

  const effective = flags.includes("injury") && intent === "general" ? "fatigue_adapt" : intent;
  const sport = effective === "fatigue_adapt" && !sportSlug ? null : await resolveSport(text, effective, sportSlug);
  const draft = sport ? await sportDraft(userId, sport, text) : await draftReply(userId, text, effective, minutes);
  const prefix = flags.map((f) => SAFETY_MESSAGES[f]).join("\n\n");
  let content = draft.text;
  let provider: "ai" | "rules" = "rules";

  if (aiStatus().configured) {
    try {
      const ctx = await buildCoachContext(userId);
      const sportCtx = sport ? await sportContext(userId, sport) : undefined;
      const history = await db.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 12 });
      const messages: ChatMessage[] = history
        .reverse()
        .slice(0, -1)
        .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }));
      // Ensure alternation starts with a user turn.
      while (messages.length && messages[0].role !== "user") messages.shift();
      const merged: ChatMessage[] = [];
      for (const m of messages) {
        const last = merged[merged.length - 1];
        if (last && last.role === m.role) last.content = `${last.content as string}\n\n${m.content as string}`;
        else merged.push({ ...m });
      }
      if (merged.length && merged[merged.length - 1].role === "user") merged.pop();
      merged.push({
        role: "user",
        content: `${text}\n\n<app_data>\nThe app computed the following for this request (intent: ${sport ? `sport:${sport}` : intent}). Base your answer on it; do not invent other exercises, numbers or plans:\n${draft.facts || "(no extra data)"}\n</app_data>`,
      });
      const res = await chat({ system: SYSTEM(ctx.text, sportCtx), messages: merged, maxTokens: 2000, effort: "low" });
      content = res.text;
      provider = "ai";
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
      log.warn("coach_ai_fallback", { reason: e.reason });
    }
  }

  return db.coachMessage.create({
    data: {
      userId,
      role: "assistant",
      content: prefix ? `${prefix}\n\n${content}` : content,
      provider,
      action: draft.actions.length ? JSON.stringify(draft.actions) : null,
    },
  });
}

export async function coachHistory(userId: string, limit = 50) {
  const rows = await db.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: Math.min(limit, 200) });
  return rows.reverse().map((m) => ({ ...m, action: parseJson(m.action, z.array(coachActionSchema), []) }));
}

export async function clearCoachHistory(userId: string) {
  await db.coachMessage.deleteMany({ where: { userId } });
}
