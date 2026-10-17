"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, UserRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { useI18n } from "@/components/providers";
import { Button, Card, ErrorState, Field, Input, Notice } from "@/components/ui/primitives";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const passwordProblem = (pw: string) => (pw.length < 10 ? "Use at least 10 characters" : !/[a-zA-Z]/.test(pw) || !/\d/.test(pw) ? "Include at least one letter and one number" : null);

/** Messages for ?error= codes set by the server (OAuth callback, guards). */
export const AUTH_ERRORS: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled. You can try again or use email and password.",
  google_state: "That sign-in attempt expired or didn't match this browser. Please try again.",
  google_expired: "The Google authorisation code expired. Please try again.",
  google_token: "We couldn't verify the response from Google. Please try again.",
  google_failed: "Google sign-in failed. Please try again in a moment.",
  google_unverified: "Your Google account's email address isn't verified, so we can't use it to create an account.",
  google_account_exists:
    "An APEX FIT account already uses this email. For your security we don't link accounts automatically — log in with your password, then connect Google from Profile → Security.",
  google_in_use: "That Google account is already connected to a different APEX FIT account.",
  google_link_requires_login: "Log in to your account first, then connect Google from your profile.",
  google_not_configured: "Google sign-in isn't configured on this server yet (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
};

/** Uncontrolled unless `value` is given, so text typed or autofilled before hydration is kept. */
export function PasswordInput({ id, name, autoComplete, value, onChange, invalid }: { id: string; name: string; autoComplete: string; value?: string; onChange: (v: string) => void; invalid?: boolean }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} {...(value !== undefined ? { value } : {})} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} className="pe-11" required />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? t.auth.hidePassword : t.auth.showPassword} aria-pressed={show} className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:text-fg">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function GoogleButton({ enabled, devHint, next }: { enabled: boolean; devHint: boolean; next?: string }) {
  const { t } = useI18n();
  if (!enabled && !devHint) return null;
  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const inner = (
    <>
      <svg aria-hidden viewBox="0 0 48 48" className="size-5">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {t.auth.google}
    </>
  );
  return (
    <div>
      {enabled ? (
        <a href={href} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface-2 font-semibold transition-colors hover:border-accent">
          {inner}
        </a>
      ) : (
        <button type="button" disabled className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-line bg-surface-2 font-semibold opacity-50">
          {inner}
        </button>
      )}
      {!enabled && <p className="mt-1 text-center text-[11px] text-subtle">Development notice: {AUTH_ERRORS.google_not_configured}</p>}
    </div>
  );
}

export function GuestButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ redirectTo: string }>("/api/auth/guest", { body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      router.push(r.redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a guest session");
      setBusy(false);
    }
  }
  return (
    <div>
      <Button type="button" variant="ghost" size="lg" className="w-full" onClick={go} loading={busy} icon={<UserRound className="size-4" />}>
        {t.auth.guest}
      </Button>
      <p className="mt-1 text-center text-[11px] text-subtle">{t.auth.guestHint}</p>
      {error && <ErrorState message={error} />}
    </div>
  );
}

function Divider() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-subtle" role="separator">
      <span className="h-px flex-1 bg-line" />
      {t.auth.or}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="p-6 sm:p-8">
        <h1 className="num text-4xl font-bold uppercase">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </Card>
    </motion.div>
  );
}

export function AuthForm({ mode, next, errorCode, notice, googleEnabled, googleDevHint, isGuest }: { mode: "login" | "register"; next?: string; errorCode?: string; notice?: string; googleEnabled: boolean; googleDevHint: boolean; isGuest?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ displayName: "", email: "", password: "", confirm: "", terms: false });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(errorCode ? (AUTH_ERRORS[errorCode] ?? "Sign-in failed. Please try again.") : null);
  const [loading, setLoading] = useState(false);
  const reg = mode === "register";

  type Values = typeof f;
  const validate = (v: Values) => ({
    displayName: reg && !v.displayName.trim() ? "Tell us what to call you" : undefined,
    email: !EMAIL_RE.test(v.email.trim()) ? "Enter a valid email address" : undefined,
    password: reg ? (passwordProblem(v.password) ?? undefined) : !v.password ? "Enter your password" : undefined,
    confirm: reg && v.confirm !== v.password ? "Passwords don't match" : undefined,
    terms: reg && !v.terms ? "Please accept the terms and privacy policy" : undefined,
  });
  const errors = validate(f);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Read the form itself: values typed or autofilled before hydration live only in the DOM.
    const fd = new FormData(e.currentTarget);
    const v: Values = { displayName: String(fd.get("displayName") ?? ""), email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? ""), terms: fd.get("terms") === "on" };
    setF(v);
    setTouched(true);
    setError(null);
    if (Object.values(validate(v)).some(Boolean)) return;
    setLoading(true);
    try {
      const r = reg
        ? await api<{ redirectTo: string }>("/api/auth/register", { body: { email: v.email, password: v.password, displayName: v.displayName, acceptTerms: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } })
        : await api<{ redirectTo: string }>("/api/auth/login", { body: { email: v.email, password: v.password, next } });
      router.push(r.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const set = (k: keyof typeof f) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const [termsBefore, rest] = t.auth.acceptTerms.split("{terms}");
  const [between, termsAfter] = (rest ?? "").split("{privacy}");

  return (
    <AuthCard title={reg ? (isGuest ? t.auth.saveProgressTitle : t.auth.startJourney) : t.auth.welcomeBack} subtitle={reg && isGuest ? t.auth.saveProgressBody : undefined}>
      {notice && (
        <div className="mb-4">
          <Notice tone="accent" icon={<CheckCircle2 className="size-4 text-accent" />}>
            {notice}
          </Notice>
        </div>
      )}
      <div className="space-y-3">
        <GoogleButton enabled={googleEnabled} devHint={googleDevHint} next={next} />
        {(googleEnabled || googleDevHint) && <Divider />}
      </div>
      <form onSubmit={onSubmit} className="mt-3 space-y-4" noValidate aria-describedby={error ? "auth-error" : undefined}>
        {reg && (
          <Field label={t.auth.name} htmlFor="displayName" error={show("displayName")}>
            <Input id="displayName" name="displayName" required maxLength={40} autoComplete="nickname" onChange={(e) => set("displayName")(e.target.value)} aria-invalid={Boolean(show("displayName")) || undefined} />
          </Field>
        )}
        <Field label={t.auth.email} htmlFor="email" error={show("email")}>
          <Input id="email" name="email" type="email" required autoComplete="email" inputMode="email" onChange={(e) => set("email")(e.target.value)} aria-invalid={Boolean(show("email")) || undefined} />
        </Field>
        <Field label={t.auth.password} htmlFor="password" hint={reg ? t.auth.passwordHint : undefined} error={show("password")}>
          <PasswordInput id="password" name="password" autoComplete={reg ? "new-password" : "current-password"} onChange={set("password")} invalid={Boolean(show("password"))} />
        </Field>
        {reg && (
          <Field label={t.auth.confirmPassword} htmlFor="confirm" error={show("confirm")}>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" onChange={set("confirm")} invalid={Boolean(show("confirm"))} />
          </Field>
        )}
        {!reg && (
          <div className="-mt-2 text-end">
            <Link href="/forgot-password" className="text-sm font-medium text-accent">
              {t.auth.forgot}
            </Link>
          </div>
        )}
        {reg && (
          <div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="terms" onChange={(e) => set("terms")(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" aria-invalid={Boolean(show("terms")) || undefined} />
              <span>
                {termsBefore}
                <Link href="/terms" target="_blank" className="text-accent underline">
                  {t.auth.terms}
                </Link>
                {between}
                <Link href="/privacy" target="_blank" className="text-accent underline">
                  {t.auth.privacy}
                </Link>
                {termsAfter}
              </span>
            </label>
            {show("terms") && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {errors.terms}
              </p>
            )}
          </div>
        )}
        {error && (
          <div id="auth-error">
            <ErrorState message={error} />
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {reg ? t.auth.register : t.auth.login}
        </Button>
      </form>
      {!isGuest && (
        <div className="mt-4 space-y-3">
          <Divider />
          <GuestButton />
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        {reg ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link href={`${reg ? "/login" : "/register"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent">
          {reg ? t.auth.login : t.auth.register}
        </Link>
      </p>
    </AuthCard>
  );
}
