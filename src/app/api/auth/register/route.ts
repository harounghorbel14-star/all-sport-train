import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { registerWithPassword } from "@/lib/auth/accounts";
import { withSession } from "@/lib/auth/respond";
import { registerSchema } from "@/lib/validation";

const body = registerSchema.extend({ acceptTerms: z.literal(true, { error: "Please accept the terms and privacy policy" }) });

export const POST = publicRoute({ body }, async ({ body, req, user: current }) => {
  const { user, upgradedGuest } = await registerWithPassword(req, body, current);
  // An upgraded guest keeps their (already onboarded) data and current session.
  const res = NextResponse.json({ user: { id: user.id, email: user.email }, upgradedGuest, redirectTo: upgradedGuest ? "/today?welcome=saved" : "/onboarding" }, { status: 201 });
  return upgradedGuest ? res : withSession(res, req, user.id, current);
});
