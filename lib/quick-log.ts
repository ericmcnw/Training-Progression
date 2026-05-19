import type { Prisma, PrismaClient, RoutineKind } from "@/generated/prisma";
import {
  ROUTINE_DOMAIN_OPTIONS,
  ROUTINE_SUBTYPE_OPTIONS,
  formatRoutineSubtype,
  normalizeRoutineKind,
  normalizeRoutineSubtype,
  type RoutineDomain,
} from "./routines";

// Quick logs (today: workouts only) are stored against an auto-created
// "placeholder" Routine — one row per (domain, subtype) combo. This keeps
// the rest of the codebase routine-id-based without forcing the user to
// pre-create a routine for one-off sessions.
//
// Placeholders carry real domain values so they participate in Training
// Balance bars and frequency-goal trigger matching. They're filtered out
// of every user-facing list by the `isPlaceholder = true` flag — see the
// `/routines` page and `getGoalFormOptions()` for the where clauses.

export type QuickLogDomain = (typeof ROUTINE_DOMAIN_OPTIONS)[number]["value"];

// Domain options for the quick-log picker. We exclude `sport` because quick
// "session" logs aren't supported yet (users with a one-off climbing day are
// better served creating a real session routine — see the design notes).
export const QUICK_WORKOUT_DOMAIN_OPTIONS: ReadonlyArray<{ value: QuickLogDomain; label: string; description: string }> = [
  { value: "strength",  label: "Strength",         description: "Counts toward the Strength bar" },
  { value: "mobility",  label: "Mobility / Rehab", description: "Counts toward the Mobility bar" },
  { value: "cardio",    label: "Endurance",        description: "Counts toward the Endurance bar (rare for quick workouts)" },
  { value: "lifestyle", label: "Lifestyle",        description: "Counts toward the Lifestyle bar" },
];

// Workout-kind subtypes that show in the quick-log picker. Mirrors
// ROUTINE_SUBTYPE_OPTIONS.WORKOUT but exposed here so the picker doesn't
// have to know about routine-kind plumbing.
export const QUICK_WORKOUT_SUBTYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  ROUTINE_SUBTYPE_OPTIONS.WORKOUT.map((value) => ({
    value,
    label: formatRoutineSubtype(value),
  }));

export const DEFAULT_QUICK_WORKOUT_DOMAIN: QuickLogDomain = "strength";
export const DEFAULT_QUICK_WORKOUT_SUBTYPE = "STRENGTH";

function placeholderName(kind: RoutineKind, domain: QuickLogDomain, subtype: string) {
  const domainLabel = ROUTINE_DOMAIN_OPTIONS.find((opt) => opt.value === domain)?.label ?? domain;
  const subtypeLabel = formatRoutineSubtype(subtype) || subtype;
  const kindLabel = kind === "WORKOUT" ? "Workout" : kind.toLowerCase();
  return `Quick ${kindLabel} · ${domainLabel} · ${subtypeLabel}`;
}

// Find-or-create the placeholder routine for a given (kind, domain, subtype).
// Pass either a regular PrismaClient or a transaction handle — both work via
// the structural type. Safe to call repeatedly; a tiny race could create
// duplicates (no unique constraint) but the cost is just an extra hidden row.
export async function findOrCreateQuickLogPlaceholder(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    kind: RoutineKind;
    domain: QuickLogDomain;
    subtype: string;
  }
): Promise<{ id: string }> {
  const kind = normalizeRoutineKind(params.kind);
  const domain = params.domain;
  const subtype = normalizeRoutineSubtype(kind, params.subtype) ?? "OTHER";

  const existing = await db.routine.findFirst({
    where: {
      isPlaceholder: true,
      isDeleted: false,
      kind,
      domain,
      subtype,
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  });
  if (existing) return existing;

  return db.routine.create({
    data: {
      name: placeholderName(kind, domain, subtype),
      kind,
      domain,
      subtype,
      isActive: false,
      isDeleted: false,
      isPlaceholder: true,
    },
    select: { id: true },
  });
}

// Sanitize a domain string from the form. Falls back to the default when an
// unknown value comes in (shouldn't happen from the UI but cheap defense).
export function sanitizeQuickLogDomain(value: string | null | undefined): QuickLogDomain {
  const normalized = String(value ?? "").trim().toLowerCase();
  const match = QUICK_WORKOUT_DOMAIN_OPTIONS.find((opt) => opt.value === normalized);
  return match?.value ?? DEFAULT_QUICK_WORKOUT_DOMAIN;
}

export function sanitizeQuickWorkoutSubtype(value: string | null | undefined): string {
  const normalized = normalizeRoutineSubtype("WORKOUT", value);
  return normalized ?? DEFAULT_QUICK_WORKOUT_SUBTYPE;
}

// Suggest a reasonable (domain, subtype) for a quick workout given the
// exercises chosen. This is a heuristic — defaults are safe so the user
// only has to override when they're doing something unusual.
//
// Today we look at the library kind of the chosen exercises: REHAB →
// (mobility, REHAB); MOBILITY → (mobility, REHAB); otherwise → (strength,
// STRENGTH). Hooked up via the form's auto-suggest button.
export type ExerciseLibraryHint = {
  exerciseId: string;
  libraryKind?: string | null;
};

export function suggestQuickWorkoutPlacement(
  exercises: ExerciseLibraryHint[]
): { domain: QuickLogDomain; subtype: string } {
  if (exercises.length === 0) {
    return { domain: DEFAULT_QUICK_WORKOUT_DOMAIN, subtype: DEFAULT_QUICK_WORKOUT_SUBTYPE };
  }
  const kinds = exercises.map((e) => String(e.libraryKind ?? "").toUpperCase());
  const allMobility = kinds.every((k) => k === "MOBILITY" || k === "REHAB" || k === "STRETCHING");
  if (allMobility) return { domain: "mobility", subtype: "REHAB" };
  return { domain: DEFAULT_QUICK_WORKOUT_DOMAIN, subtype: DEFAULT_QUICK_WORKOUT_SUBTYPE };
}

// Stable check used by other parts of the codebase that want to special-case
// quick-log routines (e.g. UI labels, exclusion from pickers).
export function isQuickLogPlaceholderRoutine(routine: { isPlaceholder?: boolean | null } | null | undefined) {
  return Boolean(routine?.isPlaceholder);
}

// Re-export the domain type so consumers don't need to import RoutineDomain.
export type { RoutineDomain };
