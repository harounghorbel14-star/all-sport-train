"use client";

import { Bell, Database, Download, Globe, KeyRound, Lock, Palette, Settings2, ShieldAlert, Sparkles, User, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import { clearOfflineData } from "@/lib/client/pwa";
import { InstallApp } from "@/components/pwa/install";
import { EQUIPMENT_LABELS, LIMITATION_LABELS } from "@/lib/exercise-labels";
import { LOCALE_NAMES } from "@/lib/i18n";
import { Badge, Button, ButtonLink, Card, CardTitle, Chip, Field, Input, Notice, Select, Textarea, Toggle } from "@/components/ui/primitives";
import { Sheet, useToast } from "@/components/ui/overlay";
import type { ProfileView } from "@/lib/services/profile";

type P = ProfileView;

const TIMEZONES = typeof Intl !== "undefined" && "supportedValuesOf" in Intl ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone") : ["UTC"];

interface Security {
  isGuest: boolean;
  hasPassword: boolean;
  emailVerified: boolean;
  google: { email: string | null } | null;
  googleEnabled: boolean;
  sessions: number;
  notice: { tone: "accent" | "danger"; text: string } | null;
}

export function SettingsApp({ email, tier, profile, ai, usda, security }: { email: string; tier: string; profile: P; ai: { configured: boolean; model: string | null }; usda: boolean; security: Security }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pw, setPw] = useState("");
  const [confirmText, setConfirmText] = useState("");

  async function save(section: string, body: Record<string, unknown>) {
    setSaving(section);
    try {
      const r = await api<{ profile: P }>("/api/profile", { method: "PATCH", body });
      setP(r.profile);
      toast("Saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(null);
    }
  }
  const set = <K extends keyof P>(k: K, v: P[K]) => setP((x) => ({ ...x, [k]: v }));
  const toggleIn = (k: "equipment" | "limitations", v: string) => set(k, p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v]);
  const np = p.notificationPrefs;
  const setNp = (k: keyof typeof np, v: boolean | number) => set("notificationPrefs", { ...np, [k]: v });

  async function logoutAll() {
    if (!confirm("Sign out of APEX FIT on every device, including this one?")) return;
    await api("/api/auth/logout", { body: { all: true } }).catch(() => undefined);
    await clearOfflineData().catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    try {
      await api("/api/account", { method: "DELETE", body: { password: pw, confirm: confirmText } });
      await clearOfflineData().catch(() => undefined);
      router.push("/");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete", "error");
    }
  }


  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section id="profile" title="Profile" icon={<User className="size-4" />} busy={saving === "profile"} onSave={() => save("profile", { displayName: p.displayName, handle: p.handle, bio: p.bio })}>
        <p className="text-sm text-muted">{email} · <Badge tone="accent">{tier}</Badge></p>
        <Field label="Display name" htmlFor="s-name"><Input id="s-name" value={p.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={40} /></Field>
        <Field label="Handle" htmlFor="s-handle" hint="3–20 letters, numbers or underscores"><Input id="s-handle" value={p.handle} onChange={(e) => set("handle", e.target.value.toLowerCase())} maxLength={20} /></Field>
        <Field label="Bio" htmlFor="s-bio" optional><Textarea id="s-bio" value={p.bio ?? ""} onChange={(e) => set("bio", e.target.value)} maxLength={300} /></Field>
      </Section>

      <Section id="training" title="Training setup" icon={<Settings2 className="size-4" />} busy={saving === "training"} onSave={() => save("training", { equipment: p.equipment, limitations: p.limitations, limitationNotes: p.limitationNotes, sessionMinutes: p.sessionMinutes })}>
        <ButtonLink href="/onboarding?edit=1" variant="outline" size="sm">Redo the full questionnaire</ButtonLink>
        <p className="text-sm font-medium">Equipment</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(EQUIPMENT_LABELS).map(([k, v]) => <Chip key={k} className="px-2.5 py-1 text-xs" selected={p.equipment.includes(k)} onClick={() => toggleIn("equipment", k)}>{v}</Chip>)}</div>
        <p className="text-sm font-medium">Limitations</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(LIMITATION_LABELS).map(([k, v]) => <Chip key={k} className="px-2.5 py-1 text-xs" selected={p.limitations.includes(k)} onClick={() => toggleIn("limitations", k)}>{v}</Chip>)}</div>
        <Field label="Session length (min)" htmlFor="s-min"><Input id="s-min" type="number" min={10} max={120} value={p.sessionMinutes} onChange={(e) => set("sessionMinutes", Math.max(10, Math.min(120, Number(e.target.value) || 30)))} /></Field>
      </Section>

      <Section id="prefs" title="Language, units & appearance" icon={<Palette className="size-4" />} busy={saving === "prefs"} onSave={() => save("prefs", { locale: p.locale, units: p.units, theme: p.theme, reducedMotion: p.reducedMotion, timezone: p.timezone })}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Language" htmlFor="s-locale">
            <Select id="s-locale" value={p.locale} onChange={(e) => set("locale", e.target.value)}>
              {Object.entries(LOCALE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Units" htmlFor="s-units">
            <Select id="s-units" value={p.units} onChange={(e) => set("units", e.target.value)}>
              <option value="metric">Metric (kg, cm, km)</option>
              <option value="imperial">Imperial (lb, in, mi)</option>
            </Select>
          </Field>
          <Field label="Theme" htmlFor="s-theme">
            <Select id="s-theme" value={p.theme} onChange={(e) => set("theme", e.target.value)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </Select>
          </Field>
          <Field label="Time zone" htmlFor="s-tz">
            <Select id="s-tz" value={p.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-subtle">Arabic switches the layout to right-to-left. Translations are in progress — untranslated text falls back to English.</p>
        <Toggle checked={p.reducedMotion} onChange={(v) => set("reducedMotion", v)} label="Reduce motion" description="Minimise animations (your device setting is always respected)." />
      </Section>

      <Section id="nutrition" title="Nutrition goals" icon={<Utensils className="size-4" />} busy={saving === "nutrition"} onSave={() => save("nutrition", { calorieGoal: p.calorieGoal, proteinGoalG: p.proteinGoalG, waterGoalMl: p.waterGoalMl, nutritionInCoach: p.nutritionInCoach })}>
        <p className="text-xs text-muted">Leave blank to use the automatic estimate. Goals are optional.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Calories" htmlFor="s-kcal" optional><Input id="s-kcal" inputMode="numeric" value={p.calorieGoal ?? ""} onChange={(e) => set("calorieGoal", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} /></Field>
          <Field label="Protein (g)" htmlFor="s-prot" optional><Input id="s-prot" inputMode="numeric" value={p.proteinGoalG ?? ""} onChange={(e) => set("proteinGoalG", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} /></Field>
          <Field label="Water (ml)" htmlFor="s-water"><Input id="s-water" inputMode="numeric" value={p.waterGoalMl} onChange={(e) => set("waterGoalMl", Number(e.target.value.replace(/\D/g, "")) || 2500)} /></Field>
        </div>
        {p.ageRange === "under18" && p.calorieGoal != null && <Notice tone="warn">For under-18s, we recommend not setting a calorie target below your estimated needs.</Notice>}
        <Toggle checked={p.nutritionInCoach} onChange={(v) => set("nutritionInCoach", v)} label="Share nutrition logs with the AI coach" description="Off by default. Lets the coach consider what you've eaten." />
      </Section>

      <Section id="notif" title="Notifications" icon={<Bell className="size-4" />} busy={saving === "notif"} onSave={() => save("notif", { notificationPrefs: np })}>
        <p className="text-xs text-muted">In-app notifications only. Nothing is sent until you turn it on; quiet hours are always respected.</p>
        <Toggle checked={np.workoutReminders} onChange={(v) => setNp("workoutReminders", v)} label="Scheduled workout reminders" />
        <Toggle checked={np.hydrationReminders} onChange={(v) => setNp("hydrationReminders", v)} label="Hydration reminders" />
        <Toggle checked={np.habitReminders} onChange={(v) => setNp("habitReminders", v)} label="Daily check-in reminder" />
        <Toggle checked={np.weeklyReport} onChange={(v) => setNp("weeklyReport", v)} label="Weekly progress review" />
        <Toggle checked={np.challengeDeadlines} onChange={(v) => setNp("challengeDeadlines", v)} label="Challenge deadlines" />
        <Toggle checked={np.milestones} onChange={(v) => setNp("milestones", v)} label="Milestones & achievements" />
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["reminderHour", "Reminder at"],
              ["quietStart", "Quiet from"],
              ["quietEnd", "Quiet until"],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={l} htmlFor={`s-${k}`}>
              <Select id={`s-${k}`} value={np[k]} onChange={(e) => setNp(k, Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </Select>
            </Field>
          ))}
        </div>
      </Section>

      <Section id="privacy" title="Privacy & accountability" icon={<Lock className="size-4" />} busy={saving === "privacy"} onSave={() => save("privacy", { visibility: p.visibility, shareWorkouts: p.shareWorkouts, accountability: p.accountability })}>
        <Field label="Profile visibility" htmlFor="s-vis">
          <Select id="s-vis" value={p.visibility} onChange={(e) => set("visibility", e.target.value)}>
            <option value="private">Private — nobody can find me</option>
            <option value="friends">Friends — only connections see my profile</option>
            <option value="public">Public — anyone can find me</option>
          </Select>
        </Field>
        <Toggle checked={p.shareWorkouts} onChange={(v) => set("shareWorkouts", v)} label="Show my workout count on my profile" />
        <Toggle checked={p.accountability} onChange={(v) => set("accountability", v)} label="Accountability mode" description="Get a gentle nudge when you miss a planned session (in-app only)." />
        <p className="text-xs text-subtle">Measurements, body photos and nutrition are always private and never appear on your profile.</p>
        <Link href="/profile/privacy" className="text-sm text-accent underline">Open the privacy center</Link>
      </Section>

      <Card>
        <CardTitle icon={<Sparkles className="size-4" />}>Integrations & plan</CardTitle>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>AI coach & analysis</span><Badge tone={ai.configured ? "accent" : "neutral"}>{ai.configured ? `Connected (${ai.model})` : "Not configured — rule-based"}</Badge></li>
          <li className="flex justify-between"><span>Food database</span><Badge tone={usda ? "accent" : "neutral"}>{usda ? "USDA + local" : "Local database"}</Badge></li>
          <li className="flex justify-between"><span>Wearables</span><Badge>Not configured</Badge></li>
        </ul>
        <ButtonLink href="/pricing" variant="outline" size="sm" className="mt-4">View plans</ButtonLink>
      </Card>

      <Card id="security">
        <CardTitle icon={<KeyRound className="size-4" />}>Security & sign-in</CardTitle>
        {security.notice?.text && <div className="mb-3"><Notice tone={security.notice.tone}>{security.notice.text}</Notice></div>}
        {security.isGuest ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted">You&apos;re using a guest session. Create an account to keep your progress beyond 30 days and to use it on other devices.</p>
            <ButtonLink href="/register" size="sm">Save my progress</ButtonLink>
          </div>
        ) : (
          <ul className="space-y-3 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>Email <span className="text-muted">({email})</span></span>
              <Badge tone={security.emailVerified ? "success" : "neutral"}>{security.emailVerified ? "Verified" : "Not verified"}</Badge>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>Password</span>
              {security.hasPassword ? <Badge tone="success">Set</Badge> : <Link href="/forgot-password" className="text-accent underline">Set a password via email</Link>}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>Google{security.google?.email ? <span className="text-muted"> ({security.google.email})</span> : null}</span>
              {security.google ? (
                <Badge tone="success">Connected</Badge>
              ) : security.googleEnabled ? (
                <a href="/api/auth/google?intent=link" className="inline-flex h-9 items-center rounded-xl border border-line px-3 font-semibold hover:border-accent">Connect Google</a>
              ) : (
                <Badge>Not configured on this server</Badge>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>Active sessions <span className="text-muted">({security.sessions})</span></span>
              <Button size="sm" variant="outline" onClick={logoutAll}>Sign out everywhere</Button>
            </li>
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Download className="size-4" />}>Get the app</CardTitle>
        <InstallApp />
      </Card>

      <Card id="data">
        <CardTitle icon={<Database className="size-4" />}>Your data</CardTitle>
        <p className="text-sm text-muted">Export everything as JSON, or permanently delete your account, data and stored media.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/account/export" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent"><Download className="size-4" /> Export data</a>
          <Button variant="danger" onClick={() => setDeleting(true)} icon={<ShieldAlert className="size-4" />}>Delete account</Button>
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-subtle"><Globe className="size-3" /> <Link href="/pricing" className="underline">Plans</Link> · data stays on this server</p>
      </Card>

      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete account permanently">
        <div className="space-y-3">
          <Notice tone="danger">This deletes your profile, workouts, nutrition, measurements, photos, posts and everything else. It can&apos;t be undone. Consider exporting your data first.</Notice>
          {security.hasPassword && <Field label="Password" htmlFor="del-pw"><Input id="del-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>}
          <Field label='Type "DELETE" to confirm' htmlFor="del-c"><Input id="del-c" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></Field>
          <Button variant="danger" className="w-full" disabled={(security.hasPassword && !pw) || confirmText !== "DELETE"} onClick={deleteAccount}>Delete everything</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Section({ title, icon, children, onSave, busy, id }: { title: string; icon: ReactNode; children: ReactNode; onSave?: () => void; busy?: boolean; id: string }) {
  return (
    <Card id={id}>
      <CardTitle icon={icon}>{title}</CardTitle>
      <div className="space-y-3">{children}</div>
      {onSave && (
        <Button className="mt-4" onClick={onSave} loading={busy}>
          Save
        </Button>
      )}
    </Card>
  );
}
