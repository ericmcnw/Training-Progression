"use client";

import { createWorkoutExerciseOption, logWorkout } from "../../actions";
import WorkoutExerciseEditor, {
  type ExerciseOption,
  type WorkoutBlock,
} from "./WorkoutExerciseEditor";

export default function LogWorkoutForm({
  routineId,
  initialBlocks,
  availableExercises,
  smartDefaultLabel,
}: {
  routineId: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  smartDefaultLabel?: string | null;
}) {
  return (
    <WorkoutExerciseEditor
      routineId={routineId}
      initialNotes=""
      initialPerformedAt=""
      initialBlocks={initialBlocks}
      availableExercises={availableExercises}
      smartDefaultLabel={smartDefaultLabel}
      saveLabel="Save Workout"
      savingLabel="Saving..."
      backHref="/routines"
      createExerciseOption={createWorkoutExerciseOption}
      onSave={async (payload) => {
        await logWorkout({
          routineId,
          notes: payload.notes,
          performedAtLocal: payload.performedAtLocal || undefined,
          exercises: payload.exercises,
        });
        window.location.href = "/routines";
      }}
    />
  );
}
