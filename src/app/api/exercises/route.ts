import { z } from "zod";
import { publicRoute } from "@/lib/server/api";
import { searchExercises } from "@/lib/services/exercises";

const query = z.object({
  q: z.string().max(60).optional(),
  muscle: z.string().max(30).optional(),
  pattern: z.string().max(30).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  equipment: z.string().max(30).optional(),
  sport: z.string().max(30).optional(),
  location: z.string().max(10).optional(),
  category: z.string().max(20).optional(),
  level: z.enum(["beginner", "advanced"]).optional(),
  favorites: z.enum(["1", "0"]).optional(),
});

export const GET = publicRoute({ query }, async ({ query, user }) => ({
  exercises: await searchExercises({ ...query, favorites: query.favorites === "1" }, user?.id),
}));
