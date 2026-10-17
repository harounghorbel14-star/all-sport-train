import { authedRoute } from "@/lib/server/api";
import { initResearchQueue } from "@/lib/services/research";

export const POST = authedRoute({ admin: true }, async () => ({ queued: await initResearchQueue() }));
