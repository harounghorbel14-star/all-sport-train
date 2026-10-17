import { authedRoute } from "@/lib/server/api";
import { adminListContent, adminSportSchema, adminUpsertSport } from "@/lib/services/sports";

export const GET = authedRoute({ admin: true }, async () => adminListContent());
/** Create a sport (as a draft) or update an existing one. */
export const POST = authedRoute({ admin: true, body: adminSportSchema }, async ({ body }) => ({ sport: await adminUpsertSport(body) }));
