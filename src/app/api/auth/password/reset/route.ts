import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { resetPassword } from "@/lib/auth/accounts";
import { passwordSchema } from "@/lib/validation";

export const POST = publicRoute({ body: z.object({ token: z.string().min(20).max(200), password: passwordSchema }) }, async ({ req, body }) => {
  await resetPassword(req, body.token, body.password);
  return { ok: true };
});
