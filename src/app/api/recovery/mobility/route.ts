import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { logMobility } from "@/lib/services/recovery";

export const POST = authedRoute(
  { body: z.object({ routine: z.string().max(40), dateKey: dateKeySchema, minutes: z.number().int().min(1).max(120).optional() }) },
  async ({ user, body }) => logMobility(user.id, body.routine, body.dateKey, body.minutes),
);
