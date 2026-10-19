import { authedRoute } from "@/lib/server/api";
import { monthlyReport } from "@/lib/services/progress";

export const GET = authedRoute({}, async ({ user, req }) => monthlyReport(user.id, new URL(req.url).searchParams.get("month") ?? undefined));
