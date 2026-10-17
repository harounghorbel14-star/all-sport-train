import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { importResearch } from "@/lib/services/research";

/** Imports a research run (same JSON shape as prisma/research/<date>/<sport>.json). */
export const POST = authedRoute({ admin: true, body: z.unknown() }, async ({ body }) => {
  try {
    return await importResearch(body, { origin: "research" });
  } catch (e) {
    if (e instanceof z.ZodError) throw badRequest("Invalid research file", z.flattenError(e).fieldErrors);
    throw e;
  }
});
