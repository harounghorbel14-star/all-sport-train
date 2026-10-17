import { authedRoute } from "@/lib/server/api";
import { measurementSchema } from "@/lib/validation";
import { addMeasurement, listMeasurements } from "@/lib/services/progress";

export const GET = authedRoute({}, async ({ user }) => ({ measurements: await listMeasurements(user.id) }));
export const POST = authedRoute({ body: measurementSchema }, async ({ user, body }) => ({ measurement: await addMeasurement(user.id, body) }));
