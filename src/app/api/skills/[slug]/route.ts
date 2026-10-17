import { authedRoute } from "@/lib/server/api";
import { getSkill, startSkill } from "@/lib/services/skills";

export const GET = authedRoute({}, async ({ user, params }) => getSkill(user.id, params.slug));
export const POST = authedRoute({}, async ({ user, params }) => ({ progress: await startSkill(user.id, params.slug) }));
