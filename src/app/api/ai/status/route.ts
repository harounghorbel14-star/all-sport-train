import { authedRoute } from "@/lib/server/api";
import { aiStatus } from "@/lib/ai/provider";
import { env } from "@/lib/server/env";

export const GET = authedRoute({}, async () => ({ ai: aiStatus(), nutritionDatabase: env().FDC_API_KEY ? "usda+local" : "local" }));
