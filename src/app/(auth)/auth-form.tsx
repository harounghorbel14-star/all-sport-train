"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import { useI18n } from "@/components/providers";
import { Button, Card, ErrorState, Field, Input } from "@/components/ui/primitives";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "register") {
        await api("/api/auth/register", {
          body: { email: form.get("email"), password: form.get("password"), displayName: form.get("displayName"), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        });
        router.push("/onboarding");
      } else {
        await api("/api/auth/login", { body: { email: form.get("email"), password: form.get("password") } });
        router.push("/today");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="num mb-6 text-4xl font-bold uppercase">{mode === "login" ? t.auth.welcomeBack : t.auth.startJourney}</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {mode === "register" && (
          <Field label={t.auth.name} htmlFor="displayName">
            <Input id="displayName" name="displayName" required maxLength={40} autoComplete="nickname" />
          </Field>
        )}
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={t.auth.password} htmlFor="password" hint={mode === "register" ? t.auth.passwordHint : undefined}>
          <Input id="password" name="password" type="password" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} />
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {mode === "login" ? t.auth.login : t.auth.register}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? t.auth.noAccount : t.auth.haveAccount}{" "}
        <Link href={mode === "login" ? "/register" : "/login"} className="font-semibold text-accent">
          {mode === "login" ? t.auth.register : t.auth.login}
        </Link>
      </p>
    </Card>
  );
}
