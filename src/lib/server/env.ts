import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ADMIN_EMAILS: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default("claude-opus-5-5"),
  FDC_API_KEY: z.string().optional().default(""),
  UPLOAD_DIR: z.string().optional().default("./storage/uploads"),
  ENFORCE_TIERS: z.string().optional().default("false"),
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

export function resetEnvCache() {
  cached = null;
}

export const aiConfigured = () => env().ANTHROPIC_API_KEY.trim().length > 0;
export const adminEmails = () =>
  env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
