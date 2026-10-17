import { authedRoute } from "@/lib/server/api";
import { settingsSchema } from "@/lib/validation";
import { getProfile, updateSettings } from "@/lib/services/profile";

export const GET = authedRoute({}, async ({ user }) => ({ profile: await getProfile(user.id), user: { email: user.email, role: user.role, tier: user.tier } }));
export const PATCH = authedRoute({ body: settingsSchema }, async ({ user, body }) => ({ profile: await updateSettings(user.id, body) }));
