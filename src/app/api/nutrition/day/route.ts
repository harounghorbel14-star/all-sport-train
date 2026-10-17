import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { nutritionDay } from "@/lib/services/nutrition";

export const GET = authedRoute({ query: z.object({ date: dateKeySchema }) }, async ({ user, query }) => nutritionDay(user.id, query.date));
