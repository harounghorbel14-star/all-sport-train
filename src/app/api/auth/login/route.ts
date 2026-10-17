import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { loginWithPassword } from "@/lib/auth/accounts";
import { safeNext } from "@/lib/auth/redirect";
import { landingFor, withSession } from "@/lib/auth/respond";
import { loginSchema } from "@/lib/validation";

export const POST = publicRoute({ body: loginSchema.extend({ next: z.string().max(300).optional() }) }, async ({ body, req, user: current }) => {
  const user = await loginWithPassword(req, body.email, body.password);
  const redirectTo = await landingFor(user.id, safeNext(body.next));
  return withSession(NextResponse.json({ user: { id: user.id, email: user.email }, redirectTo }), req, user.id, current);
});
