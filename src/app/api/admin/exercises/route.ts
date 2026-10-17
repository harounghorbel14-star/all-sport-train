import { z } from "zod";
import { authedRoute } from "@/lib/server/api";
import { upsertCustomExercise } from "@/lib/services/exercises";
import { EQUIPMENT, LIMITATIONS, MOVEMENT_PATTERNS, MUSCLES } from "@/lib/content/types";

const lines = z.array(z.string().trim().min(1).max(300)).max(15);
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/, "lowercase letters, numbers and dashes"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(500),
  category: z.enum(["strength", "skill", "core", "mobility", "cardio", "plyometric"]),
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  primaryMuscles: z.array(z.enum(MUSCLES)).min(1).max(6),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(8).default([]),
  equipment: z.array(z.enum(EQUIPMENT)).max(5).default([]),
  difficulty: z.number().int().min(1).max(5),
  isTimed: z.boolean().default(false),
  repMin: z.number().int().min(1).max(100).default(8),
  repMax: z.number().int().min(1).max(100).default(12),
  holdSeconds: z.number().int().min(5).max(600).nullable().default(null),
  restSeconds: z.number().int().min(0).max(600).default(90),
  met: z.number().min(1).max(20).default(4),
  steps: lines.min(1),
  setup: lines.default([]),
  breathing: z.string().max(300).default(""),
  mistakes: lines.min(1),
  safety: lines.default([]),
  contraindications: z.array(z.enum(LIMITATIONS)).default([]),
  mediaUrl: z.string().url().startsWith("https://").max(300).nullable().default(null),
});

export const POST = authedRoute({ body: schema, admin: true }, async ({ body }) => {
  const j = (v: unknown) => JSON.stringify(v);
  return {
    exercise: await upsertCustomExercise({
      ...body,
      primaryMuscles: j(body.primaryMuscles),
      secondaryMuscles: j(body.secondaryMuscles),
      equipment: j(body.equipment),
      steps: j(body.steps),
      setup: j(body.setup),
      mistakes: j(body.mistakes),
      safety: j(body.safety),
      contraindications: j(body.contraindications),
    }),
  };
});
