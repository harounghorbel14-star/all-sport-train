import { authedRoute } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { checkSources } from "@/lib/services/research";

/** Checks up to 10 registered sources for changes (robots.txt respected). The scheduled job checks more. */
export const POST = authedRoute({ admin: true }, async ({ user }) => {
  rateLimit(`check-sources:${user.id}`, 3, 60 * 60_000);
  return checkSources({ limit: 10, delayMs: 500 });
});
