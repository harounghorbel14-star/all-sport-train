import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string({ error: "DATABASE_URL is not set" }).min(1, "DATABASE_URL is empty"),
  SESSION_SECRET: z.string({ error: "SESSION_SECRET is not set" }).min(32, "SESSION_SECRET must be at least 32 characters"),
  ADMIN_EMAILS: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default("claude-opus-5-5"),
  FDC_API_KEY: z.string().optional().default(""),
  UPLOAD_DIR: z.string().optional().default("./storage/uploads"),
  ENFORCE_TIERS: z.string().optional().default("false"),
  // Public base URL of the app (used for OAuth callbacks and links in emails), e.g. https://app.example.com
  APP_BASE_URL: z.string().optional().default(""),
  // Google OAuth 2.0 / OpenID Connect (server-side only)
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().optional().default(""),
  // Transactional email via Resend's HTTP API (password reset). Without it, development writes mails to the server log.
  RESEND_API_KEY: z.string().optional().default(""),
  MAIL_FROM: z.string().optional().default(""),
});

let cached: z.infer<typeof schema> | null = null;

/** Validated server environment. Throws a descriptive error on misconfiguration. */
export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Configuration problems by variable name (never values), without throwing.
 * Used by the health check, startup logging and the setup notice.
 */
export function configProblems(): string[] {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

export function resetEnvCache() {
  cached = null;
}

/** Base URL for absolute links; falls back to the request origin in development. */
export function appBaseUrl(req?: Request) {
  const configured = env().APP_BASE_URL.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}

// Reads process.env directly so pages can render (and show the setup notice) even when other config is broken.
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

export const aiConfigured = () => env().ANTHROPIC_API_KEY.trim().length > 0;
export const adminEmails = () =>
  env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
