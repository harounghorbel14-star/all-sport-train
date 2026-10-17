"use client";

import { Camera, Eye, EyeOff, HelpCircle, Lightbulb, ShieldCheck, Trash2, Video, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormCheckResult } from "@/lib/ai/form-check";
import { api } from "@/lib/client/api";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Notice, Select, Toggle, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

const MAX_FRAMES = 5;

/** Extract evenly spaced JPEG frames from a short video in the browser. */
async function extractFrames(file: File, count = MAX_FRAMES): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("This video format can't be read by your browser"));
    });
    if (video.duration > 60) throw new Error("Please use a clip under 60 seconds");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d")!;
    const frames: Blob[] = [];
    for (let i = 0; i < count; i++) {
      video.currentTime = (video.duration * (i + 0.5)) / count;
      await new Promise<void>((res) => (video.onseeked = () => res()));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85)));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Result = FormCheckResult;
interface HistoryItem { id: string; exerciseSlug: string; createdAt: string; provider: string; mediaId: string | null; result: Result | null }

export function FormCheckApp({ aiConfigured, exercises, history: initialHistory }: { aiConfigured: boolean; exercises: { slug: string; name: string }[]; history: HistoryItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [exercise, setExercise] = useState("push-up");
  const [file, setFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<{ blob: Blob; url: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [retain, setRetain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const name = (slug: string) => exercises.find((e) => e.slug === slug)?.name ?? slug;

  async function onFile(f: File | undefined) {
    setResult(null);
    frames.forEach((fr) => URL.revokeObjectURL(fr.url));
    setFrames([]);
    setFile(null);
    if (!f) return;
    if (f.type.startsWith("video/")) {
      if (f.size > 50 * 1024 * 1024) return toast("Video too large (max 50 MB)", "error");
      try {
        const blobs = await extractFrames(f);
        setFrames(blobs.map((b) => ({ blob: b, url: URL.createObjectURL(b) })));
        setFile(f);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not read video", "error");
      }
    } else {
      if (f.size > 8 * 1024 * 1024) return toast("Image too large (max 8 MB)", "error");
      setFrames([{ blob: f, url: URL.createObjectURL(f) }]);
      setFile(f);
    }
  }

  async function analyze() {
    if (!frames.length || !consent) return;
    setBusy(true);
    const form = new FormData();
    form.set("exercise", exercise);
    form.set("mediaKind", file?.type.startsWith("video/") ? "video" : "photo");
    form.set("consent", "true");
    form.set("retain", String(retain));
    frames.forEach((f, i) => form.append("frames", f.blob, `frame-${i}.jpg`));
    try {
      const r = await api<{ id: string; result: Result; mediaId: string | null }>("/api/form-check", { form });
      setResult(r.result);
      setHistory((h) => [{ id: r.id, exerciseSlug: exercise, createdAt: new Date().toISOString(), provider: r.result.provider, mediaId: r.mediaId, result: r.result }, ...h]);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Analysis failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/form-check/${id}`, { method: "DELETE" }).catch(() => undefined);
    setHistory((h) => h.filter((x) => x.id !== id));
    toast("Analysis and any stored media deleted");
  }

  return (
    <div className="space-y-6">
      {!aiConfigured && (
        <Notice tone="info">
          Visual AI analysis isn&apos;t configured on this server. You can still upload media and get a guided self-review checklist for the exercise — your media won&apos;t be analysed automatically.
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Camera className="size-4" />}>New check</CardTitle>
          <div className="space-y-4">
            <Field label="Exercise" htmlFor="fc-ex">
              <Select id="fc-ex" value={exercise} onChange={(e) => setExercise(e.target.value)}>
                {exercises.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}
              </Select>
            </Field>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center hover:border-accent">
              <span className="flex gap-2 text-accent"><Camera className="size-6" /><Video className="size-6" /></span>
              <span className="text-sm font-medium">{file ? file.name : "Upload a photo or a short video (≤ 60 s)"}</span>
              <span className="text-xs text-subtle">Film from the side at hip height, whole body in frame. Videos are sampled into {MAX_FRAMES} still frames on your device; the video itself is never uploaded.</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {frames.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {frames.map((f, i) => <img key={i} src={f.url} alt={`Frame ${i + 1}`} className="h-24 rounded-lg object-cover" />)}
              </div>
            )}
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-accent" /> Privacy</p>
              <p className="text-xs text-muted">
                {aiConfigured ? "The frames are sent securely to our AI provider for this analysis only." : "Frames are checked and discarded."} Nothing is stored unless you choose to keep a frame below, and nothing is ever shared publicly. You can delete any analysis at any time.
              </p>
              <Toggle checked={consent} onChange={setConsent} label="I consent to processing these images for form feedback" />
              <Toggle checked={retain} onChange={setRetain} label="Keep one frame privately with this analysis" description="Off by default." />
            </div>
            <Button className="w-full" size="lg" onClick={analyze} loading={busy} disabled={!frames.length || !consent}>
              {aiConfigured ? "Analyse my form" : "Get guided checklist"}
            </Button>
          </div>
        </Card>
        <div>{result ? <ResultView result={result} title={name(exercise)} /> : <EmptyState icon={<Eye className="size-5" />} title="Your feedback appears here" body="Observations are split into what's clearly visible, what's uncertain, and what a still image can't tell us." />}</div>
      </div>
      <section>
        <h2 className="num mb-3 text-2xl font-bold uppercase">Saved analyses</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No analyses yet.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {history.map((h) => (
              <li key={h.id}>
                <Card className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{name(h.exerciseSlug)}</p>
                    <p className="text-xs text-subtle">{new Date(h.createdAt).toLocaleString()} · <Badge>{h.provider === "ai" ? "AI analysis" : "Guided checklist"}</Badge></p>
                    {h.result?.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{h.result.summary}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {h.mediaId && <img src={`/api/media/${h.mediaId}`} alt="Saved frame" className="size-14 rounded-lg object-cover" />}
                    <button onClick={() => remove(h.id)} aria-label="Delete analysis" className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"><Trash2 className="size-4" /></button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResultView({ result, title }: { result: Result; title: string }) {
  const section = (label: string, icon: React.ReactNode, items: string[], tone: string) =>
    items.length > 0 && (
      <div>
        <p className={cx("mb-1 flex items-center gap-2 text-sm font-semibold", tone)}>{icon}{label}</p>
        <ul className="space-y-1 text-sm text-muted">{items.map((i) => <li key={i}>• {i}</li>)}</ul>
      </div>
    );
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="num text-2xl font-bold uppercase">{title}</h3>
        <Badge tone={result.provider === "ai" ? "accent" : "neutral"}>{result.provider === "ai" ? `AI · ${result.framesAnalyzed} frame(s)` : "Guided checklist"}</Badge>
      </div>
      <p className="text-sm">{result.summary}</p>
      {result.observations.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent"><Eye className="size-4" />Observed</p>
          <ul className="space-y-1 text-sm">
            {result.observations.map((o) => (
              <li key={o.text} className="flex items-start gap-2">
                <Badge tone={o.confidence === "clear" ? "accent" : o.confidence === "likely" ? "info" : "warn"}>{o.confidence}</Badge>
                <span className="text-muted">{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {section("Uncertain", <HelpCircle className="size-4" />, result.uncertain, "text-warn")}
      {section("Can't be assessed from this media", <EyeOff className="size-4" />, result.notAssessable, "text-subtle")}
      {section("Suggested corrections", <Wrench className="size-4" />, result.corrections, "text-fg")}
      {section("Technique tips", <Lightbulb className="size-4" />, result.tips, "text-info")}
      <p className="border-t border-line pt-3 text-xs text-subtle">{result.disclaimer}</p>
    </Card>
  );
}
