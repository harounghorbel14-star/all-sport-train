import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { aiConfigured, env } from "../server/env";
import { log } from "../server/logger";

/**
 * Thin server-only wrapper around the Anthropic API. The API key never leaves
 * the server. Every caller has a rule-based fallback, so `AiUnavailableError`
 * is a normal, handled condition.
 */
export class AiUnavailableError extends Error {
  constructor(public reason: "not_configured" | "refused" | "error" | "invalid_output", message: string) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient() {
  if (!aiConfigured()) throw new AiUnavailableError("not_configured", "No AI provider is configured");
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 });
  return client;
}

export const aiStatus = () => ({ configured: aiConfigured(), model: aiConfigured() ? env().AI_MODEL : null, provider: aiConfigured() ? "anthropic" : null });

export type ChatMessage = Anthropic.Beta.BetaMessageParam;

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function handleError(e: unknown): never {
  if (e instanceof AiUnavailableError) throw e;
  if (e instanceof Anthropic.AuthenticationError) {
    log.error("ai_auth_error", { status: e.status });
    throw new AiUnavailableError("error", "The AI provider rejected the configured API key");
  }
  if (e instanceof Anthropic.RateLimitError) throw new AiUnavailableError("error", "The AI provider is rate limiting requests");
  if (e instanceof Anthropic.APIError) {
    log.error("ai_api_error", { status: e.status, message: e.message });
    throw new AiUnavailableError("error", "The AI provider returned an error");
  }
  log.error("ai_unknown_error", { error: e instanceof Error ? e.message : String(e) });
  throw new AiUnavailableError("error", "The AI provider could not be reached");
}

export async function chat(opts: { system: string; messages: ChatMessage[]; maxTokens?: number; effort?: "low" | "medium" | "high" }) {
  const c = getClient();
  try {
    const res = await c.beta.messages.create({
      model: env().AI_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: opts.messages,
      output_config: { effort: opts.effort ?? "low" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal") throw new AiUnavailableError("refused", "The AI declined this request");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new AiUnavailableError("invalid_output", "Empty AI response");
    return { text, model: res.model };
  } catch (e) {
    handleError(e);
  }
}

/** Structured output validated against a zod schema. */
export async function structured<T extends z.ZodType>(opts: { system: string; messages: ChatMessage[]; schema: T; maxTokens?: number; effort?: "low" | "medium" | "high" }): Promise<z.infer<T>> {
  const c = getClient();
  try {
    const res = await c.beta.messages.parse({
      model: env().AI_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: opts.messages,
      output_config: { effort: opts.effort ?? "low", format: zodOutputFormat(opts.schema) },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal") throw new AiUnavailableError("refused", "The AI declined this request");
    const parsed = opts.schema.safeParse(res.parsed_output);
    if (!parsed.success) throw new AiUnavailableError("invalid_output", "The AI returned data in an unexpected format");
    return parsed.data;
  } catch (e) {
    handleError(e);
  }
}

export interface WebResearchResult {
  text: string;
  /** URLs returned by the web_search tool (seen as search results). */
  searched: Map<string, string>;
  /** URLs the web_fetch tool actually opened. */
  fetched: Set<string>;
}

/**
 * Researches a question with Anthropic's server-side web search + web fetch tools.
 * Returns the model's notes plus exactly which URLs were searched and opened, so callers
 * can refuse any citation that wasn't really seen.
 */
export async function webResearch(opts: { system: string; prompt: string; allowedDomains?: string[]; maxSearches?: number; maxFetches?: number }): Promise<WebResearchResult> {
  const c = getClient();
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: opts.maxSearches ?? 6, ...(opts.allowedDomains?.length ? { allowed_domains: opts.allowedDomains } : {}) },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: opts.maxFetches ?? 6, ...(opts.allowedDomains?.length ? { allowed_domains: opts.allowedDomains } : {}) },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const searched = new Map<string, string>();
  const fetched = new Set<string>();
  const texts: string[] = [];
  try {
    // Server tools can pause long turns; resume up to a few times.
    for (let i = 0; i < 4; i++) {
      const res = await c.beta.messages.create({
        model: env().AI_MODEL,
        max_tokens: 16000,
        system: opts.system,
        messages,
        tools,
        output_config: { effort: "medium" },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });
      if (res.stop_reason === "refusal") throw new AiUnavailableError("refused", "The AI declined this research request");
      for (const b of res.content) {
        if (b.type === "text") texts.push(b.text);
        else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          for (const r of b.content) if (r.type === "web_search_result") searched.set(r.url, r.title);
        } else if (b.type === "web_fetch_tool_result" && b.content.type === "web_fetch_result") {
          fetched.add(b.content.url);
        }
      }
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content });
    }
  } catch (e) {
    handleError(e);
  }
  const text = texts.join("\n").trim();
  if (!text) throw new AiUnavailableError("invalid_output", "Empty research response");
  return { text, searched, fetched };
}
