import { authedRoute } from "@/lib/server/api";
import { onboardingSchema } from "@/lib/validation";
import { completeOnboarding } from "@/lib/services/profile";

export const POST = authedRoute({ body: onboardingSchema }, async ({ user, body }) => ({ profile: await completeOnboarding(user.id, body) }));
