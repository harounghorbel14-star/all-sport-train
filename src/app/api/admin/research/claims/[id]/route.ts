import { authedRoute } from "@/lib/server/api";
import { claimReviewSchema, reviewClaim } from "@/lib/services/research";

export const POST = authedRoute({ admin: true, body: claimReviewSchema }, async ({ user, params, body }) => ({ claim: await reviewClaim(params.id, `admin:${user.email}`, body) }));
