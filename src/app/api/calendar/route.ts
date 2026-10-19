import { authedRoute } from "@/lib/server/api";
import { calendar, scheduleSchema, scheduleWorkout } from "@/lib/services/calendar";

export const GET = authedRoute({}, async ({ user, req }) => {
  const url = new URL(req.url);
  return calendar(user.id, { from: url.searchParams.get("from") ?? undefined, days: Number(url.searchParams.get("days")) || undefined });
});

/** Schedule a workout on a day. Returns load warnings the user should see (never blocks). */
export const POST = authedRoute({ body: scheduleSchema }, async ({ user, body }) => scheduleWorkout(user.id, body));
