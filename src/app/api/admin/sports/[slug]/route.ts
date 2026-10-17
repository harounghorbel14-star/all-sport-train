import { authedRoute } from "@/lib/server/api";
import { adminGetSport } from "@/lib/services/sports";

export const GET = authedRoute({ admin: true }, async ({ params }) => adminGetSport(params.slug));
