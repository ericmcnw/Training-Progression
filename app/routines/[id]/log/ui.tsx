"use client";

import { logWorkout } from "../../actions";
import WorkoutExerciseEditor, {
  type ExerciseOption,
  type WorkoutBlock,
} from "./WorkoutExerciseEditor";

export default function LogWorkoutForm({
  routineId,
  initialBlocks,
  availableExercises,
}: {
  routineId: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
}) {
  return (
    <WorkoutExerciseEditor
      initialNotes=""
      initialPerformedAt=""
      initialBlocks={initialBlocks}
      availableExercises={availableExercises}
      saveLabel="Save Workout"
      savingLabel="Saving..."
      backHref="/routines"
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
