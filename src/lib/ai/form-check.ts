import { z } from "zod";
import { badRequest } from "../server/errors";
import { getExercise } from "../services/exercises";
import { AiUnavailableError, aiStatus, structured } from "./provider";

export const formCheckResultSchema = z.object({
  observations: z.array(z.object({ text: z.string(), confidence: z.enum(["clear", "likely", "uncertain"]) })),
  uncertain: z.array(z.string()),
  notAssessable: z.array(z.string()),
  tips: z.array(z.string()),
  corrections: z.array(z.string()),
  summary: z.string(),
});
export type FormCheckResult = z.infer<typeof formCheckResultSchema> & { provider: "ai" | "guided"; disclaimer: string; framesAnalyzed: number };

const DISCLAIMER =
  "This is educational movement feedback, not a medical or biomechanical assessment. A few images can't capture full movement quality, depth or tempo. If something hurts, stop and consult a qualified professional.";

export interface Frame {
  data: string; // base64
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export async function analyzeForm(exerciseSlug: string, frames: Frame[], mediaKind: "photo" | "video"): Promise<FormCheckResult> {
  if (!frames.length) throw badRequest("Add a photo or video first");
  if (frames.length > 6) throw badRequest("Too many frames (max 6)");
  const { exercise } = await getExercise(exerciseSlug);

  if (aiStatus().configured) {
    try {
      const system = `You review exercise form from user-provided images for a fitness app. Exercise: ${exercise.name}.
Correct technique: ${exercise.steps.join(" ")}
Key cues: ${exercise.cues.join("; ") || "n/a"}. Common mistakes: ${exercise.mistakes.join("; ")}.
${mediaKind === "video" ? `The images are ${frames.length} frames sampled in order from a short video.` : "This is a single still photo (or a few photos), so you cannot judge movement, tempo or range over a full repetition."}
Rules:
- Separate what is clearly visible, what is likely but uncertain, and what cannot be assessed from these images (e.g. tempo, full range, breathing, joint angles hidden by clothing or camera angle).
- Do not diagnose injuries or conditions. Do not comment on body shape, weight or attractiveness — only movement.
- Keep feedback specific to ${exercise.name}, encouraging and practical. 2–5 items per list at most.`;
      const res = await structured({
        system,
        messages: [
          {
            role: "user",
            content: [
              ...frames.map((f) => ({ type: "image" as const, source: { type: "base64" as const, media_type: f.mediaType, data: f.data } })),
              { type: "text" as const, text: `Please review my ${exercise.name} form.` },
            ],
          },
        ],
        schema: formCheckResultSchema,
        maxTokens: 2500,
      });
      return { ...res, provider: "ai", disclaimer: DISCLAIMER, framesAnalyzed: frames.length };
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
    }
  }

  // Guided self-review: honest checklist, explicitly not an analysis of the media.
  return {
    observations: [],
    uncertain: [],
    notAssessable: ["Automatic visual analysis is not available right now, so your media was not analysed."],
    tips: exercise.cues.length ? exercise.cues : exercise.steps.slice(0, 3),
    corrections: exercise.mistakes.map((m) => `Check for: ${m.toLowerCase()}`),
    summary: `Compare your ${mediaKind} with this checklist for ${exercise.name}. Film from the side at hip height for the clearest view.`,
    provider: "guided",
    disclaimer: DISCLAIMER,
    framesAnalyzed: 0,
  };
}
