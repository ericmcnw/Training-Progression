"use client";

import GuidedSessionEditor from "./GuidedSessionEditor";
import type { ExerciseLibraryKind, GuidedStepKind } from "@/generated/prisma";

type Step = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  sortOrder: number;
};

type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  libraryKind: ExerciseLibraryKind;
};

export default function GuidedLogForm({
  routineId,
  steps,
  availableExercises,
}: {
  routineId: string;
  steps: Step[];
  availableExercises: ExerciseOption[];
}) {
  return (
    <GuidedSessionEditor
      routineId={routineId}
      backHref="/routines"
      saveLabel="Save Guided Log"
      savePendingLabel="Saving..."
      availableExercises={availableExercises}
      initialSteps={steps.map((step) => ({
        guidedStepId: step.id,
        kind: step.kind,
        title: step.title,
        exerciseId: step.exerciseId,
        exerciseName: step.exerciseName,
        durationSec: step.durationSec,
        restSec: step.restSec,
        repeatCount: step.repeatCount,
        repCount: step.repCount,
        setCount: step.setCount,
        sortOrder: step.sortOrder,
      }))}
    />
  );
}
