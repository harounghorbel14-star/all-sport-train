import { db } from "@/lib/server/db";
import { configProblems } from "@/lib/server/env";
import { disabledFeatures, unknownFeatureNames } from "@/lib/server/features";

export const dynamic = "force-dynamic";

/**
 * Deployment health: configuration (variable names only), database reachability,
 * migrations applied and seed content present. 503 until everything is ready.
 */
export async function GET() {
  const problems = configProblems();
  if (!problems.length) {
    try {
      await db.$queryRaw`SELECT 1`;
      try {
        const [exercises, sports] = await Promise.all([db.exercise.count(), db.sport.count()]);
        if (!exercises || !sports) problems.push("Database is empty — run the seed (npm run db:seed, or start with npm run start:prod)");
      } catch {
        problems.push("Database tables are missing — run migrations (npx prisma migrate deploy, or start with npm run start:prod)");
      }
    } catch {
      problems.push("Database is unreachable — check DATABASE_URL");
    }
  }
  // Switched-off features are reported (names only) but don't make the service unhealthy.
  const features = { disabled: disabledFeatures(), unknown: unknownFeatureNames() };
  return Response.json(problems.length ? { status: "misconfigured", problems, features } : { status: "ok", features }, { status: problems.length ? 503 : 200 });
}
