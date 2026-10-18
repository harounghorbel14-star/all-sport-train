import { db } from "../server/db";
import { AVAILABILITY_LABELS, levelRank } from "../content/sports/types";
import { createPractice, getSportHub, publishedSports, sportReview, sportWeek, type SportHub } from "../services/sports";
import type { CoachAction } from "./coach";
import { recordKnowledgeGap, searchKnowledge, type KnowledgeHit } from "../services/research";

/**
 * Sport-aware coaching. Every answer separates:
 *  - Official rules (summaries of cited sources, with review dates)
 *  - Coaching suggestions (our guidance, not rules)
 *  - Uncertain / check locally (competition- and age-specific variations)
 */

export type SportIntent = "rules" | "practice" | "plan" | "week" | "review" | "positions" | "safety" | "overview";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find the sport a message is about (longest name/alias match wins). */
export async function detectSport(text: string): Promise<string | null> {
  const t = ` ${text.toLowerCase()} `;
  let best: { slug: string; len: number } | null = null;
  for (const s of await publishedSports()) {
    for (const name of [s.name, s.name.split(" / ")[0], ...s.aliases]) {
      const n = name.toLowerCase().trim();
      if (n.length < 3) continue;
      if (new RegExp(`[^a-z0-9]${escape(n)}[^a-z0-9]`, "i").test(t) && (!best || n.length > best.len)) best = { slug: s.slug, len: n.length };
    }
  }
  return best?.slug ?? null;
}

export function detectSportIntent(text: string): { intent: SportIntent; minutes?: number } {
  const t = text.toLowerCase();
  const m = t.match(/(\d{1,3})\s*(min|minutes|mins)\b/);
  const minutes = m ? Math.min(180, Math.max(10, Number(m[1]))) : undefined;
  if (/\b(rule|rules|offside|foul|fouls|scor(e|ing)|legal|illegal|allowed|referee|umpire|penalt|travel(l)?ing|strike zone|let\b|deuce|tie-?break|how (does|do) .* work)/.test(t)) return { intent: "rules" };
  if (/\b(safe|safety|injur|spar|contact|concussion|protect)/.test(t)) return { intent: "safety" };
  if (/\b(position|positions|role|formation|formations)\b/.test(t)) return { intent: "positions" };
  if (/\b(week|weekly|schedule)\b/.test(t)) return { intent: "week" };
  if (/\b(review|analy[sz]e|how am i doing|progress report|my progress)\b/.test(t)) return { intent: "review" };
  if (/\b(practice|practise|session|drill|drills|train|training|workout)\b/.test(t) || minutes) return { intent: "practice", minutes };
  if (/\b(learn|start|beginner|begin|plan|path|next lesson|teach)\b/.test(t)) return { intent: "plan" };
  return { intent: "overview" };
}

const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "not yet reviewed");

function rulesSection(hub: SportHub, query: string) {
  if (!hub.rulesets.length) {
    return `**Official rules**\nWe don't have a reviewed rules summary for ${hub.sport.name} yet. Please check the current rulebook of the sport's governing body or your league.`;
  }
  const words = query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const parts = hub.rulesets.map((r) => {
    const sources = r.sources.map((s) => hub.sources.find((x) => x.slug === s)?.title ?? s).join(", ");
    const relevant = r.points.filter((p) => words.some((w) => p.topic.toLowerCase().includes(w) || p.text.toLowerCase().includes(w)));
    const points = (relevant.length ? relevant : r.points).slice(0, relevant.length ? 6 : 5);
    const label = r.verification === "summary" ? "Rules summary (checked against the cited source)" : r.verification === "general" ? "General overview — not yet verified against the current rulebook" : "Unverified";
    const flag = r.reviewFlag ? `\n⚠️ Possibly outdated: ${r.reviewFlag}` : "";
    return `**Official rules — ${r.name}** · ${label}\nSource: ${sources} · reviewed ${fmtDate(r.reviewedAt)}${flag}\n${points.map((p) => `- **${p.topic}:** ${p.text}`).join("\n")}\n_${r.editionNote}_`;
  });
  return parts.join("\n\n");
}

const uncertainty = (hub: SportHub) =>
  `**Uncertain / check locally**\n- Youth, amateur and professional competitions often modify rules (match length, equipment, substitutions).\n- Rules are updated regularly — confirm with your league or federation's current edition.${hub.profile.ageGuidance ? `\n- ${hub.profile.ageGuidance}` : ""}`;

const isSpecificQuestion = (t: string) => /\?|\b(how|why|what|when|which|explain|difference|technique|improve|fix|correct)\b/i.test(t) && t.trim().split(/\s+/).length >= 4;

const VERIF_LABEL: Record<string, string> = { verified: "verified claim", editorial: "APEX lesson content", general: "rules overview — not yet verified against the current rulebook", summary: "rules summary checked against source" };

export function knowledgeSection(hits: KnowledgeHit[]) {
  return hits
    .map((h) => {
      const src = h.sources.length ? ` — Source: ${h.sources.map((s) => `${s.title}${s.section ? ` (${s.section})` : ""}`).join("; ")}` : "";
      return `- **${h.title}** _(${VERIF_LABEL[h.verification] ?? h.verification})_: ${h.text.slice(0, 280)}${src}`;
    })
    .join("\n");
}

/** Deterministic sport answer + structured facts for the AI model. */
export async function sportDraft(userId: string, slug: string, text: string, loaded?: SportHub): Promise<{ text: string; actions: CoachAction[]; facts: string }> {
  const hub = loaded ?? (await getSportHub(slug, userId));
  const { intent, minutes } = detectSportIntent(text);
  const s = hub.sport;
  const level = hub.user?.enrollment?.level ?? "beginner";
  const actions: CoachAction[] = [{ type: "sport", slug: s.slug, name: s.name }];
  const availabilityNote = s.availability !== "full" ? `\n\n_${AVAILABILITY_LABELS[s.availability].label}: ${AVAILABILITY_LABELS[s.availability].body}_` : "";
  const supervision = hub.profile.supervisionNote ? `\n\n**Safety:** ${hub.profile.supervisionNote}` : "";

  if (intent === "rules") {
    const out = `${rulesSection(hub, text)}\n\n${uncertainty(hub)}`;
    return { text: out, actions, facts: out };
  }

  if (intent === "practice") {
    if (!hub.drills.length) {
      const templates = hub.profile.templates ?? [];
      const out = `**Coaching suggestion**\n${s.name} doesn't have a drill library yet, so I can't build a full practice plan.${templates.length ? `\nHere's a starting template:\n${templates.map((t) => `- **${t.title}** (${t.durationMin} min, ${t.intensity}): ${t.structure.join(" → ")}`).join("\n")}` : ""}${availabilityNote}${supervision}`;
      return { text: out, actions, facts: out };
    }
    const plan = await createPractice(userId, slug, { minutes: minutes ?? 45, focus: "balanced", setting: "solo", players: 1 }, "coach");
    const content = JSON.parse(plan.content) as { blocks: { title: string; minutes: number }[]; excluded: { title: string; reason: string }[] };
    const out = `**Coaching suggestion — ${plan.title} (${plan.minutes} min, ${level})**\n${content.blocks.map((b) => `- ${b.title} — ${b.minutes} min`).join("\n")}\n\nBuilt for solo practice at your level. Open it to change the setting (partner/team), log results and complete it.${content.excluded.some((e) => /coach|supervis|contact/i.test(e.reason)) ? "\n\n**Safety:** partner-contact drills were left out — they need a qualified coach." : ""}`;
    actions.push({ type: "practice", planId: plan.id, title: plan.title, minutes: plan.minutes, sport: s.slug });
    return { text: out, actions, facts: out };
  }

  // Specific questions are answered from retrieved knowledge (published lessons/drills/rules + verified claims).
  if (intent === "overview" && isSpecificQuestion(text)) {
    const hits = await searchKnowledge(text, { sportSlug: slug, limit: 4 });
    if (hits.length) {
      const out = `**From the ${s.name} knowledge base**\n${knowledgeSection(hits)}\n\n**Coaching suggestion**\nPractise this with the related drills and log a benchmark so you can see progress.\n\n**Uncertain / check locally**\n- If your question is about something not covered above, I don't have verified information on it yet.`;
      for (const h of hits.filter((x) => x.kind === "lesson").slice(0, 1)) actions.push({ type: "link", href: h.href, label: `Open lesson: ${h.title}` });
      return { text: out, actions, facts: out };
    }
    const queued = await recordKnowledgeGap(slug, text, userId);
    const out = `I don't have verified ${s.name} information that answers this yet, so I won't guess.${queued ? " I've added your question to the research queue." : ""}\n\nIn the meantime: check the current rulebook of your league or federation for rules questions, and ask a qualified coach for technique feedback.${supervision}`;
    return { text: out, actions, facts: "NO_VERIFIED_KNOWLEDGE: the knowledge base has nothing on this question. Say you don't have verified information; do not answer from memory." };
  }

  if (intent === "plan" || intent === "overview") {
    if (!hub.lessons.length) {
      const tips = hub.profile.beginner ?? [];
      const out = `**${s.name}** — ${s.summary}\n\n**Coaching suggestion**\n${tips.length ? tips.map((t) => `- ${t}`).join("\n") : "- Start with short, easy sessions and build gradually."}${hub.profile.externalResources?.length ? `\n\n**Requires external instruction:** ${hub.profile.externalResources.map((r) => r.note).join(" ")}` : ""}${availabilityNote}`;
      return { text: out, actions, facts: out };
    }
    const done = new Set(hub.user?.completedLessons ?? []);
    const path = hub.lessons.filter((l) => levelRank(l.level) <= levelRank(level) + 1);
    const next = hub.lessons.find((l) => l.slug === hub.user?.nextLesson);
    const out = `**${s.name} learning path (${level})** — ${done.size}/${hub.lessons.length} lessons completed\n${path.map((l) => `- ${done.has(l.slug) ? "✓" : "○"} ${l.title} _(${l.level})_`).join("\n")}\n\n**Coaching suggestion**\n${next ? `Next up: **${next.title}** — ${next.summary}` : "You've completed the lessons available at your level — focus on practice and the milestones."}\nPair each lesson with 2–3 practices using its drills, and log a benchmark so progress is measurable.${supervision}`;
    if (next) actions.push({ type: "lesson", sport: s.slug, slug: next.slug, title: next.title });
    return { text: out, actions, facts: out };
  }

  if (intent === "week") {
    const week = await sportWeek(userId, slug);
    const out = `**Coaching suggestion — ${s.name} week**\n${week.map((d) => `- **${WEEKDAY[d.weekday]}:** ${d.focus}${d.examples.length ? ` (e.g. ${d.examples.join(", ")})` : ""}`).join("\n")}\n\nKeep at least one full rest day, and fit these around your strength sessions on the Today page.`;
    return { text: out, actions, facts: out };
  }

  if (intent === "review") {
    const r = await sportReview(userId, slug);
    const trends = r.trends.map((t) => `- ${t.label}: ${t.first} → ${t.last}${t.unit ? ` ${t.unit}` : ""} (${t.count} entries${t.improved ? ", improving" : ""})`).join("\n");
    const out = `**${s.name} — last 4 weeks** (from your logged data)\n- Sessions: ${r.sessions} · Time: ${r.minutes} min\n- Lessons completed: ${r.completedLessons}/${r.totalLessons}\n${trends || "- No benchmark results logged yet."}\n\n**Coaching suggestions**\n${r.recommendations.map((x) => `- ${x}`).join("\n") || "- Keep going — consistency is working."}`;
    return { text: out, actions, facts: out };
  }

  if (intent === "positions") {
    const pos = hub.profile.positions ?? [];
    const forms = hub.profile.formations ?? [];
    const out = pos.length
      ? `**${s.name} positions**\n${pos.map((p) => `- **${p.name}:** ${p.role}`).join("\n")}${forms.length ? `\n\n**Common formations / systems**\n${forms.map((f) => `- **${f.name}:** ${f.description}`).join("\n")}` : ""}\n\n**Coaching suggestion**\nBeginners benefit from trying several positions before specialising.`
      : `${s.name} doesn't use fixed team positions in our content.`;
    return { text: out, actions, facts: out };
  }

  // safety
  const out = `**${s.name} safety**\n${[...(hub.profile.safety ?? []), ...(hub.profile.injuryPrevention ?? [])].map((x) => `- ${x}`).join("\n") || "- Warm up, progress gradually and stop if something hurts."}${supervision}${hub.profile.ageGuidance ? `\n\n**Young athletes:** ${hub.profile.ageGuidance}` : ""}\n\nI can't diagnose injuries — for pain or a suspected head injury, stop and see a qualified professional.`;
  return { text: out, actions, facts: out };
}

/** Compact sport context for the AI model. */
export async function sportContext(userId: string, slug: string, loaded?: SportHub) {
  const hub = loaded ?? (await getSportHub(slug, userId));
  const acts = await db.activityEntry.findMany({ where: { userId, sport: slug }, orderBy: { dateKey: "desc" }, take: 8 });
  const e = hub.user?.enrollment;
  const pbs = Object.entries(hub.user?.personalBests ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${hub.metrics.find((m) => m.key === k)?.label}: ${v!.value}`)
    .join("; ");
  return [
    `Selected sport: ${hub.sport.name} (${AVAILABILITY_LABELS[hub.sport.availability].label}). ${hub.sport.summary}`,
    `User in this sport: ${e ? `level ${e.level}${e.position ? `, position ${e.position}` : ""}${e.supervised ? ", trains with a qualified coach" : ", no qualified coach recorded"}` : "not enrolled (treat as beginner)"}.`,
    `Lessons completed: ${hub.user?.completedLessons.length ?? 0}/${hub.lessons.length}. Next lesson: ${hub.lessons.find((l) => l.slug === hub.user?.nextLesson)?.title ?? "none"}.`,
    `Recent sessions: ${acts.map((a) => `${a.dateKey} ${Math.round(a.durationMin)} min ${a.intensity}`).join("; ") || "none"}.`,
    `Personal bests: ${pbs || "none logged"}.`,
    `Rulesets available: ${hub.rulesets.map((r) => `${r.name} (${r.verification}, reviewed ${fmtDate(r.reviewedAt)})`).join("; ") || "none — do not state official rules; tell the user to check the governing body"}.`,
    hub.profile.supervisionNote ? `Supervision requirement: ${hub.profile.supervisionNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const SPORT_RULES = `When discussing a specific sport:
- Structure answers with clear labels: "Official rules (summary)" only for content provided in <app_data> with its source; "Coaching suggestion" for your own advice; "Uncertain / check locally" for anything that varies by league, age group or edition.
- Never invent official rules, numbers, rankings or statistics. If the rule isn't in the provided data, say you don't have a verified summary and point to the governing body.
- For combat and contact sports, never prescribe sparring or contact drills; recommend a qualified instructor for any partner contact.
- For sports marked as requiring external instruction, recommend certified instructors and limit advice to general conditioning.
- If <app_data> says NO_VERIFIED_KNOWLEDGE, say plainly that you don't have verified information on that question yet and that it has been added to the research queue. Do not answer it from memory.
- Rulesets marked "possibly outdated" must be presented with that warning.`;
