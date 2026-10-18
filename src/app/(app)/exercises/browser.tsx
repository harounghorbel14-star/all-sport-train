"use client";

import { Heart, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DIFFICULTY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "@/lib/exercise-labels";
import { Badge, Card, Chip, EmptyState, Input, Select, cx } from "@/components/ui/primitives";
import { MuscleMap, MUSCLE_REGIONS, type RegionId } from "@/components/muscle-map";
import { Stagger, StaggerItem } from "@/components/ui/motion";

interface Ex {
  slug: string;
  name: string;
  description: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  movementPattern: string;
  difficulty: number;
  equipment: string[];
  sports: string[];
  locations: string[];
  category: string;
  favorite: boolean;
}

export function ExerciseBrowser({ exercises, ownedEquipment, sports }: { exercises: Ex[]; ownedEquipment: string[]; sports: { slug: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [regions, setRegions] = useState<RegionId[]>([]);
  const [pattern, setPattern] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [equipment, setEquipment] = useState("");
  const [sport, setSport] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [mine, setMine] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const muscles = new Set<string>(regions.flatMap((r) => MUSCLE_REGIONS.find((x) => x.id === r)!.muscles));
    return exercises.filter(
      (e) =>
        (!ql || e.name.toLowerCase().includes(ql) || e.description.toLowerCase().includes(ql)) &&
        (!muscles.size || e.primaryMuscles.some((m) => muscles.has(m))) &&
        (!pattern || e.movementPattern === pattern) &&
        (!difficulty || (difficulty === "beginner" ? e.difficulty <= 2 : difficulty === "advanced" ? e.difficulty >= 4 : e.difficulty === Number(difficulty))) &&
        (!equipment || (equipment === "none" ? e.equipment.length === 0 : e.equipment.includes(equipment))) &&
        (!sport || e.sports.includes(sport)) &&
        (!location || e.locations.includes(location)) &&
        (!category || e.category === category) &&
        (!favorites || e.favorite) &&
        (!mine || e.equipment.every((x) => ownedEquipment.includes(x))),
    );
  }, [exercises, q, regions, pattern, difficulty, equipment, sport, location, category, favorites, mine, ownedEquipment]);

  const active = [regions.length, pattern, difficulty, equipment, sport, location, category, favorites, mine].filter(Boolean).length;
  const reset = () => {
    setRegions([]);
    setPattern("");
    setDifficulty("");
    setEquipment("");
    setSport("");
    setLocation("");
    setCategory("");
    setFavorites(false);
    setMine(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" aria-label="Search exercises" />
        </div>
        <button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className={cx("flex items-center gap-2 rounded-xl border px-3 text-sm font-medium", active ? "border-accent text-accent" : "border-line")}>
          <SlidersHorizontal className="size-4" /> Filters{active ? ` (${active})` : ""}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip selected={mine} onClick={() => setMine(!mine)}>
          Fits my equipment
        </Chip>
        <Chip selected={favorites} onClick={() => setFavorites(!favorites)}>
          <Heart className="size-3.5" /> Favorites
        </Chip>
        <Chip selected={difficulty === "beginner"} onClick={() => setDifficulty(difficulty === "beginner" ? "" : "beginner")}>
          Beginner
        </Chip>
        <Chip selected={difficulty === "advanced"} onClick={() => setDifficulty(difficulty === "advanced" ? "" : "advanced")}>
          Advanced
        </Chip>
        {active > 0 && (
          <button onClick={reset} className="text-sm text-muted underline">
            Clear all
          </button>
        )}
      </div>
      {showFilters && (
        <Card className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <MuscleMap selected={regions} onToggle={(id) => setRegions((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))} />
          <div className="grid content-start gap-3 sm:grid-cols-2">
            <Select value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Movement pattern">
              <option value="">Any movement pattern</option>
              {Object.entries(PATTERN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
              <option value="">Any difficulty</option>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} · {DIFFICULTY_LABELS[d]}</option>)}
            </Select>
            <Select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Equipment">
              <option value="">Any equipment</option>
              <option value="none">No equipment</option>
              {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport">
              <option value="">Any sport</option>
              {sports.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              <option value="general">General fitness</option>
            </Select>
            <Select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location">
              <option value="">Any location</option>
              <option value="home">Home</option>
              <option value="gym">Gym</option>
              <option value="outdoor">Outdoors</option>
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Exercise type">
              <option value="">Any type</option>
              {["strength", "skill", "core", "mobility", "cardio", "plyometric"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </Select>
          </div>
        </Card>
      )}
      <p className="text-sm text-muted" aria-live="polite">
        {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
      </p>
      {filtered.length === 0 ? (
        <EmptyState icon={<Search className="size-5" />} title="No exercises match" body="Try removing a filter or searching a different term." />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 150).map((e) => (
            <StaggerItem key={e.slug}>
              <Link href={`/exercises/${e.slug}`}>
                <Card interactive className="h-full p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{e.name}</p>
                    {e.favorite && <Heart className="size-4 shrink-0 fill-accent text-accent" aria-label="Favorite" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{e.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="accent">L{e.difficulty}</Badge>
                    {e.primaryMuscles.slice(0, 2).map((m) => <Badge key={m}>{MUSCLE_LABELS[m] ?? m}</Badge>)}
                    <Badge tone="info">{e.equipment.length ? e.equipment.map((x) => EQUIPMENT_LABELS[x]).join(", ") : "Bodyweight"}</Badge>
                  </div>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
