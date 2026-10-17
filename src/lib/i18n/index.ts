import en, { type Dictionary } from "./en";
import fr from "./fr";
import ar from "./ar";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL_LOCALES: Locale[] = ["ar"];
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };

const partials: Record<Locale, unknown> = { en, fr, ar };

function merge(base: Record<string, unknown>, over: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!over) return base;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(base)) {
    const b = base[k];
    const o = over[k];
    out[k] = typeof b === "object" && b !== null ? merge(b as Record<string, unknown>, o as Record<string, unknown>) : typeof o === "string" ? o : b;
  }
  return out;
}

const cache = new Map<Locale, Dictionary>();
export function getDictionary(locale: string): Dictionary {
  const l = (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "en";
  if (!cache.has(l)) cache.set(l, merge(en as unknown as Record<string, unknown>, partials[l] as Record<string, unknown>) as unknown as Dictionary);
  return cache.get(l)!;
}

export const isRtl = (locale: string) => RTL_LOCALES.includes(locale as Locale);

/** Simple {placeholder} interpolation. */
export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export type { Dictionary };
