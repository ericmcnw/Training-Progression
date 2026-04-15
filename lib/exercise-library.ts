import type { ExerciseLibraryKind, Prisma } from "@/generated/prisma";

export const EXERCISE_LIBRARY_KIND_LABELS: Record<ExerciseLibraryKind, string> = {
  STRENGTH: "Strength",
  CONDITIONING: "Conditioning",
  MOBILITY: "Mobility",
  STRETCH: "Stretch",
  BREATHWORK: "Breathwork",
  SKILL: "Skill",
};

const STRETCH_NAME_PATTERN = /\b(stretch|pose|fold|opener|breathing|breath|inhale|exhale|child'?s pose|downward dog|pigeon|figure four|butterfly)\b/i;
const MOBILITY_NAME_PATTERN = /\b(mobility|warmup|warm-up|cooldown|cool-down|rehab|prehab|therapy|glide|rotation)\b/i;
const CONDITIONING_NAME_PATTERN = /\b(run|running|walk|walking|bike|biking|swim|swimming|row|rowing|cardio|hike|hiking)\b/i;
const SKILL_NAME_PATTERN = /\b(climb|climbing|hangboard|fingerboard|hang|carry|handstand|lock-off|support hold)\b/i;

export function deriveExerciseLibraryKind(params: {
  name: string;
  metadataSlugs?: string[];
  unit?: "REPS" | "TIME";
}): ExerciseLibraryKind {
  const normalizedName = params.name.trim().toLowerCase();
  const metadata = new Set((params.metadataSlugs ?? []).map((slug) => slug.trim().toLowerCase()).filter(Boolean));

  if (metadata.has("breathwork") || /\b(breath|breathing|inhale|exhale)\b/i.test(normalizedName)) {
    return "BREATHWORK";
  }

  if (
    STRETCH_NAME_PATTERN.test(normalizedName) ||
    (metadata.has("mobility") && (
      metadata.has("hinge") ||
      metadata.has("rotation") ||
      metadata.has("quads") ||
      metadata.has("hamstrings") ||
      metadata.has("calves") ||
      metadata.has("hip-flexors") ||
      metadata.has("adductors") ||
      metadata.has("abductors") ||
      metadata.has("glutes") ||
      metadata.has("shoulders") ||
      metadata.has("recovery")
    ))
  ) {
    return "STRETCH";
  }

  if (metadata.has("mobility") || metadata.has("rehab") || MOBILITY_NAME_PATTERN.test(normalizedName)) {
    return "MOBILITY";
  }

  if (
    metadata.has("cardio") ||
    metadata.has("running") ||
    metadata.has("walking") ||
    metadata.has("biking") ||
    metadata.has("swimming") ||
    metadata.has("rowing") ||
    metadata.has("hiking") ||
    metadata.has("endurance") ||
    CONDITIONING_NAME_PATTERN.test(normalizedName)
  ) {
    return "CONDITIONING";
  }

  if (metadata.has("skill-practice") || metadata.has("climbing") || SKILL_NAME_PATTERN.test(normalizedName)) {
    return "SKILL";
  }

  if (params.unit === "TIME" && metadata.has("isometric")) {
    return "SKILL";
  }

  return "STRENGTH";
}

export function workoutLibraryKinds(): ExerciseLibraryKind[] {
  return ["STRENGTH", "CONDITIONING", "SKILL", "MOBILITY", "STRETCH"];
}

export function guidedPreferredLibraryKinds(): ExerciseLibraryKind[] {
  return ["STRETCH", "MOBILITY", "BREATHWORK", "SKILL", "CONDITIONING", "STRENGTH"];
}

export function guidedStepLibraryKinds(): ExerciseLibraryKind[] {
  return ["STRETCH", "MOBILITY", "BREATHWORK"];
}

export function orderExercisesForLibraryContext<T extends { libraryKind: ExerciseLibraryKind; name: string }>(
  exercises: T[],
  preferredKinds: ExerciseLibraryKind[]
) {
  const order = new Map(preferredKinds.map((kind, index) => [kind, index]));
  return [...exercises].sort((left, right) => {
    const leftRank = order.get(left.libraryKind) ?? preferredKinds.length;
    const rightRank = order.get(right.libraryKind) ?? preferredKinds.length;
    return leftRank - rightRank || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

export function exerciseLibraryWhereForKinds(kinds: ExerciseLibraryKind[]): Prisma.ExerciseWhereInput {
  return { libraryKind: { in: kinds } };
}

export function isMissingExerciseLibraryKindError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string; meta?: Record<string, unknown> };
  const metaText = JSON.stringify(maybeError.meta ?? {});
  const message = maybeError.message ?? "";
  return (
    maybeError.code === "P2022" &&
    (message.includes("libraryKind") || metaText.includes("libraryKind") || metaText.includes("Exercise.libraryKind"))
  );
}

export function withDerivedExerciseLibraryKind<T extends { name: string; unit: "REPS" | "TIME"; libraryKind?: ExerciseLibraryKind | null }>(
  exercises: T[]
) {
  return exercises.map((exercise) => ({
    ...exercise,
    libraryKind: exercise.libraryKind ?? deriveExerciseLibraryKind({ name: exercise.name, unit: exercise.unit }),
  }));
}
