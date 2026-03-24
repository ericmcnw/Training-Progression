export type ExerciseUnitValue = "REPS" | "TIME";

function stripDiacritics(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeExerciseName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function canonicalizeExerciseName(value: string) {
  return stripDiacritics(normalizeExerciseName(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function condensedExerciseName(value: string) {
  return canonicalizeExerciseName(value).replace(/\s+/g, "");
}

export function exerciseNamesMatch(left: string, right: string) {
  const leftCanonical = canonicalizeExerciseName(left);
  const rightCanonical = canonicalizeExerciseName(right);
  if (!leftCanonical || !rightCanonical) return false;
  return leftCanonical === rightCanonical;
}

export function exerciseMatchesQuery(name: string, query: string) {
  const canonicalName = canonicalizeExerciseName(name);
  const canonicalQuery = canonicalizeExerciseName(query);
  if (!canonicalQuery) return true;
  if (!canonicalName) return false;
  if (canonicalName.includes(canonicalQuery)) return true;

  const condensedName = condensedExerciseName(name);
  const condensedQuery = condensedExerciseName(query);
  if (condensedQuery && condensedName.includes(condensedQuery)) return true;

  const nameTokens = canonicalName.split(" ");
  const queryTokens = canonicalQuery.split(" ");
  return queryTokens.every((queryToken) => nameTokens.some((nameToken) => nameToken.startsWith(queryToken)));
}

export function findExerciseNameMatch<T extends { name: string }>(items: T[], incomingName: string) {
  return items.find((item) => exerciseNamesMatch(item.name, incomingName)) ?? null;
}

export function compareExerciseNames(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function exerciseUnitLabel(unit: ExerciseUnitValue) {
  return unit === "TIME" ? "Timed" : "Rep-based";
}

export function exerciseUnitFieldLabel(unit: ExerciseUnitValue) {
  return unit === "TIME" ? "Time (sec)" : "Reps";
}

export function exerciseUnitDescription(unit: ExerciseUnitValue) {
  return unit === "TIME"
    ? "Best for hangs, planks, carries, holds, and other duration-based work."
    : "Best for lifts, bodyweight reps, and movements you count by repetitions.";
}
