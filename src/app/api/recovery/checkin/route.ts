import { authedRoute } from "@/lib/server/api";
import { checkInSchema } from "@/lib/validation";
import { saveCheckIn } from "@/lib/services/recovery";

export const POST = authedRoute({ body: checkInSchema }, async ({ user, body }) => saveCheckIn(user.id, body));
