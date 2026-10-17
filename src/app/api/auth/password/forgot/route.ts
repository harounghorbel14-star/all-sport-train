import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { requestPasswordReset } from "@/lib/auth/accounts";
import { emailSchema } from "@/lib/validation";

/** Always answers the same way so it can't be used to discover which emails have accounts. */
export const POST = publicRoute({ body: z.object({ email: emailSchema }) }, async ({ req, body }) => {
  await requestPasswordReset(req, body.email);
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset the password. It expires in 30 minutes." };
});
