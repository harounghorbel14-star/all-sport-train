import { authedRoute } from "@/lib/server/api";
import { createGoal, goalSchema, listGoals } from "@/lib/services/goals";

export const GET = authedRoute({ feature: "goals" }, async ({ user, req }) => ({ goals: await listGoals(user.id, { includeAbandoned: new URL(req.url).searchParams.get("all") === "1" }) }));

export const POST = authedRoute({ feature: "goals", body: goalSchema }, async ({ user, body }) => ({ goal: await createGoal(user.id, body) }));
