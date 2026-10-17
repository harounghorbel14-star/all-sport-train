import { authedRoute } from "@/lib/server/api";
import { listSkills } from "@/lib/services/skills";

export const GET = authedRoute({}, async ({ user }) => ({ skills: await listSkills(user.id) }));
