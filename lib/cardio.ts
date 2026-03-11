export const CARDIO_TYPE_OPTIONS = [
  "Run",
  "Bike",
  "Swim",
  "Walk",
  "Row",
  "Hike",
] as const;

export function normalizeCardioType(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
