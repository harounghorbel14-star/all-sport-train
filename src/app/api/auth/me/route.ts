import { authedRoute } from "@/lib/server/api";
import { getProfile } from "@/lib/services/profile";

export const GET = authedRoute({}, async ({ user }) => ({
  user: { id: user.id, email: user.email, role: user.role, tier: user.tier },
  profile: await getProfile(user.id),
}));
