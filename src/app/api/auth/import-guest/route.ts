import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { GUEST_CLAIM_COOKIE, guestSummary, importGuestData, readGuestClaim } from "@/lib/auth/accounts";
import { readCookie } from "@/lib/auth/session";

const claim = (req: Request) => readGuestClaim(readCookie(req.headers.get("cookie"), GUEST_CLAIM_COOKIE));
const clear = (res: NextResponse) => {
  res.cookies.set(GUEST_CLAIM_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
};

/** What a previous guest session on this browser contains (nothing is moved yet). */
export const GET = authedRoute({}, async ({ req, user }) => {
  const guestId = claim(req);
  if (!guestId || user.isGuest) return { pending: false };
  const summary = await guestSummary(guestId);
  return summary && summary.total > 0 ? { pending: true, summary } : { pending: false };
});

/** Explicit decision: import the guest data into this account, or discard the offer. */
export const POST = authedRoute({ body: z.object({ action: z.enum(["import", "discard"]) }) }, async ({ req, user, body }) => {
  const guestId = claim(req);
  if (!guestId) return clear(NextResponse.json({ ok: true, moved: {} }));
  if (body.action === "discard") return clear(NextResponse.json({ ok: true, moved: {} }));
  const result = await importGuestData(req, user.id, guestId);
  return clear(NextResponse.json({ ok: true, ...result }));
});
