"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { useI18n } from "@/components/providers";
import { Button, ErrorState, Field, Input, Notice } from "@/components/ui/primitives";
import { AuthCard } from "../auth-form";

export function ForgotForm() {
  const { t } = useI18n();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Read from the form so input typed before hydration isn't lost.
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address");
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string }>("/api/auth/password/forgot", { body: { email } });
      setDone(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard title={t.auth.resetTitle} subtitle="Enter the email you use for APEX FIT and we'll send you a link to choose a new password.">
      {done ? (
        <Notice tone="accent" icon={<MailCheck className="size-4 text-accent" />}>
          {done}
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t.auth.email} htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {t.auth.resetSend}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-accent">
          {t.auth.backToLogin}
        </Link>
      </p>
    </AuthCard>
  );
}
