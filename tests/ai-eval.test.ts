/**
 * AI evaluation suite: fixed scenarios with expected behaviour, run against a mocked provider so every
 * failure mode is reproducible. It checks the app's handling (fallbacks, safety rules, privacy, limits,
 * consistency) — it does not, and cannot, measure the quality of a real model's answers.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mode: "ok" as "ok" | "outage" | "rate_limit" | "refusal" | "empty" | "invalid" | "long",
  calls: [] as { kind: "create" | "parse"; args: Record<string, unknown> }[],
}));

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: () => ({ type: "json_schema" }) }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {
    status = 429;
  }
  class AuthenticationError extends APIError {
    status = 401;
  }
  const reply = (kind: "create" | "parse", args: Record<string, unknown>) => {
    state.calls.push({ kind, args });
    if (state.mode === "outage") throw new APIError("boom");
    if (state.mode === "rate_limit") throw new RateLimitError("slow down");
    if (state.mode === "refusal") return { stop_reason: "refusal", content: [], model: "mock" };
    if (state.mode === "empty") return { stop_reason: "end_turn", content: [{ type: "text", text: "  " }], model: "mock" };
    if (state.mode === "invalid") return { stop_reason: "end_turn", content: [], parsed_output: { nonsense: true }, model: "mock" };
    const text = state.mode === "long" ? "x".repeat(5000) : "AI answer based on the app data.";
    return { stop_reason: "end_turn", content: [{ type: "text", text }], parsed_output: null, model: "mock" };
  };
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    beta = { messages: { create: async (a: Record<string, unknown>) => reply("create", a), parse: async (a: Record<string, unknown>) => reply("parse", a) } };
  }
  return { default: Anthropic };
});

import { db } from "@/lib/server/db";
import { seed } from "../prisma/seed";
import { resetEnvCache } from "@/lib/server/env";
import { aiStatus } from "@/lib/ai/provider";
import { coachReply } from "@/lib/ai/coach";
import { analyzeForm } from "@/lib/ai/form-check";
import { recommend, type RecommendationInput } from "@/lib/domain/recommendation";
import { nextRecommendation } from "@/lib/services/recommendation";
import { newUser } from "./helpers";

type Outcome = { scenario: string; expectation: string; pass: boolean };
const scorecard: Outcome[] = [];
const record = (scenario: string, expectation: string, pass: boolean) => {
  scorecard.push({ scenario, expectation, pass });
  expect(pass, `${scenario}: ${expectation}`).toBe(true);
};

beforeAll(async () => {
  await seed(db);
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  resetEnvCache();
});
afterAll(() => {
  const passed = scorecard.filter((s) => s.pass).length;
  // Provider configuration is recorded (names only, never the key).
  console.log(`AI eval — provider ${aiStatus().provider ?? "none"} (mocked), model setting ${process.env.AI_MODEL ?? "default"}: ${passed}/${scorecard.length} expectations met`);
  console.table(scorecard);
  process.env.ANTHROPIC_API_KEY = "";
  resetEnvCache();
});

const ask = async (message: string, mode: typeof state.mode, setup?: (userId: string) => Promise<void>) => {
  const { userId } = await newUser();
  await setup?.(userId);
  state.mode = mode;
  state.calls = [];
  const reply = await coachReply(userId, message);
  const { email } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  return { reply, calls: state.calls.slice(), email };
};
const sentText = (calls: typeof state.calls) => JSON.stringify(calls.map((c) => [c.args.system, c.args.messages]));

describe("AI evaluation: provider failures fall back to rule-based answers", () => {
  for (const mode of ["outage", "rate_limit", "refusal", "empty"] as const) {
    it(`coach — ${mode}`, async () => {
      const { reply, calls } = await ask("Give me a 20 minute workout", mode);
      record(`coach ${mode}`, "the provider was tried", calls.length === 1);
      record(`coach ${mode}`, "the answer is the labelled rule-based one", reply.provider === "rules" && reply.content.length > 0);
    });
  }

  it("form check — output that fails validation is never shown as AI analysis", async () => {
    state.mode = "invalid";
    const r = await analyzeForm("push-up", [{ data: "aGVsbG8=", mediaType: "image/jpeg" }], "photo");
    record("form check invalid output", "falls back to the guided self-review", r.provider === "guided");
    record("form check invalid output", "keeps the not-medical disclaimer", /not a medical/.test(r.disclaimer));
  });

  it("a working provider is labelled as AI", async () => {
    const { reply } = await ask("Give me a 20 minute workout", "ok");
    record("coach ok", "the answer is labelled as from the AI", reply.provider === "ai");
  });
});

describe("AI evaluation: safety rules don't depend on the model", () => {
  it("an emergency is answered by fixed safety guidance without calling the model", async () => {
    const { reply, calls } = await ask("I have chest pain and feel faint, should I push through my workout?", "ok");
    record("emergency", "no model call", calls.length === 0);
    record("emergency", "rule-based safety reply", reply.provider === "rules" && /emergency|medical/i.test(reply.content));
  });

  it("reported pain adds the injury guidance in front of any model text", async () => {
    const { reply } = await ask("My knee hurts when I squat, what should I train today?", "ok");
    const first = reply.content.split("\n\n")[0];
    record("injury", "injury guidance comes first", /pain|hurt|injur/i.test(first));
  });

  it("the model is told to use the app's data, not invent plans", async () => {
    const { calls } = await ask("Give me a 20 minute workout", "ok");
    record("grounding", "the request carries the app-computed data block", /<app_data>/.test(sentText(calls)));
  });
});

describe("AI evaluation: privacy settings change what is sent", () => {
  const withAllergy = (share: boolean) => async (userId: string) => {
    await db.profile.update({ where: { userId }, data: { allergies: JSON.stringify(["peanuts"]), nutritionInCoach: share } });
  };
  it("nutrition sharing off: no allergies or diet data leave the app", async () => {
    const { calls } = await ask("What should I eat after training?", "ok", withAllergy(false));
    record("privacy off", "allergies not sent", !/peanut/i.test(sentText(calls)));
  });
  it("nutrition sharing on: allergies are included so advice can respect them", async () => {
    const { calls } = await ask("What should I eat after training?", "ok", withAllergy(true));
    record("privacy on", "allergies sent", /peanut/i.test(sentText(calls)));
  });
  it("email is never sent", async () => {
    const { calls, email } = await ask("How am I doing?", "ok");
    record("privacy email", "the user's email address is not in the request", !!email && calls.length === 1 && !sentText(calls).includes(email));
  });
});

describe("AI evaluation: limits and consistency", () => {
  it("requests are bounded in length", async () => {
    const { calls } = await ask("Plan my week", "ok");
    record("limits", "max_tokens ≤ 2000 for coach replies", calls.every((c) => Number(c.args.max_tokens) <= 2000));
  });

  it("repeated recommendation requests give the same answer", async () => {
    const { userId } = await newUser();
    const a = await nextRecommendation(userId);
    const b = await nextRecommendation(userId);
    record("consistency", "same kind, difficulty and minutes", a.kind === b.kind && a.difficulty === b.difficulty && a.minutes === b.minutes);
  });
});

describe("AI evaluation: deterministic recommendation rules", () => {
  const base: RecommendationInput = { today: "2026-10-14", isTrainingDay: true, doneToday: false, checkIn: null, recent: [], lastActiveDate: null, plannedMinutes: 40, series: [], missingPrerequisites: [] };
  it("missing check-in is never read as recovery", () => {
    const r = recommend(base);
    record("missing data", "readiness listed as unknown", r.dataGaps.some((g) => /readiness is unknown/.test(g)));
    record("missing data", "no claim of being recovered", !r.reasons.some((x) => /recovered/i.test(x)));
  });
  it("feedback can't override pain", () => {
    const r = recommend({ ...base, checkIn: { band: "rest", readiness: 70, pain: true }, feedback: { declinedLighter: 5, modifiedMinutes: [60, 60, 60] } });
    record("feedback vs safety", "pain still means recovery", r.kind === "recover");
  });
  it("missing prerequisites are surfaced, not skipped", () => {
    const r = recommend({ ...base, missingPrerequisites: [{ skill: "Handstand", step: "Wall handstand", missing: ["Pike push-up"] } as never] });
    record("prerequisites", "listed in the recommendation", r.prerequisites.length === 1);
  });
});
