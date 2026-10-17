import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { createGuest } from "@/lib/auth/accounts";
import { withSession } from "@/lib/auth/respond";
import { timeZoneSchema } from "@/lib/validation";

/** Starts a guest session (an isolated, auto-expiring account with beginner defaults). */
export const POST = publicRoute({ body: z.object({ timezone: timeZoneSchema.optional() }) }, async ({ req, body, user }) => {
  if (user && !user.isGuest) return { redirectTo: "/today", guest: false };
  if (user?.isGuest) return { redirectTo: "/today", guest: true };
  const guest = await createGuest(req, body.timezone);
  return withSession(NextResponse.json({ redirectTo: "/today?welcome=guest", guest: true }), req, guest.id, null);
});
