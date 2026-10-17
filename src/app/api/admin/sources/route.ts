import { authedRoute } from "@/lib/server/api";
import { adminSourceSchema, adminUpsertSource } from "@/lib/services/sports";

export const POST = authedRoute({ admin: true, body: adminSourceSchema }, async ({ body }) => ({ source: await adminUpsertSource(body) }));
