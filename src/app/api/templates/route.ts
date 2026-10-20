import { authedRoute } from "@/lib/server/api";
import { createTemplate, listTemplates, templateCreateSchema } from "@/lib/services/templates";

export const GET = authedRoute({}, async ({ user }) => listTemplates(user.id));

/** Save a workout as a template: `{ planId }` (or `{ planId, replaceId }` to update one), or `{ workout, name }`. */
export const POST = authedRoute({ body: templateCreateSchema }, async ({ user, body }) => ({ template: await createTemplate(user.id, body) }));
