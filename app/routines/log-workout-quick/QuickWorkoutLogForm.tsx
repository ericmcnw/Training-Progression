"use client";

import { logAdHocWorkout, createWorkoutLogExerciseOption } from "../actions";
import WorkoutExerciseEditor, {
  type ExerciseOption,
  type WorkoutBlock,
} from "../[id]/log/WorkoutExerciseEditor";

export default function QuickWorkoutLogForm({
  routineId,
  availableExercises,
  initialBlocks,
}: {
  routineId: string;
  availableExercises: ExerciseOption[];
  initialBlocks: WorkoutBlock[];
}) {
  return (
    <WorkoutExerciseEditor
      routineId={routineId}
      initialNotes=""
      initialPerformedAt=""
      initialBlocks={initialBlocks}
      availableExercises={availableExercises}
      saveLabel="Save Quick Workout"
      savingLabel="Saving..."
      backHref="/routines"
      addExerciseTitle="Add Exercise To This Log"
      addExerciseHelp="This quick log does not change the routine template. Add only what you want to record today."
      createExerciseHelp="Creating here saves the exercise in your library and adds it to this log only."
      emptyStateHelp="Add one or more exercises above to build a one-off workout log."
      createExerciseOption={createWorkoutLogExerciseOption}
      onSave={async (payload) => {
        await logAdHocWorkout({
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
