"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookmarkPlus, Camera, ChevronLeft, ChevronRight, Droplets, Pencil, Plus, Search, Sparkles, Trash2, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, attempt } from "@/lib/client/api";
import { formatDateKey } from "@/lib/format";
import { useI18n } from "@/components/providers";
import { Badge, Button, Card, CardTitle, Chip, EmptyState, Field, Input, Notice, Select, Skeleton, cx } from "@/components/ui/primitives";
import { BarChart, MeterBar, ProgressRing } from "@/components/ui/charts";
import { Sheet, useToast } from "@/components/ui/overlay";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

interface Entry {
  id: string;
  meal: Meal;
  name: string;
  grams: number;
  servingLabel: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: string;
  confidence: string | null;
  foodId: string | null;
}
interface Macros { kcal: number; proteinG: number; carbsG: number; fatG: number }
interface Day {
  dateKey: string;
  entries: Entry[];
  summary: { total: Macros; byMeal: Record<Meal, Macros> };
  waterMl: number;
  waterGoalMl: number;
  goals: { kcal: number | null; kcalNote: string; proteinG: number | null };
  exerciseKcal: { low: number; high: number };
  hasEstimates: boolean;
}
interface Food { id: string; name: string; kcalPer100g: number; proteinG: number; carbsG: number; fatG: number; servings: { label: string; grams: number }[]; source: string; isEstimate: boolean }
interface SavedMeal { id: string; name: string; items: { name: string; grams: number; kcal: number; proteinG: number; carbsG: number; fatG: number; foodId?: string | null }[]; servings: number; isRecipe: boolean }
interface EstItem { name: string; grams: number; kcal: number; proteinG: number; carbsG: number; fatG: number; confidence: "high" | "medium" | "low"; note?: string; foodId?: string | null }

const shift = (key: string, d: number) => new Date(Date.parse(key + "T12:00:00Z") + d * 86400000).toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function NutritionApp({ today, initialDay, initialWeek, initialMeals, aiConfigured, under18 }: { today: string; initialDay: Day; initialWeek: { dateKey: string; kcal: number; proteinG: number; logged: boolean }[]; initialMeals: SavedMeal[]; aiConfigured: boolean; under18: boolean }) {
  const { locale } = useI18n();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<Day | null>(initialDay);
  const [week, setWeek] = useState(initialWeek);
  const [meals, setMeals] = useState(initialMeals);
  const [addFor, setAddFor] = useState<Meal | null>(null);
  const [aiFor, setAiFor] = useState<Meal | null>(null);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (d = date) => {
      setError(null);
      try {
        const [dd, ww] = await Promise.all([api<Day>(`/api/nutrition/day?date=${d}`), api<{ days: typeof week }>(`/api/nutrition/week?end=${d}`)]);
        setDay(dd);
        setWeek(ww.days);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load");
      }
    },
    [date],
  );

  useEffect(() => {
    if (date !== initialDay.dateKey) {
      setDay(null);
      reload(date);
    }
  }, [date, initialDay.dateKey, reload]);

  async function water(ml: number) {
    try {
      await api("/api/nutrition/water", { body: { dateKey: date, ml } });
      setDay((d) => (d ? { ...d, waterMl: d.waterMl + ml } : d));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log water", "error");
    }
  }
  async function resetWater() {
    if (!(await attempt(api(`/api/nutrition/water?date=${date}`, { method: "DELETE" }), toast))) return;
    reload();
  }
  async function remove(id: string) {
    try {
      await api(`/api/nutrition/entries/${id}`, { method: "DELETE" });
      toast("Removed");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove", "error");
    }
  }
  async function saveMealAs(meal: Meal) {
    if (!day) return;
    const items = day.entries.filter((e) => e.meal === meal);
    const name = prompt("Name this saved meal", `${MEAL_LABEL[meal]} favourite`);
    if (!name) return;
    try {
      await api("/api/nutrition/meals", { body: { name, items: items.map((i) => ({ foodId: i.foodId, name: i.name, grams: i.grams, kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG })) } });
      const r = await api<{ meals: SavedMeal[] }>("/api/nutrition/meals");
      setMeals(r.meals);
      toast("Meal saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  }
  async function logSaved(m: SavedMeal, meal: Meal) {
    try {
      await api(`/api/nutrition/meals/${m.id}`, { body: { dateKey: date, meal } });
      toast(`${m.name} logged`);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log", "error");
    }
  }
  async function deleteSaved(id: string) {
    if (!(await attempt(api(`/api/nutrition/meals/${id}`, { method: "DELETE" }), toast))) return;
    setMeals((m) => m.filter((x) => x.id !== id));
  }

  const total = day?.summary.total;
  const goal = day?.goals.kcal ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={() => setDate(shift(date, -1))} aria-label="Previous day" icon={<ChevronLeft className="size-4 rtl:rotate-180" />} />
        <p className="font-semibold">{date === today ? "Today" : formatDateKey(date, locale, { weekday: "long", month: "short", day: "numeric" })}</p>
        <Button variant="secondary" size="sm" onClick={() => setDate(shift(date, 1))} disabled={date >= today} aria-label="Next day" icon={<ChevronRight className="size-4 rtl:rotate-180" />} />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {!day ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex items-center gap-5">
              <ProgressRing value={goal ? total!.kcal / goal : 0} size={130} label="Calories logged vs goal">
                <div>
                  <p className="num text-3xl font-bold">{total!.kcal}</p>
                  <p className="text-[10px] uppercase text-subtle">{goal ? `of ~${goal}` : "kcal"}</p>
                </div>
              </ProgressRing>
              <div className="space-y-1.5 text-xs text-muted">
                <p>Eaten: <span className="font-semibold text-fg">{total!.kcal} kcal</span></p>
                <p>Exercise (est.): <span className="font-semibold text-fg">{day.exerciseKcal.low}–{day.exerciseKcal.high} kcal</span></p>
                <p className="max-w-[16rem]">{day.goals.kcalNote}</p>
              </div>
            </Card>
            <Card>
              <CardTitle>Macros</CardTitle>
              {(
                [
                  ["Protein", total!.proteinG, day.goals.proteinG, "var(--accent)"],
                  ["Carbs", total!.carbsG, null, "var(--info)"],
                  ["Fat", total!.fatG, null, "var(--warn)"],
                ] as const
              ).map(([label, v, g, c]) => (
                <div key={label} className="mb-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{label}</span>
                    <span className="text-subtle">{r1(v)} g{g ? ` / ${g} g` : ""}</span>
                  </div>
                  <MeterBar value={v} max={g ?? Math.max(v, 1) * 1.4} color={c} />
                </div>
              ))}
            </Card>
            <Card>
              <CardTitle icon={<Droplets className="size-4 text-info" />} action={<button onClick={resetWater} className="text-xs text-subtle underline">Reset</button>}>
                Water
              </CardTitle>
              <p className="num text-4xl font-bold">
                {(day.waterMl / 1000).toFixed(2)} <span className="text-lg text-subtle">/ {(day.waterGoalMl / 1000).toFixed(1)} L</span>
              </p>
              <MeterBar className="mt-2" value={day.waterMl} max={day.waterGoalMl} color="var(--info)" />
              <div className="mt-3 flex gap-2">
                {[250, 500, 750].map((ml) => (
                  <Chip key={ml} onClick={() => water(ml)}>+{ml} ml</Chip>
                ))}
              </div>
            </Card>
          </div>

          {day.hasEstimates && <Notice tone="info">Some entries are AI or text estimates (marked “estimate”). Treat totals as approximate.</Notice>}
          {under18 && <Notice tone="warn">You&apos;re still growing — focus on regular, balanced meals and enough energy for training. We don&apos;t recommend calorie restriction for under-18s.</Notice>}

          <div className="grid gap-4 lg:grid-cols-2">
            {MEALS.map((meal) => {
              const items = day.entries.filter((e) => e.meal === meal);
              const m = day.summary.byMeal[meal];
              return (
                <Card key={meal}>
                  <CardTitle
                    icon={<Utensils className="size-4" />}
                    action={
                      <div className="flex items-center gap-1">
                        {items.length > 0 && <Button size="sm" variant="ghost" onClick={() => saveMealAs(meal)} aria-label={`Save ${MEAL_LABEL[meal]} as a meal`} icon={<BookmarkPlus className="size-4" />} />}
                        <Button size="sm" variant="ghost" onClick={() => setAiFor(meal)} icon={<Sparkles className="size-4" />} aria-label={`Describe or photograph ${MEAL_LABEL[meal]}`} />
                        <Button size="sm" variant="secondary" onClick={() => setAddFor(meal)} icon={<Plus className="size-4" />}>
                          Add
                        </Button>
                      </div>
                    }
                  >
                    {MEAL_LABEL[meal]} <span className="num ms-1 text-base normal-case tracking-normal text-fg">{m.kcal} kcal</span>
                  </CardTitle>
                  {items.length === 0 ? (
                    <p className="text-sm text-subtle">Nothing logged.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      <AnimatePresence initial={false}>
                        {items.map((e) => (
                          <motion.li key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-between gap-2 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{e.name}</p>
                              <p className="text-xs text-subtle">
                                {e.servingLabel ?? `${Math.round(e.grams)} g`} · P {r1(e.proteinG)} · C {r1(e.carbsG)} · F {r1(e.fatG)}
                                {(e.source === "ai_estimate" || e.confidence === "low") && <Badge tone="warn" className="ms-1">estimate</Badge>}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <span className="num text-lg font-bold">{e.kcal}</span>
                              <button onClick={() => setEdit(e)} aria-label={`Edit ${e.name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"><Pencil className="size-3.5" /></button>
                              <button onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger"><Trash2 className="size-3.5" /></button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Last 7 days</CardTitle>
          {week.some((d) => d.logged) ? (
            <BarChart unit=" kcal" data={week.map((d) => ({ label: formatDateKey(d.dateKey, locale, { weekday: "narrow" }), value: d.kcal, highlight: d.dateKey === date }))} />
          ) : (
            <EmptyState title="No meals logged this week" body="Log a meal to start seeing trends." />
          )}
        </Card>
        <Card>
          <CardTitle>Saved meals & recipes</CardTitle>
          {meals.length === 0 ? (
            <p className="text-sm text-muted">Save a meal you eat often with the bookmark button to log it in one tap.</p>
          ) : (
            <ul className="space-y-2">
              {meals.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-subtle">{m.items.reduce((s, i) => s + i.kcal, 0)} kcal · {m.items.length} items</span>
                  </span>
                  <span className="flex gap-1">
                    <Select aria-label={`Log ${m.name} to`} className="h-8 w-28 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) logSaved(m, e.target.value as Meal); e.target.value = ""; }}>
                      <option value="">Log to…</option>
                      {MEALS.map((x) => <option key={x} value={x}>{MEAL_LABEL[x]}</option>)}
                    </Select>
                    <button onClick={() => deleteSaved(m.id)} aria-label={`Delete ${m.name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"><Trash2 className="size-3.5" /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Nutrition basics</CardTitle>
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li>• Build meals around protein, vegetables or fruit, and a carbohydrate source.</li>
          <li>• Protein spread over 3–4 meals supports recovery from training.</li>
          <li>• Carbohydrates fuel harder sessions — don&apos;t fear them.</li>
          <li>• Consistency over perfection: logging most days is plenty to see trends.</li>
        </ul>
      </Card>

      <AddFoodSheet meal={addFor} dateKey={date} onClose={() => setAddFor(null)} onAdded={() => { setAddFor(null); reload(); }} />
      <AiMealSheet meal={aiFor} dateKey={date} aiConfigured={aiConfigured} onClose={() => setAiFor(null)} onSaved={() => { setAiFor(null); reload(); }} />
      <EditEntrySheet entry={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
    </div>
  );
}

function AddFoodSheet({ meal, dateKey, onClose, onAdded }: { meal: Meal | null; dateKey: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[] | null>(null);
  const [usda, setUsda] = useState(false);
  const [food, setFood] = useState<Food | null>(null);
  const [serving, setServing] = useState(0);
  const [qty, setQty] = useState("1");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!meal) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<{ foods: Food[]; usdaConfigured: boolean }>(`/api/nutrition/foods?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => {
          setResults(r.foods);
          setUsda(r.usdaConfigured);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, meal]);

  useEffect(() => {
    if (!meal) {
      setFood(null);
      setQ("");
      setCustom(false);
    }
  }, [meal]);

  const grams = food ? (food.servings[serving]?.grams ?? 100) * (Number(qty) || 0) : 0;
  const preview = food ? { kcal: Math.round((food.kcalPer100g * grams) / 100), p: r1((food.proteinG * grams) / 100), c: r1((food.carbsG * grams) / 100), f: r1((food.fatG * grams) / 100) } : null;

  async function log() {
    if (!food || !meal || grams <= 0) return;
    setBusy(true);
    try {
      if (food.id.startsWith("usda:")) {
        await api("/api/nutrition/entries", { body: { dateKey, meal, grams, name: food.name, kcal: preview!.kcal, proteinG: preview!.p, carbsG: preview!.c, fatG: preview!.f, source: "usda", confidence: "high", servingLabel: `${qty} × ${food.servings[serving].label}` } });
      } else {
        await api("/api/nutrition/entries", { body: { dateKey, meal, foodId: food.id, grams, servingLabel: `${qty} × ${food.servings[serving].label}` } });
      }
      toast(`${food.name} logged`);
      onAdded();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!meal} onClose={onClose} title={`Add to ${meal ? MEAL_LABEL[meal] : ""}`}>
      {custom ? (
        <CustomFoodForm dateKey={dateKey} meal={meal!} onDone={onAdded} onCancel={() => setCustom(false)} />
      ) : !food ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input autoFocus placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" aria-label="Search foods" />
          </div>
          {!q && <p className="text-xs text-subtle">Recently logged</p>}
          {results === null ? (
            <Skeleton className="h-24" />
          ) : results.length === 0 ? (
            <p className="text-sm text-muted">{q ? "No matches in the food database." : "No recent foods yet — search above."}</p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {results.map((f) => (
                <li key={f.id}>
                  <button onClick={() => { setFood(f); setServing(0); setQty("1"); }} className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-start hover:ring-1 hover:ring-accent">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="text-xs text-subtle">{Math.round(f.kcalPer100g)} kcal / 100 g {f.source === "usda" ? "· USDA" : f.source === "custom" ? "· custom" : "· typical values"}</span>
                    </span>
                    <Plus className="size-4 shrink-0 text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setCustom(true)} className="text-sm text-accent">Can&apos;t find it? Add a custom food</button>
          {!usda && <p className="text-[11px] text-subtle">Using the built-in food database (typical values). An extended database is available when the server has a USDA FoodData Central key.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setFood(null)} className="text-sm text-muted">← Back to search</button>
          <p className="font-semibold">{food.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serving" htmlFor="serving">
              <Select id="serving" value={serving} onChange={(e) => setServing(Number(e.target.value))}>
                {food.servings.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="qty">
              <Input id="qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
          </div>
          {preview && (
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center">
              <div><p className="num text-2xl font-bold">{preview.kcal}</p><p className="text-[10px] text-subtle">kcal</p></div>
              <div><p className="num text-2xl font-bold">{preview.p}</p><p className="text-[10px] text-subtle">protein g</p></div>
              <div><p className="num text-2xl font-bold">{preview.c}</p><p className="text-[10px] text-subtle">carbs g</p></div>
              <div><p className="num text-2xl font-bold">{preview.f}</p><p className="text-[10px] text-subtle">fat g</p></div>
            </div>
          )}
          <p className="text-xs text-subtle">{Math.round(grams)} g total{food.isEstimate ? " · typical values, brands vary" : ""}</p>
          <Button className="w-full" onClick={log} loading={busy} disabled={grams <= 0}>Log food</Button>
        </div>
      )}
    </Sheet>
  );
}

function CustomFoodForm({ dateKey, meal, onDone, onCancel }: { dateKey: string; meal: Meal; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "", grams: "100" });
  const [busy, setBusy] = useState(false);
  const n = (s: string) => Number(s) || 0;
  async function save() {
    setBusy(true);
    try {
      const food = await api<{ food: Food }>("/api/nutrition/foods", { body: { name: v.name, kcalPer100g: n(v.kcal), proteinG: n(v.protein), carbsG: n(v.carbs), fatG: n(v.fat) } });
      await api("/api/nutrition/entries", { body: { dateKey, meal, foodId: food.food.id, grams: n(v.grams) || 100 } });
      toast("Custom food saved and logged");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Field label="Food name" htmlFor="cf-name"><Input id="cf-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} /></Field>
      <p className="text-xs text-subtle">Values per 100 g (check the label).</p>
      <div className="grid grid-cols-2 gap-3">
        {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
          <Field key={k} label={k === "kcal" ? "Calories" : `${k[0].toUpperCase() + k.slice(1)} (g)`} htmlFor={`cf-${k}`}>
            <Input id={`cf-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "") })} />
          </Field>
        ))}
      </div>
      <Field label="Amount eaten (g)" htmlFor="cf-g"><Input id="cf-g" inputMode="decimal" value={v.grams} onChange={(e) => setV({ ...v, grams: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel}>Back</Button>
        <Button onClick={save} loading={busy} disabled={!v.name || !v.kcal}>Save & log</Button>
      </div>
    </div>
  );
}

function AiMealSheet({ meal, dateKey, aiConfigured, onClose, onSaved }: { meal: Meal | null; dateKey: string; aiConfigured: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState<{ items: EstItem[]; overallConfidence: string; assumptions: string[]; provider: string; disclaimer: string } | null>(null);

  useEffect(() => {
    if (!meal) {
      setText("");
      setImage(null);
      setEst(null);
    }
  }, [meal]);

  function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast("Photo too large (max 8 MB)", "error");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImage({ data: url.split(",")[1], mediaType: f.type, preview: url });
    };
    reader.readAsDataURL(f);
  }

  async function estimate() {
    setBusy(true);
    try {
      const r = await api<{ estimate: NonNullable<typeof est> }>("/api/nutrition/estimate", { body: { text: text || undefined, image: image ? { data: image.data, mediaType: image.mediaType } : undefined } });
      setEst(r.estimate);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not estimate", "error");
    } finally {
      setBusy(false);
    }
  }

  const upd = (i: number, k: keyof EstItem, v: string) =>
    setEst((s) => {
      if (!s) return s;
      const items = [...s.items];
      const item = { ...items[i] };
      if (k === "grams" && item.grams > 0) {
        const f = (Number(v) || 0) / item.grams;
        Object.assign(item, { grams: Number(v) || 0, kcal: Math.round(item.kcal * f), proteinG: r1(item.proteinG * f), carbsG: r1(item.carbsG * f), fatG: r1(item.fatG * f) });
      } else if (k === "name") item.name = v;
      else (item as unknown as Record<string, number>)[k] = Number(v) || 0;
      items[i] = item;
      return { ...s, items };
    });

  async function saveAll() {
    if (!est || !meal) return;
    setBusy(true);
    try {
      for (const it of est.items.filter((i) => i.grams > 0 && i.name)) {
        if (it.foodId) await api("/api/nutrition/entries", { body: { dateKey, meal, foodId: it.foodId, grams: it.grams } });
        else await api("/api/nutrition/entries", { body: { dateKey, meal, name: it.name, grams: it.grams, kcal: it.kcal, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, source: "ai_estimate", confidence: it.confidence === "high" ? "medium" : it.confidence } });
      }
      toast("Meal logged");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!meal} onClose={onClose} title="Describe or photograph a meal" wide>
      {!est ? (
        <div className="space-y-3">
          <Field label="What did you eat?" htmlFor="meal-text" hint="e.g. “2 boiled eggs, 150g white rice and a banana”">
            <textarea id="meal-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className="min-h-24 w-full rounded-xl border border-line bg-surface-2 p-3 focus:border-accent focus:outline-none" />
          </Field>
          <div>
            <label className={cx("flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-3 text-sm", !aiConfigured && "opacity-60")}>
              <Camera className="size-4" /> {image ? "Change photo" : "Add a photo (optional)"}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={!aiConfigured} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {!aiConfigured && <p className="mt-1 text-[11px] text-subtle">Photo estimates need an AI provider configured on the server. Text descriptions work with the built-in food database.</p>}
            {image && <img src={image.preview} alt="Meal preview" className="mt-2 max-h-40 rounded-xl object-cover" />}
            {image && <p className="mt-1 text-[11px] text-subtle">The photo is used only for this estimate and is not stored.</p>}
          </div>
          <Button className="w-full" onClick={estimate} loading={busy} disabled={!text.trim() && !image} icon={<Sparkles className="size-4" />}>Estimate</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Notice tone="warn">{est.disclaimer}</Notice>
          <p className="text-xs text-muted">
            Source: {est.provider === "ai" ? "AI estimate" : "built-in food database"} · overall confidence <Badge tone={est.overallConfidence === "low" ? "warn" : "info"}>{est.overallConfidence}</Badge>
          </p>
          <ul className="space-y-2">
            {est.items.map((it, i) => (
              <li key={i} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <Input value={it.name} onChange={(e) => upd(i, "name", e.target.value)} className="h-9" aria-label="Food name" />
                  <Badge tone={it.confidence === "low" ? "warn" : "info"}>{it.confidence}</Badge>
                  <button onClick={() => setEst((s) => (s ? { ...s, items: s.items.filter((_, j) => j !== i) } : s))} aria-label="Remove item" className="text-muted hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {(["grams", "kcal", "proteinG", "carbsG", "fatG"] as const).map((k) => (
                    <label key={k} className="text-[10px] text-subtle">
                      {k === "grams" ? "g" : k === "kcal" ? "kcal" : k.replace("G", " g")}
                      <Input inputMode="decimal" value={String(it[k])} onChange={(e) => upd(i, k, e.target.value.replace(/[^\d.]/g, ""))} className="h-8 px-2 text-sm" />
                    </label>
                  ))}
                </div>
                {it.note && <p className="mt-1 text-[11px] text-subtle">{it.note}</p>}
              </li>
            ))}
          </ul>
          {est.assumptions.length > 0 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Assumptions</summary>
              <ul className="mt-1 space-y-0.5">{est.assumptions.map((a) => <li key={a}>• {a}</li>)}</ul>
            </details>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEst(null)}>Back</Button>
            <Button className="flex-1" onClick={saveAll} loading={busy} disabled={!est.items.length}>Save {est.items.reduce((s, i) => s + i.kcal, 0)} kcal to diary</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function EditEntrySheet({ entry, onClose, onSaved }: { entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [grams, setGrams] = useState("");
  const [meal, setMeal] = useState<Meal>("lunch");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (entry) {
      setGrams(String(Math.round(entry.grams)));
      setMeal(entry.meal);
    }
  }, [entry]);
  async function save() {
    if (!entry) return;
    setBusy(true);
    try {
      await api(`/api/nutrition/entries/${entry.id}`, { method: "PATCH", body: { grams: Number(grams), meal, servingLabel: `${grams} g` } });
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={!!entry} onClose={onClose} title={`Edit ${entry?.name ?? ""}`}>
      <div className="space-y-3">
        <Field label="Amount (g)" htmlFor="edit-g"><Input id="edit-g" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
        <Field label="Meal" htmlFor="edit-meal">
          <Select id="edit-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
          </Select>
        </Field>
        <Button className="w-full" onClick={save} loading={busy} disabled={!Number(grams)}>Save</Button>
      </div>
    </Sheet>
  );
}
