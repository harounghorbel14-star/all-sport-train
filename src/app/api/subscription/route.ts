import { authedRoute } from "@/lib/server/api";
import { paymentsConfigured, TIERS, tiersEnforced } from "@/lib/subscriptions";

export const GET = authedRoute({}, async ({ user }) => ({ current: user.tier, tiers: TIERS, enforced: tiersEnforced(), paymentsConfigured: paymentsConfigured() }));
