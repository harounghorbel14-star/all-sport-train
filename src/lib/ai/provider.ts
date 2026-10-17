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
