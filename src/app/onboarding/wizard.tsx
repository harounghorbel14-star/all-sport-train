"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { useI18n, fmt } from "@/components/providers";
import { Button, Chip, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui/primitives";
import { MuscleMap, emphasisFromRegions, type RegionId } from "@/components/muscle-map";
import { EQUIPMENT_LABELS, LIMITATION_LABELS } from "@/lib/content/exercises";
import { SPORTS } from "@/lib/content/sports";
import { ACTIVITY_LABELS, AGE_LABELS, DIET_LABELS, EMPHASIS_LABELS, EXPERIENCE_LABELS, GOAL_LABELS, LOCATION_LABELS, PREF_LABELS, WEEKDAYS } from "@/lib/labels";
import { inToCm, lbToKg } from "@/lib/format";

interface State {
  experience: string;
  startFromZero: boolean;
  goals: string[];
  emphasis: string;
  regions: RegionId[];
  sports: string[];
  location: string;
  equipment: string[];
  daysPerWeek: number;
  trainingDays: number[];
  sessionMinutes: number;
  activityLevel: string;
  ageRange: string;
  sex: string;
  units: "metric" | "imperial";
  height: string;
  weight: string;
  limitations: string[];
  limitationNotes: string;
  exercisePrefs: string[];
  dietPrefs: string[];
  allergies: string;
}

const STEPS = ["Welcome", "Goals", "Focus", "Sports", "Where & what", "Schedule", "About you", "Preferences", "Review"] as const;

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function OnboardingWizard({ name, initial }: { name: string; initial?: Partial<State> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<State>({
    experience: "beginner",
    startFromZero: false,
    goals: ["general_fitness"],
    emphasis: "balanced_calisthenics",
    regions: [],
    sports: ["calisthenics"],
    location: "home",
    equipment: [],
    daysPerWeek: 3,
    trainingDays: [1, 3, 5],
    sessionMinutes: 30,
    activityLevel: "light",
    ageRange: "",
    sex: "",
    units: "metric",
    height: "",
    weight: "",
    limitations: [],
    limitationNotes: "",
    exercisePrefs: [],
    dietPrefs: [],
    allergies: "",
    ...initial,
  });
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setError(null);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };

  const canNext = useMemo(() => {
    if (step === 1) return s.goals.length > 0;
    if (step === 5) return s.daysPerWeek >= 1;
    return true;
  }, [step, s]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const height = s.height ? (s.units === "imperial" ? inToCm(Number(s.height)) : Number(s.height)) : null;
    const weight = s.weight ? (s.units === "imperial" ? lbToKg(Number(s.weight)) : Number(s.weight)) : null;
    const limitations = s.exercisePrefs.includes("low_impact") ? [...new Set([...s.limitations, "high_impact"])] : s.limitations;
    try {
      await api("/api/onboarding", {
        body: {
          experience: s.startFromZero ? "zero" : s.experience,
          startFromZero: s.startFromZero,
          goals: s.startFromZero && !s.goals.includes("return_to_exercise") ? s.goals : s.goals,
          emphasis: s.emphasis,
          sports: s.sports,
          location: s.location,
          equipment: s.equipment,
          daysPerWeek: s.daysPerWeek,
          trainingDays: s.trainingDays.length === s.daysPerWeek ? s.trainingDays : [],
          sessionMinutes: s.sessionMinutes,
          activityLevel: s.activityLevel,
          ageRange: s.ageRange || null,
          sex: s.sex || null,
          heightCm: height ? Math.round(height * 10) / 10 : null,
          weightKg: weight ? Math.round(weight * 10) / 10 : null,
          limitations,
          limitationNotes: s.limitationNotes || null,
          exercisePrefs: s.exercisePrefs,
          dietPrefs: s.dietPrefs.filter((d) => d !== "none"),
          allergies: s.allergies.split(",").map((a) => a.trim()).filter(Boolean),
          units: s.units,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      router.push("/today?welcome=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSubmitting(false);
    }
  }

  const progress = (step + 1) / STEPS.length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-subtle">
          <span>{fmt(t.onboarding.stepOf, { n: step + 1, total: STEPS.length })}</span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <div className="relative min-h-[460px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            aria-labelledby="step-title"
          >
            {step === 0 && (
              <div>
                <h1 id="step-title" className="num text-5xl font-bold uppercase leading-none">
                  Hey {name}, <span className="text-accent">let&apos;s begin.</span>
                </h1>
                <p className="mt-3 text-muted">A few questions so every session fits your body, schedule and equipment. You can skip optional ones and change everything later.</p>
                <button
                  type="button"
                  onClick={() => set("startFromZero", !s.startFromZero)}
                  aria-pressed={s.startFromZero}
                  className={cx("mt-6 w-full rounded-2xl border-2 p-5 text-start transition-colors", s.startFromZero ? "border-accent bg-accent-soft" : "border-line bg-surface")}
                >
                  <div className="flex items-center gap-3">
                    <span className={cx("grid size-10 place-items-center rounded-xl", s.startFromZero ? "bg-accent text-accent-fg" : "bg-surface-3")}>
                      <Sparkles className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{t.onboarding.zeroTitle}</p>
                      <p className="text-sm text-muted">{t.onboarding.zeroBody}</p>
                    </div>
                  </div>
                </button>
                {!s.startFromZero && (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {Object.entries(EXPERIENCE_LABELS)
                      .filter(([k]) => k !== "zero")
                      .map(([k, v]) => (
                        <button key={k} type="button" onClick={() => set("experience", k)} aria-pressed={s.experience === k} className={cx("rounded-2xl border p-4 text-start transition-colors", s.experience === k ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
                          <p className="font-semibold">{v.label}</p>
                          <p className="text-xs text-muted">{v.body}</p>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <h1 id="step-title" className="num text-4xl font-bold uppercase">What are your goals?</h1>
                <p className="mt-2 text-sm text-muted">Pick as many as you like.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {Object.entries(GOAL_LABELS).map(([k, v]) => (
                    <Chip key={k} selected={s.goals.includes(k)} onClick={() => set("goals", toggle(s.goals, k))}>
                      {s.goals.includes(k) && <Check className="size-3.5" />} {v}
                    </Chip>
                  ))}
                </div>
                <Notice tone="info">
                  <span className="text-xs">{t.onboarding.disclaimer}</span>
                </Notice>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 id="step-title" className="num text-4xl font-bold uppercase">Where do you want to focus?</h1>
                <p className="mt-2 text-sm text-muted">Tap the areas you care most about. We&apos;ll suggest a program emphasis — every balanced plan keeps legs, core and mobility in.</p>
                <div className="mt-5">
                  <MuscleMap
                    selected={s.regions}
                    onToggle={(id) => {
                      const regions = toggle(s.regions, id);
                      setS((p) => ({ ...p, regions, emphasis: emphasisFromRegions(regions) }));
                    }}
                  />
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {Object.entries(EMPHASIS_LABELS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => set("emphasis", k)} aria-pressed={s.emphasis === k} className={cx("rounded-xl border p-3 text-start transition-colors", s.emphasis === k ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
                      <p className="text-sm font-semibold">{v.label}</p>
                      <p className="text-xs text-muted">{v.body}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 id="step-title" className="num text-4xl font-bold uppercase">Which sports do you enjoy?</h1>
                <p className="mt-2 text-sm text-muted">We&apos;ll add relevant tracking and conditioning ideas. Optional.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {SPORTS.map((sp) => (
                    <Chip key={sp.slug} selected={s.sports.includes(sp.slug)} onClick={() => set("sports", toggle(s.sports, sp.slug))}>
                      {sp.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h1 id="step-title" className="num text-4xl font-bold uppercase">Where & with what?</h1>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(LOCATION_LABELS).map(([k, v]) => (
                    <Chip key={k} selected={s.location === k} onClick={() => set("location", k)}>
                      {v}
                    </Chip>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Equipment you can use</p>
                  <p className="mb-3 text-xs text-subtle">Nothing selected = bodyweight only. We never assume equipment you haven&apos;t picked.</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => (
                      <Chip key={k} selected={s.equipment.includes(k)} onClick={() => set("equipment", toggle(s.equipment, k))}>
                        {v}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <h1 id="step-title" className="num text-4xl font-bold uppercase">Your schedule</h1>
                <Field label={`Training days per week: ${s.daysPerWeek}`} htmlFor="days">
                  <input
                    id="days"
                    type="range"
                    min={1}
                    max={7}
                    value={s.daysPerWeek}
                    onChange={(e) => setS((p) => ({ ...p, daysPerWeek: Number(e.target.value), trainingDays: [] }))}
                    className="w-full"
                  />
                </Field>
                <div>
                  <p className="mb-2 text-sm font-medium">Which days? <span className="text-xs text-subtle">(optional — pick {s.daysPerWeek})</span></p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d, i) => (
                      <Chip
                        key={d}
                        selected={s.trainingDays.includes(i)}
                        disabled={!s.trainingDays.includes(i) && s.trainingDays.length >= s.daysPerWeek}
                        onClick={() => set("trainingDays", toggle(s.trainingDays, i))}
                      >
                        {d}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Session length</p>
                  <div className="flex flex-wrap gap-2">
                    {[15, 20, 30, 45, 60, 75].map((m) => (
                      <Chip key={m} selected={s.sessionMinutes === m} onClick={() => set("sessionMinutes", m)}>
                        {m} min
                      </Chip>
                    ))}
                  </div>
                </div>
                <Field label="Day-to-day activity level" htmlFor="activity">
                  <Select id="activity" value={s.activityLevel} onChange={(e) => set("activityLevel", e.target.value)}>
                    {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5">
                <h1 id="step-title" className="num text-4xl font-bold uppercase">About you</h1>
                <p className="text-sm text-muted">All optional. Used only for safer programming and calorie estimates — never shown to others.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Age range" htmlFor="age" optional>
                    <Select id="age" value={s.ageRange} onChange={(e) => set("ageRange", e.target.value)}>
                      <option value="">Prefer not to say</option>
                      {Object.entries(AGE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Sex (for energy estimates)" htmlFor="sex" optional>
                    <Select id="sex" value={s.sex} onChange={(e) => set("sex", e.target.value)}>
                      <option value="">Prefer not to say</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="unspecified">Other / unspecified</option>
                    </Select>
                  </Field>
                  <Field label={`Height (${s.units === "metric" ? "cm" : "in"})`} htmlFor="height" optional>
                    <Input id="height" inputMode="decimal" value={s.height} onChange={(e) => set("height", e.target.value.replace(/[^\d.]/g, ""))} />
                  </Field>
                  <Field label={`Weight (${s.units === "metric" ? "kg" : "lb"})`} htmlFor="weight" optional>
                    <Input id="weight" inputMode="decimal" value={s.weight} onChange={(e) => set("weight", e.target.value.replace(/[^\d.]/g, ""))} />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Chip selected={s.units === "metric"} onClick={() => set("units", "metric")}>Metric</Chip>
                  <Chip selected={s.units === "imperial"} onClick={() => set("units", "imperial")}>Imperial</Chip>
                </div>
                {s.ageRange === "under18" && (
                  <Notice tone="warn">You&apos;re still growing — we&apos;ll focus on skills, technique and healthy habits, and won&apos;t suggest calorie deficits. Training with a parent, coach or PE teacher is a great idea.</Notice>
                )}
                <div>
                  <p className="mb-2 text-sm font-medium">Any discomfort or limitations?</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(LIMITATION_LABELS).map(([k, v]) => (
                      <Chip key={k} selected={s.limitations.includes(k)} onClick={() => set("limitations", toggle(s.limitations, k))}>
                        {v}
                      </Chip>
                    ))}
                  </div>
                  <Textarea className="mt-3" placeholder="Anything else we should know? (optional)" maxLength={500} value={s.limitationNotes} onChange={(e) => set("limitationNotes", e.target.value)} aria-label="Limitation notes" />
                  <p className="mt-2 text-xs text-subtle">We&apos;ll avoid exercises that commonly aggravate these. This isn&apos;t medical advice — for injuries or health conditions, check with a qualified professional.</p>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-5">
                <h1 id="step-title" className="num text-4xl font-bold uppercase">Preferences</h1>
                <div>
                  <p className="mb-2 text-sm font-medium">I enjoy…</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PREF_LABELS).map(([k, v]) => (
                      <Chip key={k} selected={s.exercisePrefs.includes(k)} onClick={() => set("exercisePrefs", toggle(s.exercisePrefs, k))}>
                        {v}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Nutrition preferences <span className="text-xs text-subtle">(optional)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(DIET_LABELS).map(([k, v]) => (
                      <Chip key={k} selected={s.dietPrefs.includes(k)} onClick={() => set("dietPrefs", toggle(s.dietPrefs, k))}>
                        {v}
                      </Chip>
                    ))}
                  </div>
                </div>
                <Field label="Allergies or foods to avoid" htmlFor="allergies" hint="Comma separated, e.g. peanuts, shellfish" optional>
                  <Input id="allergies" value={s.allergies} onChange={(e) => set("allergies", e.target.value)} maxLength={300} />
                </Field>
              </div>
            )}

            {step === 8 && (
              <div>
                <h1 id="step-title" className="num text-4xl font-bold uppercase">Looks great</h1>
                <dl className="mt-5 grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
                  <Row k="Level" v={s.startFromZero ? "Start from zero" : EXPERIENCE_LABELS[s.experience]?.label} />
                  <Row k="Emphasis" v={EMPHASIS_LABELS[s.emphasis]?.label} />
                  <Row k="Goals" v={s.goals.map((g) => GOAL_LABELS[g]).join(", ")} />
                  <Row k="Schedule" v={`${s.daysPerWeek}× per week · ${s.sessionMinutes} min`} />
                  <Row k="Location" v={LOCATION_LABELS[s.location]} />
                  <Row k="Equipment" v={s.equipment.length ? s.equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ") : "Bodyweight only"} />
                </dl>
                <p className="mt-4 text-sm text-muted">We&apos;ll create your first session and a 24-week roadmap that adapts to how training actually goes. {t.onboarding.disclaimer}</p>
                {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0} icon={<ArrowLeft className="size-4 rtl:rotate-180" />}>
          {t.common.back}
        </Button>
        <div className="flex gap-2">
          {[3, 6, 7].includes(step) && (
            <Button variant="ghost" onClick={() => go(step + 1)}>
              {t.common.skip}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => go(step + 1)} disabled={!canNext} size="lg">
              {t.common.next} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          ) : (
            <Button onClick={submit} loading={submitting} size="lg" icon={<Sparkles className="size-4" />}>
              {t.onboarding.finish}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-subtle">{k}</dt>
      <dd className="mt-0.5 font-medium">{v || "—"}</dd>
    </div>
  );
}
