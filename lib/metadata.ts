import type { MetadataGroupKind } from "@/generated/prisma";

export const METADATA_GROUP_KIND_LABELS: Record<MetadataGroupKind, string> = {
  MUSCLE_GROUP: "Muscle Groups",
  MOVEMENT_PATTERN: "Movement Patterns",
  TRAINING_GROUP: "Training Groups",
  CARDIO_ACTIVITY: "Cardio / Activity",
  ROUTINE_FOCUS: "Routine Focus",
};

export type MetadataSeedGroup = {
  slug: string;
  label: string;
  kind: MetadataGroupKind;
  appliesToRoutine: boolean;
  appliesToExercise: boolean;
  description?: string;
  parentSlugs?: string[];
};

export const METADATA_GROUP_SEEDS: MetadataSeedGroup[] = [
  { slug: "chest", label: "Chest", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "triceps", label: "Triceps", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "shoulders", label: "Shoulders", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "back", label: "Back", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "biceps", label: "Biceps", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "fingers", label: "Fingers", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "forearms", label: "Forearms", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "neck", label: "Neck", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["upper-body"] },
  { slug: "quads", label: "Quads", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hamstrings", label: "Hamstrings", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "glutes", label: "Glutes", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hip-flexors", label: "Hip Flexors", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "adductors", label: "Adductors", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "abductors", label: "Abductors", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "calves", label: "Calves", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "core", label: "Core", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["upper-body", "lower-body"] },

  { slug: "push", label: "Push", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["upper-body"] },
  { slug: "pull", label: "Pull", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["upper-body"] },
  { slug: "legs", label: "Legs", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["lower-body"] },
  { slug: "upper-body", label: "Upper Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "lower-body", label: "Lower Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "mobility", label: "Mobility", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },

  { slug: "squat", label: "Squat", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hinge", label: "Hinge", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "lunge", label: "Lunge", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "horizontal-push", label: "Horizontal Push", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "vertical-push", label: "Vertical Push", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "horizontal-pull", label: "Horizontal Pull", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "vertical-pull", label: "Vertical Pull", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "carry", label: "Carry", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "upper-body", "lower-body"] },
  { slug: "isometric", label: "Isometric", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "upper-body", "lower-body"] },
  { slug: "rotation", label: "Rotation", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core"] },
  { slug: "anti-extension", label: "Anti-Extension", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "isometric"] },
  { slug: "anti-rotation", label: "Anti-Rotation", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "isometric"] },
  { slug: "anti-lateral-flexion", label: "Anti-Lateral Flexion", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "isometric"] },

  { slug: "cardio", label: "All Cardio", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true },
  { slug: "run-walk", label: "Run + Walk", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "running", label: "Running", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["run-walk", "cardio"] },
  { slug: "walking", label: "Walking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["run-walk", "cardio"] },
  { slug: "biking", label: "Biking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "swimming", label: "Swimming", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "hiking", label: "Hiking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "rowing", label: "Rowing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "climbing", label: "Climbing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true },

  { slug: "strength", label: "Strength", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "hypertrophy", label: "Hypertrophy", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "rehab", label: "Rehab", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "skill-practice", label: "Skill Practice", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "recovery", label: "Recovery", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
];

export const ROUTINE_SUBTYPE_GROUP_DEFAULTS: Record<string, string[]> = {
  RUN: ["running"],
  WALK: ["walking"],
  BIKE: ["biking"],
  SWIM: ["swimming"],
  HIKE: ["hiking"],
  ROW: ["rowing"],
  MOBILITY: ["mobility"],
  STRETCHING: ["mobility"],
  WARMUP: ["mobility"],
  COOLDOWN: ["mobility", "recovery"],
  REHAB: ["rehab"],
  CLIMBING: ["climbing", "skill-practice"],
  SKILL_PRACTICE: ["skill-practice"],
  HIKE_DAY: ["hiking"],
  STRENGTH: ["strength"],
  HYPERTROPHY: ["hypertrophy"],
};

export function formatMetadataGroupKind(kind: MetadataGroupKind) {
  return METADATA_GROUP_KIND_LABELS[kind] ?? kind;
}

export function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseTagNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => normalizeTagName(entry))
        .filter((entry) => entry.length > 0)
    )
  );
}
