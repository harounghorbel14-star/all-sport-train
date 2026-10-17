"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import { useI18n } from "@/components/providers";
import { Button, ErrorState, Field } from "@/components/ui/primitives";
import { AuthCard, PasswordInput, passwordProblem } from "../auth-form";

export function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(token ? null : "This reset link is incomplete. Request a new one.");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(pw) ?? (pw !== confirm ? "Passwords don't match" : null);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password/reset", { body: { token, password: pw } });
      router.push("/login?notice=reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }
  return (
    <AuthCard title={t.auth.setPassword} subtitle="After saving, every device signed in to your account will be signed out.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t.auth.newPassword} htmlFor="password" hint={t.auth.passwordHint}>
          <PasswordInput id="password" name="password" autoComplete="new-password" value={pw} onChange={setPw} />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!token}>
          {t.auth.setPassword}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/forgot-password" className="font-semibold text-accent">
          Request a new link
        </Link>
      </p>
    </AuthCard>
  );
}
