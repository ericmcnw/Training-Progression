import type { RoutineKind } from "@prisma/client";

export const ROUTINE_KIND_OPTIONS = [
  { value: "COMPLETION", label: "Completion" },
  { value: "WORKOUT", label: "Workout" },
  { value: "CARDIO", label: "Cardio" },
  { value: "GUIDED", label: "Guided" },
  { value: "SESSION", label: "Session" },
] as const satisfies Array<{ value: RoutineKind; label: string }>;

export const ROUTINE_SUBTYPE_OPTIONS: Record<RoutineKind, string[]> = {
  COMPLETION: ["HABIT", "HEALTH", "RECOVERY", "OTHER"],
  WORKOUT: ["STRENGTH", "HYPERTROPHY", "REHAB", "SKILL", "OTHER"],
  CARDIO: ["RUN", "WALK", "BIKE", "SWIM", "HIKE", "ROW", "OTHER"],
  GUIDED: ["MOBILITY", "STRETCHING", "WARMUP", "COOLDOWN", "REHAB", "BREATHWORK", "OTHER"],
  SESSION: ["CLIMBING", "SURFING", "SNOWBOARDING", "TEAM_SPORT", "SKILL_PRACTICE", "HIKE_DAY", "OTHER"],
};

export const ROUTINE_KIND_LABEL: Record<RoutineKind, string> = {
  COMPLETION: "COMPLETION",
  WORKOUT: "WORKOUT",
  CARDIO: "CARDIO",
  GUIDED: "GUIDED",
  SESSION: "SESSION",
};

export function normalizeRoutineKind(value: string | null | undefined): RoutineKind {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "CHECK") return "COMPLETION";
  if (raw === "RUN") return "CARDIO";
  if (raw === "WORKOUT" || raw === "CARDIO" || raw === "GUIDED" || raw === "SESSION" || raw === "COMPLETION") {
    return raw;
  }
  return "COMPLETION";
}

export function normalizeRoutineSubtype(kind: RoutineKind, value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  const options = ROUTINE_SUBTYPE_OPTIONS[kind];
  if (options.includes(normalized)) return normalized;
  return "OTHER";
}

export function getRoutineSubtypeOptions(kind: RoutineKind) {
  return ROUTINE_SUBTYPE_OPTIONS[kind];
}

export function formatRoutineSubtype(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRoutineTypeLabel(kind: string | null | undefined) {
  return ROUTINE_KIND_LABEL[normalizeRoutineKind(kind)] ?? "COMPLETION";
}

export function routineKindColor(kind: string | null | undefined) {
  switch (normalizeRoutineKind(kind)) {
    case "CARDIO":
      return "rgba(59,130,246,0.85)";
    case "WORKOUT":
      return "rgba(34,197,94,0.85)";
    case "GUIDED":
      return "rgba(236,153,75,0.85)";
    case "SESSION":
      return "rgba(244,114,182,0.85)";
    default:
      return "rgba(255,199,92,0.85)";
  }
}

export function isWorkoutKind(kind: string | null | undefined) {
  return normalizeRoutineKind(kind) === "WORKOUT";
}

export function isCardioKind(kind: string | null | undefined) {
  return normalizeRoutineKind(kind) === "CARDIO";
}

export function isCompletionKind(kind: string | null | undefined) {
  return normalizeRoutineKind(kind) === "COMPLETION";
}

export function isGuidedKind(kind: string | null | undefined) {
  return normalizeRoutineKind(kind) === "GUIDED";
}

export function isSessionKind(kind: string | null | undefined) {
  return normalizeRoutineKind(kind) === "SESSION";
}
