import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { applyCatchUp, catchUpPreview } from "@/lib/services/calendar";

/** Missed training in the last 7 days and a cautious catch-up proposal. Nothing changes until POST. */
export const GET = authedRoute({ feature: "catch_up" }, async ({ user }) => catchUpPreview(user.id));

/** Adds the chosen proposed sessions (days must still be in the current proposal). */
export const POST = authedRoute({ feature: "catch_up", body: z.object({ dateKeys: z.array(z.string().max(10)).min(1).max(2) }) }, async ({ user, body }) => applyCatchUp(user.id, body.dateKeys));
