import { authedRoute } from "@/lib/server/api";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { runAiResearch } from "@/lib/services/research";

/** Runs AI web research for one task (needs ANTHROPIC_API_KEY). Results are saved as unverified claims. */
export const POST = authedRoute({ admin: true }, async ({ user, params }) => {
  rateLimit(`research:${user.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  return runAiResearch(params.id);
});
