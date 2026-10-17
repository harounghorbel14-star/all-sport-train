import { db } from "../server/db";
import { log } from "../server/logger";
import { clientIp } from "../server/request";

export type AuthEventType =
  | "register"
  | "login_success"
  | "login_failed"
  | "logout"
  | "logout_all"
  | "password_reset_requested"
  | "password_reset_completed"
  | "google_login"
  | "google_register"
  | "google_link"
  | "google_failed"
  | "guest_created"
  | "guest_converted"
  | "guest_imported";

/** Best-effort security audit log. Never stores passwords, tokens or full emails in meta. */
export async function recordAuthEvent(type: AuthEventType, opts: { userId?: string | null; req?: Request; meta?: Record<string, string | number | boolean> } = {}) {
  try {
    await db.authEvent.create({
      data: {
        type,
        userId: opts.userId ?? null,
        ip: opts.req ? clientIp(opts.req) : null,
        userAgent: opts.req?.headers.get("user-agent")?.slice(0, 200) ?? null,
        meta: JSON.stringify(opts.meta ?? {}),
      },
    });
  } catch (e) {
    log.warn("auth_event_failed", { type, error: e instanceof Error ? e.message : String(e) });
  }
}
