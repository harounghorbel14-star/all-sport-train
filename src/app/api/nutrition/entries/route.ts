import { authedRoute } from "@/lib/server/api";
import { foodEntrySchema } from "@/lib/validation";
import { addFoodEntry } from "@/lib/services/nutrition";

export const POST = authedRoute({ body: foodEntrySchema }, async ({ user, body }) => ({ entry: await addFoodEntry(user.id, body) }));
