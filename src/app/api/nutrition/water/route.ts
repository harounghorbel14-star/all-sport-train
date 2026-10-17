import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { addWater, resetWater } from "@/lib/services/nutrition";

export const POST = authedRoute({ body: z.object({ dateKey: dateKeySchema, ml: z.number().int().min(50).max(2000) }) }, async ({ user, body }) => ({ log: await addWater(user.id, body.dateKey, body.ml) }));
export const DELETE = authedRoute({ query: z.object({ date: dateKeySchema }) }, async ({ user, query }) => {
  await resetWater(user.id, query.date);
  return { ok: true };
});
