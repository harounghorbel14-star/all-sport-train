import { redirect } from "next/navigation";
import Link from "next/link";
import { Bot, CalendarDays, GraduationCap, HeartPulse, Shield, Sparkles } from "lucide-react";
import { currentUser } from "@/lib/auth/server";
import { FadeIn } from "@/components/ui/motion";
import { LandingGuest } from "./landing-guest";
import { InstallApp } from "@/components/pwa/install";

const FEATURES = [
  { icon: GraduationCap, title: "Calisthenics Academy", body: "Step-by-step progressions from your first push-up to the muscle-up, front lever and handstand — with prerequisite checks and safety notes." },
  { icon: CalendarDays, title: "24-week roadmap", body: "A six-phase framework that adapts to your logged sets, weekly reviews and recovery. Repeat or deload whenever you need." },
  { icon: Bot, title: "AI coach with a safety net", body: "Ask for today's workout, a 20-minute version or a technique lesson. Works with a rule-based coach even without an AI key." },
  { icon: HeartPulse, title: "Recovery that matters", body: "Readiness check-ins reduce your training load on rough days. Never pushed harder than your body says." },
  { icon: Sparkles, title: "Nutrition & activity", body: "Food diary, water, multisport logging and transparent calorie estimates — always shown as ranges." },
  { icon: Shield, title: "Private by default", body: "Progress photos and measurements stay private. Export or delete your data any time." },
];

export default async function Landing() {
  const user = await currentUser();
  if (user) redirect(user.isGuest || user.profile?.onboardingCompleted ? "/today" : "/onboarding");
  return (
    <main id="main" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 start-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-accent font-black text-accent-fg">A</span>
          <span className="num text-2xl font-bold">APEX FIT</span>
        </span>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-fg">Log in</Link>
          <Link href="/register" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">Get started</Link>
        </div>
      </nav>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pt-20">
        <FadeIn>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">Calisthenics · Strength · Multisport</p>
          <h1 className="num max-w-4xl text-6xl font-bold uppercase leading-[0.9] sm:text-8xl">
            Start from zero.
            <br />
            <span className="text-accent">Build for life.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Personalised training that adapts to your equipment, schedule, recovery and progress — useful from day one, with no equipment, subscription or wearable required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-2xl bg-accent px-7 py-4 text-lg font-semibold text-accent-fg shadow-[0_10px_40px_-10px_var(--accent)] transition-transform hover:-translate-y-0.5">
              Start your journey
            </Link>
            <Link href="/login" className="rounded-2xl border border-line px-7 py-4 text-lg font-semibold hover:border-accent">
              I have an account
            </Link>
          </div>
          <LandingGuest />
          <InstallApp className="mt-6" />
          <p className="mt-6 max-w-xl text-xs text-subtle">
            Results depend on consistency, genetics, recovery, nutrition, age and training history. We don&apos;t promise a particular physique or deadline — we help you show up and progress safely.
          </p>
        </FadeIn>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 px-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <FadeIn key={f.title} delay={0.05 * i}>
            <div className="h-full rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <f.icon className="mb-4 size-6 text-accent" aria-hidden />
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          </FadeIn>
        ))}
      </section>
    </main>
  );
}
