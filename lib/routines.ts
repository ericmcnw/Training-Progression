import type { RoutineKind } from "@/generated/prisma";

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
  GUIDED: ["MOBILITY", "STRETCHING", "EXERCISE", "WARMUP", "COOLDOWN", "REHAB", "BREATHWORK", "OTHER"],
  SESSION: ["CLIMBING", "SURFING", "SNOWBOARDING", "BASKETBALL", "GOLF", "TEAM_SPORT", "SKILL_PRACTICE", "HIKE_DAY", "OTHER"],
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
      return "rgba(168,85,247,0.85)";
    case "SESSION":
      return "rgba(234,179,8,0.85)";
    default:
      return "rgba(244,114,182,0.85)";
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

export function supportsRoutineSteps(kind: string | null | undefined) {
  const normalized = normalizeRoutineKind(kind);
  return normalized === "GUIDED";
}

// Training domain — used for balance/coverage views across the dashboard and progress page.
// The domain field on Routine can be set explicitly; this function derives a sensible default
// from kind+subtype for any routine where domain is "general" (the historical default).
export const ROUTINE_DOMAIN_OPTIONS = [
  { value: "strength",  label: "Strength" },
  { value: "cardio",    label: "Cardio" },
  { value: "mobility",  label: "Mobility" },
  { value: "sport",     label: "Sport / Session" },
  { value: "recovery",  label: "Recovery" },
  { value: "skill",     label: "Skill Work" },
  { value: "habit",     label: "Habit / Health" },
  { value: "general",   label: "General" },
] as const;

export type RoutineDomain = (typeof ROUTINE_DOMAIN_OPTIONS)[number]["value"];

export function deriveRoutineDomain(
  kind: string | null | undefined,
  subtype: string | null | undefined
): RoutineDomain {
  const k = normalizeRoutineKind(kind);
  const s = String(subtype ?? "").trim().toUpperCase();

  if (k === "CARDIO") return "cardio";

  if (k === "WORKOUT") {
    if (s === "SKILL") return "skill";
    if (s === "REHAB") return "recovery";
    return "strength"; // STRENGTH, HYPERTROPHY, OTHER all map here
  }

  if (k === "GUIDED") {
    if (s === "REHAB" || s === "BREATHWORK" || s === "COOLDOWN") return "recovery";
    if (s === "EXERCISE") return "strength";
    return "mobility"; // MOBILITY, STRETCHING, WARMUP, OTHER
  }

  if (k === "SESSION") {
    if (s === "SKILL_PRACTICE") return "skill";
    return "sport"; // CLIMBING, SURFING, SNOWBOARDING, BASKETBALL, etc.
  }

  // COMPLETION
  if (s === "RECOVERY") return "recovery";
  if (s === "HABIT" || s === "HEALTH" || s === "OTHER") return "habit";
  return "habit";
}

// Returns the effective domain for a routine — respects an explicit override if set,
// otherwise falls back to deriving from kind+subtype.
export function effectiveRoutineDomain(
  domain: string | null | undefined,
  kind: string | null | undefined,
  subtype: string | null | undefined
): RoutineDomain {
  const raw = String(domain ?? "").trim().toLowerCase();
  const valid = ROUTINE_DOMAIN_OPTIONS.map((o) => o.value as string);
  if (raw && raw !== "general" && valid.includes(raw)) return raw as RoutineDomain;
  return deriveRoutineDomain(kind, subtype);
}
