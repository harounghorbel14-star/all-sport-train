import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { adminAddMetric, adminUpsertContent } from "@/lib/services/sports";

const body = z.object({ type: z.enum(["lesson", "drill", "ruleset", "metric"]), data: z.unknown() });

export const POST = authedRoute({ admin: true, body }, async ({ params, body }) => {
  try {
    if (body.type === "metric") return { item: await adminAddMetric(params.slug, body.data) };
    return { item: await adminUpsertContent(params.slug, body.type, body.data) };
  } catch (e) {
    if (e instanceof z.ZodError) throw badRequest("Invalid content", z.flattenError(e).fieldErrors);
    throw e;
  }
});
