import type { RoutineKind } from "@/generated/prisma";

export const ROUTINE_KIND_OPTIONS = [
  { value: "COMPLETION", label: "Completion" },
  { value: "WORKOUT", label: "Workout" },
  { value: "CARDIO", label: "Cardio" },
  { value: "GUIDED", label: "Guided" },
  { value: "SESSION", label: "Session" },
] as const satisfies Array<{ value: RoutineKind; label: string }>;

export const ROUTINE_SUBTYPE_OPTIONS: Record<RoutineKind, string[]> = {
  COMPLETION: ["HEALTH", "COLD_PLUNGE", "SAUNA", "FOAM_ROLLING", "MASSAGE", "ACTIVE_RECOVERY", "RECOVERY", "OTHER"],
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

// Training domain — what kind of activity this is. One of:
//   • strength / cardio / mobility / sport — actual training stimulus
//   • lifestyle — non-training activities (supplements, reading, journaling,
//     cold plunge). These don't contribute to the strength/cardio/mobility/
//     sport training-balance bars, but still surface on the dashboard via
//     their frequency goals.
//
// Domain answers "what kind of thing is this?" — not "how often do I do it?"
// The "should this render with a daily calendar grid?" decision is derived
// from the frequency goal's target shape, not from the domain. So a daily
// hangboard routine sits in `strength` (it IS strength training) but still
// renders as a daily-grid habit because its frequency goal fires every day.
//
// Legacy values "skill" / "general" / "recovery" / "habit" still appear in
// older rows; effectiveRoutineDomain() remaps them on read.
export const ROUTINE_DOMAIN_OPTIONS = [
  { value: "strength",  label: "Strength" },
  { value: "cardio",    label: "Endurance" },
  { value: "mobility",  label: "Mobility / Rehab" },
  { value: "sport",     label: "Sport" },
  { value: "lifestyle", label: "Lifestyle" },
] as const;

// Full type including legacy values still stored in the DB
export type RoutineDomain =
  | (typeof ROUTINE_DOMAIN_OPTIONS)[number]["value"]
  | "skill"
  | "general"
  | "recovery"
  | "habit"; // legacy — accepted on read, remapped to "lifestyle" via effectiveRoutineDomain

export function deriveRoutineDomain(
  kind: string | null | undefined,
  subtype: string | null | undefined
): Exclude<RoutineDomain, "skill" | "general" | "recovery" | "habit"> {
  const k = normalizeRoutineKind(kind);
  const s = String(subtype ?? "").trim().toUpperCase();

  if (k === "CARDIO") return "cardio";

  if (k === "WORKOUT") {
    if (s === "REHAB") return "mobility";
    return "strength"; // STRENGTH, HYPERTROPHY, OTHER, and legacy SKILL all → strength
  }

  if (k === "GUIDED") {
    if (s === "EXERCISE") return "strength";
    if (s === "BREATHWORK" || s === "COOLDOWN" || s === "RECOVERY") return "mobility";
    return "mobility"; // MOBILITY, STRETCHING, WARMUP, REHAB, OTHER
  }

  if (k === "SESSION") {
    if (s === "YOGA_SESSION") return "mobility";
    return "sport"; // CLIMBING, SURFING, SNOWBOARDING, BASKETBALL, TENNIS, GOLF, etc.
  }

  // COMPLETION — all check-off style routines default to lifestyle (supplements,
  // journaling, cold plunge, foam rolling, reading, etc.). Users can override
  // (e.g. a daily hangboard COMPLETION routine should be moved to "strength").
  return "lifestyle";
}

// Returns the effective domain for a routine — respects an explicit override if set,
// otherwise falls back to deriving from kind+subtype.
// Legacy values: "skill" → strength, "habit" → lifestyle (new canonical name),
// "recovery" / "general" → re-derived from kind+subtype.
export function effectiveRoutineDomain(
  domain: string | null | undefined,
  kind: string | null | undefined,
  subtype: string | null | undefined
): Exclude<RoutineDomain, "skill" | "general" | "recovery" | "habit"> {
  const raw = String(domain ?? "").trim().toLowerCase();
  if (raw === "skill") return "strength";
  if (raw === "habit") return "lifestyle";
  if (raw && raw !== "general" && raw !== "recovery") {
    const ui = ROUTINE_DOMAIN_OPTIONS.map((o) => o.value as string);
    if (ui.includes(raw)) return raw as Exclude<RoutineDomain, "skill" | "general" | "recovery" | "habit">;
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
    case "lifestyle": return "rgba(251,191,36,0.9)";
    case "habit":     return "rgba(251,191,36,0.9)"; // legacy alias for lifestyle
    case "recovery":  return "rgba(251,113,133,0.9)"; // legacy; remapped on read
    default:          return "rgba(148,163,184,0.7)";
  }
}
