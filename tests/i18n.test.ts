import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en";
import fr from "@/lib/i18n/fr";
import ar from "@/lib/i18n/ar";

const flatten = (o: Record<string, unknown>, prefix = ""): Record<string, string> =>
  Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefix}${k}`, v]] : Object.entries(flatten(v as Record<string, unknown>, `${prefix}${k}.`)))));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const base = flatten(en as unknown as Record<string, unknown>);
  for (const [name, dict] of [["fr", fr], ["ar", ar]] as const) {
    it(`${name} translates every key and keeps every {placeholder}`, () => {
      const t = flatten(dict as unknown as Record<string, unknown>);
      expect(Object.keys(t).sort()).toEqual(Object.keys(base).sort());
      for (const [k, v] of Object.entries(base)) {
        expect(t[k].trim().length, k).toBeGreaterThan(0);
        expect(placeholders(t[k]), k).toEqual(placeholders(v));
      }
    });
  }
});
