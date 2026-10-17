import type { z } from "zod";

/** Parse a JSON column, validating with a schema. Falls back on corrupt data instead of crashing a page. */
export function parseJson<T>(raw: string | null | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export const toJson = (value: unknown) => JSON.stringify(value);
