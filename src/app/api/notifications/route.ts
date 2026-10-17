import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { generateDueReminders, listNotifications, markRead } from "@/lib/services/notifications";

export const GET = authedRoute({}, async ({ user }) => {
  await generateDueReminders(user.id);
  return listNotifications(user.id);
});
export const PATCH = authedRoute({ body: z.object({ ids: z.array(z.string().max(40)).max(100).optional() }) }, async ({ user, body }) => {
  await markRead(user.id, body.ids);
  return { ok: true };
});
