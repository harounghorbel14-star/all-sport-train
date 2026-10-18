import { authedRoute } from "@/lib/server/api";
import { coverage } from "@/lib/services/research";

export const GET = authedRoute({ admin: true }, async () => ({ sports: await coverage() }));
