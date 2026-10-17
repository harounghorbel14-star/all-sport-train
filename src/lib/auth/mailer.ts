import { env } from "../server/env";
import { log } from "../server/logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Development-only outbox so reset links can be tested without an email provider. Never used in production. */
const devOutbox: (Mail & { at: string })[] = [];
export const devMailbox = () => (process.env.NODE_ENV === "production" ? [] : [...devOutbox]);

export const mailConfigured = () => Boolean(env().RESEND_API_KEY.trim() && env().MAIL_FROM.trim());

/** Sends a transactional email through Resend's HTTP API. Returns false when delivery is not possible. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      log.error("mail_not_configured", { subject: mail.subject });
      return false;
    }
    devOutbox.push({ ...mail, at: new Date().toISOString() });
    if (devOutbox.length > 50) devOutbox.shift();
    if (process.env.NODE_ENV !== "test") log.info("dev_mail", { to: mail.to, subject: mail.subject, text: mail.text });
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env().MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) {
      log.error("mail_send_failed", { status: res.status });
      return false;
    }
    return true;
  } catch (e) {
    log.error("mail_send_failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
