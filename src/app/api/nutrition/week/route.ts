import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { dateKeySchema } from "@/lib/validation";
import { nutritionWeek } from "@/lib/services/nutrition";

export const GET = authedRoute({ query: z.object({ end: dateKeySchema }) }, async ({ user, query }) => ({ days: await nutritionWeek(user.id, query.end) }));
