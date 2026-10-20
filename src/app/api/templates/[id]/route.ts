import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { deleteTemplate, duplicateTemplate, getTemplate, restoreTemplate, templatePatchSchema, updateTemplate } from "@/lib/services/templates";
import { scheduleTemplate } from "@/lib/services/calendar";

export const GET = authedRoute({}, async ({ user, params }) => ({ template: await getTemplate(user.id, params.id) }));
export const PATCH = authedRoute({ body: templatePatchSchema }, async ({ user, params, body }) => ({ template: await updateTemplate(user.id, params.id, body) }));

/** Soft delete (restorable for 30 days). */
export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteTemplate(user.id, params.id);
  return { ok: true };
});

/** Template actions: schedule it on a day, duplicate it, or restore a deleted one. */
export const POST = authedRoute(
  {
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("schedule"), dateKey: dateKeySchema }),
      z.object({ action: z.literal("duplicate") }),
      z.object({ action: z.literal("restore") }),
    ]),
  },
  async ({ user, params, body }) => {
    if (body.action === "schedule") return scheduleTemplate(user.id, params.id, body.dateKey);
    if (body.action === "duplicate") return { template: await duplicateTemplate(user.id, params.id) };
    return { template: await restoreTemplate(user.id, params.id) };
  },
);
