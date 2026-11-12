// Eric's routine names encode a variant scheme the data model never had:
// "Push A" / "Push B" are successive revisions of one Push day, not two days.
// Log history proves they never overlap — a new letter always replaces the
// previous one. So the day is the name with its variant marker stripped, and
// the marker is a version, not a flavor.
const TRAILING_LETTER = /^(.*\S)\s+([A-Z])$/;
const TRAILING_PAREN = /^(.*\S)\s+\(([^()]+)\)$/;

export function routineDayKey(name: string) {
  const trimmed = name.trim();
  const letter = TRAILING_LETTER.exec(trimmed);
  if (letter && letter[1].length >= 2) return letter[1];
  const paren = TRAILING_PAREN.exec(trimmed);
  if (paren && paren[1].length >= 2) return paren[1];
  return trimmed;
}

export function routineVariantLabel(name: string) {
  const trimmed = name.trim();
  const letter = TRAILING_LETTER.exec(trimmed);
  if (letter && letter[1].length >= 2) return letter[2];
  const paren = TRAILING_PAREN.exec(trimmed);
  if (paren && paren[1].length >= 2) return paren[2];
  return null;
}

export const RETIRED_AFTER_DAYS = 90;
const NEVER_LOGGED_GRACE_DAYS = 30;

export function daysSince(at: Date | string | null, now: Date) {
  if (!at) return null;
  const then = typeof at === "string" ? new Date(at) : at;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

export function isRetiredRoutine(
  lastLoggedAt: Date | string | null,
  createdAt: Date | string,
  now: Date,
) {
  const sinceLog = daysSince(lastLoggedAt, now);
  if (sinceLog == null) return (daysSince(createdAt, now) ?? 0) > NEVER_LOGGED_GRACE_DAYS;
  return sinceLog > RETIRED_AFTER_DAYS;
}

export type RoutineSortKey = "recent" | "logged" | "name";

export const ROUTINE_SORT_OPTIONS: Array<{ value: RoutineSortKey; label: string }> = [
  { value: "recent", label: "Recent" },
  { value: "logged", label: "Most logged" },
  { value: "name", label: "A–Z" },
];
