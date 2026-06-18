// The RPE strain model. Pure + isomorphic (imported by client forms AND server
// actions / zone-activity creation) — no prisma, no server-only imports.
//
// Core idea: the user rates perceived effort 1-10 (what they CAN judge); the app
// turns effort + duration into a training-load number (what they can't). Load is
// non-linear in intensity — a 9 stresses the body far more per minute than a 3 —
// so we weight effort with a convex curve (cf. Banister TRIMP's exponential HR
// weighting), not a flat multiply.

export const EFFORT_MIN = 1;
export const EFFORT_MAX = 10;

export function clampEffort(effort: number): number {
  return Math.max(EFFORT_MIN, Math.min(EFFORT_MAX, Math.round(effort)));
}

// Convex per-minute weight for each RPE point. Tunable lookup table — the shape
// (not the exact values) is what matters: it rises faster than linear so a 20-min
// sprint (9) outweighs an easy 80-min run (3): 20×15=300 > 80×2=160.
const EFFORT_WEIGHT: Record<number, number> = {
  1: 1, 2: 1.4, 3: 2, 4: 2.8, 5: 4, 6: 5.5, 7: 8, 8: 11, 9: 15, 10: 20,
};
export function effortWeight(effort: number): number {
  return EFFORT_WEIGHT[clampEffort(effort)] ?? 1;
}

// session-RPE load = duration(min) × convexWeight(effort). Returns 0 when we
// can't compute one (no effort, no duration).
export function computeLoad(effort: number | null | undefined, durationMin: number | null | undefined): number {
  if (effort == null || durationMin == null || durationMin <= 0) return 0;
  return Math.round(durationMin * effortWeight(effort));
}

// Unrated logs (effort=null) still need a value so the body map + Load view
// aren't hollow — estimate one from duration. Real ratings always win; this is
// only a placeholder, and the LEARNING never trains on it (it filters to
// effort != null).
export function predictEffortDefault(durationMin?: number | null): number {
  const d = durationMin ?? 30;
  if (d >= 150) return 7;
  if (d >= 90) return 6;
  if (d >= 45) return 5;
  if (d >= 20) return 4;
  return 3;
}

// The effort actually used for load/body-map: the rating if present, else the
// duration estimate.
export function effectiveEffort(effort: number | null | undefined, durationMin?: number | null): number {
  return effort != null ? clampEffort(effort) : predictEffortDefault(durationMin);
}

// ─── Display: zones, labels, anchors, colors ────────────────────────────────
export type EffortZone = { min: number; max: number; label: string; color: string };
export const EFFORT_ZONES: EffortZone[] = [
  { min: 1, max: 3, label: "Easy", color: "#4ade80" },     // green
  { min: 4, max: 6, label: "Moderate", color: "#facc15" }, // yellow
  { min: 7, max: 8, label: "Hard", color: "#fb923c" },     // orange
  { min: 9, max: 10, label: "Max", color: "#f87171" },     // red
];

export function effortZone(effort: number): EffortZone {
  const e = clampEffort(effort);
  return EFFORT_ZONES.find((z) => e >= z.min && e <= z.max) ?? EFFORT_ZONES[1];
}
export function effortLabel(effort: number): string {
  return effortZone(effort).label;
}
export function effortColor(effort: number): string {
  return effortZone(effort).color;
}

// CSS gradient for the slider track — green → yellow → orange → red across 1-10.
export const EFFORT_GRADIENT =
  "linear-gradient(90deg, #4ade80 0%, #a3e635 22%, #facc15 44%, #fb923c 70%, #f87171 100%)";

const EFFORT_ANCHOR: Record<number, string> = {
  1: "Barely anything",
  2: "Very light",
  3: "Light — easy conversation",
  4: "Comfortable",
  5: "Moderate — talking gets harder",
  6: "Somewhat hard",
  7: "Hard — short sentences only",
  8: "Very hard",
  9: "Near max — couldn't talk",
  10: "All-out effort",
};
export function effortAnchor(effort: number): string {
  return EFFORT_ANCHOR[clampEffort(effort)] ?? "";
}

// ─── Body-map intensity (1-10 → the 3 freshness buckets) ────────────────────
// The body map colors zones in 3 levels; the raw 1-10 + load are stored for
// charts/learning. Bucket: 1-3 easy, 4-6 moderate, 7-10 hard (Max folds into
// hard for coloring).
export type StrainIntensity = "easy" | "moderate" | "hard";
export function effortIntensity(effort: number): StrainIntensity {
  const e = clampEffort(effort);
  if (e <= 3) return "easy";
  if (e <= 6) return "moderate";
  return "hard";
}

// ─── Activity → muscle groups ───────────────────────────────────────────────
// Keyed by REGISTRY slug (endurance family or sport slug). Cardio activity-type
// slugs are mapped to a registry slug first (TYPE_SLUG_TO_REGISTRY_SLUG); sports
// use their own slug. Values are body-zone metadata-group slugs — slugs without
// a zone (e.g. forearms) are harmlessly dropped by the zone-activity resolver.
export const ACTIVITY_MUSCLE_MAP: Record<string, string[]> = {
  // Endurance
  running: ["quads", "hamstrings", "glutes", "calves", "hip-flexors", "tibialis", "abs", "glute-medius"],
  "trail-running": ["quads", "hamstrings", "glutes", "calves", "hip-flexors", "tibialis", "abs", "glute-medius"],
  walking: ["quads", "hamstrings", "glutes", "calves", "tibialis"],
  hiking: ["quads", "hamstrings", "glutes", "calves", "hip-flexors", "glute-medius", "tibialis"],
  biking: ["quads", "glutes", "calves", "hamstrings"],
  "road-cycling": ["quads", "glutes", "calves", "hamstrings"],
  "mountain-biking": ["quads", "glutes", "calves", "hamstrings", "forearms", "abs"],
  "gravel-cycling": ["quads", "glutes", "calves", "hamstrings"],
  swimming: ["lats", "shoulders", "upper-back", "chest", "triceps", "abs", "obliques"],
  "pool-swimming": ["lats", "shoulders", "upper-back", "chest", "triceps", "abs", "obliques"],
  "open-water-swimming": ["lats", "shoulders", "upper-back", "chest", "triceps", "abs", "obliques"],
  rowing: ["lats", "upper-back", "lower-back", "biceps", "quads", "glutes", "abs"],
  // Sports
  climbing: ["lats", "upper-back", "shoulders", "biceps", "forearms", "fingers", "abs", "obliques"],
  surfing: ["lats", "shoulders", "upper-back", "triceps", "abs", "obliques"],
  bodysurfing: ["lats", "shoulders", "calves", "glutes", "abs"],
  snowboarding: ["quads", "glutes", "calves", "abs", "obliques", "hip-flexors"],
  skiing: ["quads", "glutes", "calves", "abs", "hip-flexors", "adductors"],
  skateboarding: ["quads", "calves", "glutes", "abs"],
  basketball: ["quads", "calves", "glutes", "hamstrings", "abs", "shoulders"],
  spikeball: ["quads", "calves", "glutes", "shoulders", "abs"],
  tennis: ["quads", "calves", "shoulders", "forearms", "abs", "obliques"],
  golf: ["obliques", "abs", "forearms", "shoulders", "lower-back"],
};

export function musclesForActivity(registrySlug: string | null | undefined): string[] {
  if (!registrySlug) return [];
  return ACTIVITY_MUSCLE_MAP[registrySlug] ?? [];
}

// ─── Floor: which sessions are big enough to register on the body map ───────
// Load-based so it self-adjusts: a 1-mi easy walk (~15min×1.4≈21) stays under
// walking's floor; a long walk or a "felt hard" short session clears it.
const ACTIVITY_LOAD_FLOOR: Record<string, number> = {
  walking: 120, // recovery-tier — needs a real long walk to count
};
const DEFAULT_LOAD_FLOOR = 30;

export function loadFloor(registrySlug: string | null | undefined): number {
  return (registrySlug && ACTIVITY_LOAD_FLOOR[registrySlug]) || DEFAULT_LOAD_FLOOR;
}

export function clearsFloor(load: number, registrySlug: string | null | undefined): boolean {
  return load >= loadFloor(registrySlug);
}
