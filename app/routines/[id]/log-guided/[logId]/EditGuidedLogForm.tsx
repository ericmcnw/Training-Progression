"use client";

import GuidedSessionEditor from "../GuidedSessionEditor";
import type { ExerciseLibraryKind, GuidedStepKind } from "@/generated/prisma";

type Step = {
  guidedStepId: string | null;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  weightLb?: number | null;
  sortOrder: number;
};

type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  libraryKind: ExerciseLibraryKind;
};

export default function EditGuidedLogForm({
  routineId,
  logId,
  returnTo,
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
  steps,
  availableExercises,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  steps: Step[];
  availableExercises: ExerciseOption[];
}) {
  return (
    <GuidedSessionEditor
      routineId={routineId}
      logId={logId}
      backHref={returnTo}
      saveLabel="Save Changes"
      savePendingLabel="Saving..."
      initialDurationSec={initialDurationSec}
      initialNotes={initialNotes}
      initialPerformedAt={initialPerformedAt}
      availableExercises={availableExercises}
      initialSteps={steps}
    />
  );
}
