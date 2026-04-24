import type { RoutineKind } from "@/generated/prisma";

export const ROUTINE_KIND_OPTIONS = [
  { value: "COMPLETION", label: "Completion" },
  { value: "WORKOUT", label: "Workout" },
  { value: "CARDIO", label: "Cardio" },
  { value: "GUIDED", label: "Guided" },
  { value: "SESSION", label: "Session" },
] as const satisfies Array<{ value: RoutineKind; label: string }>;

export const ROUTINE_SUBTYPE_OPTIONS: Record<RoutineKind, string[]> = {
  COMPLETION: ["HABIT", "HEALTH", "COLD_PLUNGE", "SAUNA", "FOAM_ROLLING", "MASSAGE", "ACTIVE_RECOVERY", "RECOVERY", "OTHER"],
  WORKOUT: ["STRENGTH", "HYPERTROPHY", "REHAB", "OTHER"],
  CARDIO: ["RUN", "EASY_RUN", "TEMPO_RUN", "LONG_RUN", "WALK", "EASY_WALK", "BIKE", "SWIM", "HIKE", "ROW", "OTHER"],
  GUIDED: ["MOBILITY", "STRETCHING", "EXERCISE", "WARMUP", "COOLDOWN", "REHAB", "BREATHWORK", "RECOVERY", "OTHER"],
  SESSION: ["CLIMBING", "SURFING", "SNOWBOARDING", "BASKETBALL", "TENNIS", "GOLF", "TEAM_SPORT", "SKILL_PRACTICE", "YOGA_SESSION", "HIKE_DAY", "OTHER"],
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
      return "rgba(96,165,250,0.9)";
    case "WORKOUT":
      return "rgba(74,222,128,0.9)";
    case "GUIDED":
      return "rgba(167,139,250,0.9)";
    case "SESSION":
      return "rgba(251,146,60,0.9)";
    default:
      return "rgba(244,114,182,0.9)";
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
// from kind+subtype for any routine where domain is unset or "general".
//
// UI options: 5 training categories + habit. "skill" and "general" are kept as valid values
// for backward compatibility but are not shown to users — they remap automatically.
export const ROUTINE_DOMAIN_OPTIONS = [
  { value: "strength",  label: "Strength" },
  { value: "cardio",    label: "Cardio" },
  { value: "mobility",  label: "Mobility" },
  { value: "sport",     label: "Sport" },
  { value: "recovery",  label: "Recovery" },
  { value: "habit",     label: "Habit / Health" },
] as const;

// Full type including legacy values stored in the DB
export type RoutineDomain =
  | (typeof ROUTINE_DOMAIN_OPTIONS)[number]["value"]
  | "skill"
  | "general";

export function deriveRoutineDomain(
  kind: string | null | undefined,
  subtype: string | null | undefined
): Exclude<RoutineDomain, "skill" | "general"> {
  const k = normalizeRoutineKind(kind);
  const s = String(subtype ?? "").trim().toUpperCase();

  if (k === "CARDIO") return "cardio";

  if (k === "WORKOUT") {
    if (s === "REHAB") return "recovery";
    return "strength"; // STRENGTH, HYPERTROPHY, OTHER, and legacy SKILL all → strength
  }

  if (k === "GUIDED") {
    if (s === "REHAB" || s === "BREATHWORK" || s === "COOLDOWN" || s === "RECOVERY") return "recovery";
    if (s === "EXERCISE") return "strength";
    return "mobility"; // MOBILITY, STRETCHING, WARMUP, OTHER
  }

  if (k === "SESSION") {
    if (s === "YOGA_SESSION") return "mobility";
    return "sport"; // CLIMBING, SURFING, SNOWBOARDING, BASKETBALL, TENNIS, GOLF, etc.
  }

  // COMPLETION
  if (s === "COLD_PLUNGE" || s === "SAUNA" || s === "FOAM_ROLLING" || s === "MASSAGE" || s === "ACTIVE_RECOVERY" || s === "RECOVERY") {
    return "recovery";
  }
  return "habit"; // HABIT, HEALTH, OTHER
}

// Returns the effective domain for a routine — respects an explicit override if set,
// otherwise falls back to deriving from kind+subtype.
// Legacy "skill" → strength, "general" → derived.
export function effectiveRoutineDomain(
  domain: string | null | undefined,
  kind: string | null | undefined,
  subtype: string | null | undefined
): Exclude<RoutineDomain, "skill" | "general"> {
  const raw = String(domain ?? "").trim().toLowerCase();
  if (raw === "skill") return "strength";
  if (raw && raw !== "general") {
    const ui = ROUTINE_DOMAIN_OPTIONS.map((o) => o.value as string);
    if (ui.includes(raw)) return raw as Exclude<RoutineDomain, "skill" | "general">;
  }
  return deriveRoutineDomain(kind, subtype);
}

// Domain accent color — used for training balance bars and domain badges.
export function domainColor(domain: RoutineDomain | string): string {
  switch (domain) {
    case "strength":  return "rgba(84,203,130,0.9)";
    case "cardio":    return "rgba(78,148,255,0.9)";
    case "mobility":  return "rgba(192,132,252,0.9)";
    case "sport":     return "rgba(251,146,60,0.9)";
    case "recovery":  return "rgba(251,113,133,0.9)";
    case "habit":     return "rgba(251,191,36,0.9)";
    default:          return "rgba(251,191,36,0.7)";
  }
}
