import type { RoutineKind } from "@/generated/prisma";

export type RoutinePresetKey =
  | "HABIT"
  | "STRENGTH_WORKOUT"
  | "CARDIO_SESSION"
  | "GUIDED_FLOW"
  | "OPEN_SESSION"
  | "CUSTOM";

export type RoutinePreset = {
  key: RoutinePresetKey;
  label: string;
  description: string;
  kind: RoutineKind;
  subtype: string | null;
  categoryHint: string;
};

export const ROUTINE_PRESETS: RoutinePreset[] = [
  {
    key: "HABIT",
    label: "Habit / Check-in",
    description: "Simple done-or-not-done tracking for habits, recovery work, and daily actions.",
    kind: "COMPLETION",
    subtype: "HABIT",
    categoryHint: "Daily",
  },
  {
    key: "STRENGTH_WORKOUT",
    label: "Strength Workout",
    description: "Exercise templates with sets, reps, weight, or time for lifting and gym sessions.",
    kind: "WORKOUT",
    subtype: "STRENGTH",
    categoryHint: "Strength",
  },
  {
    key: "CARDIO_SESSION",
    label: "Cardio Session",
    description: "Distance and duration tracking for running, walking, biking, swimming, and similar work.",
    kind: "CARDIO",
    subtype: "RUN",
    categoryHint: "Running",
  },
  {
    key: "GUIDED_FLOW",
    label: "Guided Flow",
    description: "Timed or step-based flows like mobility, warmup, cooldown, stretching, or rehab.",
    kind: "GUIDED",
    subtype: "MOBILITY",
    categoryHint: "Mobility",
  },
  {
    key: "OPEN_SESSION",
    label: "Sports Session",
    description: "Broad sessions like climbing, sports, hiking days, and skill practice.",
    kind: "SESSION",
    subtype: "SKILL_PRACTICE",
    categoryHint: "General",
  },
  {
    key: "CUSTOM",
    label: "Custom",
    description: "Full control over routine type and subtype if none of the presets fit cleanly.",
    kind: "COMPLETION",
    subtype: null,
    categoryHint: "General",
  },
];

export function getRoutinePreset(key: string | null | undefined) {
  return ROUTINE_PRESETS.find((preset) => preset.key === key) ?? ROUTINE_PRESETS[0];
}

export function inferRoutinePreset(kind: string | null | undefined, subtype: string | null | undefined): RoutinePresetKey {
  if (kind === "WORKOUT") return "STRENGTH_WORKOUT";
  if (kind === "CARDIO") return "CARDIO_SESSION";
  if (kind === "GUIDED") return "GUIDED_FLOW";
  if (kind === "SESSION") return "OPEN_SESSION";

  const normalizedSubtype = String(subtype ?? "").trim().toUpperCase();
  if (normalizedSubtype === "HABIT" || normalizedSubtype === "HEALTH" || normalizedSubtype === "RECOVERY") {
    return "HABIT";
  }

  return "CUSTOM";
}
