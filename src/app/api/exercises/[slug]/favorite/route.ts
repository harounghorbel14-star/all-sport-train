import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { toggleFavorite } from "@/lib/services/exercises";

export const POST = authedRoute({ body: z.object({ favorite: z.boolean() }) }, async ({ user, params, body }) => toggleFavorite(user.id, params.slug, body.favorite));
