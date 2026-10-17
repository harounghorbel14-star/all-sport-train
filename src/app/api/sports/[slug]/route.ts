import { authedRoute } from "@/lib/server/api";
import { enroll, enrollSchema, getSportHub, leaveSport } from "@/lib/services/sports";

export const GET = authedRoute({}, async ({ user, params }) => getSportHub(params.slug, user.id));
/** Join the sport (or update level, goals, position, supervision). */
export const POST = authedRoute({ body: enrollSchema }, async ({ user, params, body }) => ({ enrollment: await enroll(user.id, params.slug, body) }));
export const DELETE = authedRoute({}, async ({ user, params }) => {
  await leaveSport(user.id, params.slug);
  return { ok: true };
});
