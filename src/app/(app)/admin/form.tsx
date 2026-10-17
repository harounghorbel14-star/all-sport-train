"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { EQUIPMENT_LABELS, LIMITATION_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "@/lib/content/exercises";
import { Button, Chip, Field, Input, Select, Textarea, Toggle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function ExerciseAdmin({ existing }: { existing: { slug: string; name: string; isCustom: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ slug: "", name: "", description: "", category: "strength", movementPattern: "horizontal_push", difficulty: 2, isTimed: false, repMin: 8, repMax: 12, holdSeconds: 30, restSeconds: 90, met: 4, steps: "", mistakes: "", safety: "", breathing: "", mediaUrl: "" });
  const [muscles, setMuscles] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [contra, setContra] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const tog = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  async function submit() {
    setBusy(true);
    try {
      await api("/api/admin/exercises", {
        body: { ...f, holdSeconds: f.isTimed ? f.holdSeconds : null, primaryMuscles: muscles, equipment, contraindications: contra, steps: lines(f.steps), mistakes: lines(f.mistakes), safety: lines(f.safety), mediaUrl: f.mediaUrl || null },
      });
      toast(existing.some((e) => e.slug === f.slug) ? "Exercise updated" : "Exercise added");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label="Slug" htmlFor="a-slug" hint="lowercase-with-dashes. Using an existing slug updates that exercise."><Input id="a-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} /></Field>
        <Field label="Name" htmlFor="a-name"><Input id="a-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description" htmlFor="a-desc"><Textarea id="a-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="a-cat"><Select id="a-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{["strength", "skill", "core", "mobility", "cardio", "plyometric"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Pattern" htmlFor="a-pat"><Select id="a-pat" value={f.movementPattern} onChange={(e) => setF({ ...f, movementPattern: e.target.value })}>{Object.entries(PATTERN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Difficulty (1–5)" htmlFor="a-diff"><Input id="a-diff" type="number" min={1} max={5} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: Number(e.target.value) })} /></Field>
          <Field label="MET" htmlFor="a-met"><Input id="a-met" type="number" step="0.1" value={f.met} onChange={(e) => setF({ ...f, met: Number(e.target.value) })} /></Field>
          <Field label="Rep min" htmlFor="a-rmin"><Input id="a-rmin" type="number" value={f.repMin} onChange={(e) => setF({ ...f, repMin: Number(e.target.value) })} /></Field>
          <Field label="Rep max" htmlFor="a-rmax"><Input id="a-rmax" type="number" value={f.repMax} onChange={(e) => setF({ ...f, repMax: Number(e.target.value) })} /></Field>
          <Field label="Rest (s)" htmlFor="a-rest"><Input id="a-rest" type="number" value={f.restSeconds} onChange={(e) => setF({ ...f, restSeconds: Number(e.target.value) })} /></Field>
          <Field label="Hold (s)" htmlFor="a-hold"><Input id="a-hold" type="number" value={f.holdSeconds} disabled={!f.isTimed} onChange={(e) => setF({ ...f, holdSeconds: Number(e.target.value) })} /></Field>
        </div>
        <Toggle checked={f.isTimed} onChange={(v) => setF({ ...f, isTimed: v })} label="Timed hold" />
        <Field label="Video URL (https, optional)" htmlFor="a-media" hint="Only add verified demonstration videos."><Input id="a-media" value={f.mediaUrl} onChange={(e) => setF({ ...f, mediaUrl: e.target.value })} /></Field>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Primary muscles</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(MUSCLE_LABELS).map(([k, v]) => <Chip key={k} className="px-2 py-1 text-xs" selected={muscles.includes(k)} onClick={() => tog(muscles, setMuscles, k)}>{v}</Chip>)}</div>
        <p className="text-sm font-medium">Required equipment</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(EQUIPMENT_LABELS).map(([k, v]) => <Chip key={k} className="px-2 py-1 text-xs" selected={equipment.includes(k)} onClick={() => tog(equipment, setEquipment, k)}>{v}</Chip>)}</div>
        <p className="text-sm font-medium">Avoid with</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(LIMITATION_LABELS).map(([k, v]) => <Chip key={k} className="px-2 py-1 text-xs" selected={contra.includes(k)} onClick={() => tog(contra, setContra, k)}>{v}</Chip>)}</div>
        <Field label="Steps (one per line)" htmlFor="a-steps"><Textarea id="a-steps" value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} /></Field>
        <Field label="Common mistakes (one per line)" htmlFor="a-mis"><Textarea id="a-mis" value={f.mistakes} onChange={(e) => setF({ ...f, mistakes: e.target.value })} /></Field>
        <Field label="Safety notes (one per line)" htmlFor="a-safe" optional><Textarea id="a-safe" value={f.safety} onChange={(e) => setF({ ...f, safety: e.target.value })} /></Field>
        <Field label="Breathing" htmlFor="a-breath" optional><Input id="a-breath" value={f.breathing} onChange={(e) => setF({ ...f, breathing: e.target.value })} /></Field>
        <Button onClick={submit} loading={busy} disabled={!f.slug || !f.name || !muscles.length}>Save exercise</Button>
      </div>
    </div>
  );
}
