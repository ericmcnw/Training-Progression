"use client";

import { updateWorkoutLog } from "../../../actions";
import WorkoutExerciseEditor, {
  type ExerciseOption,
  type WorkoutBlock,
} from "../WorkoutExerciseEditor";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default function EditWorkoutLogForm({
  routineId,
  logId,
  returnTo,
  initialNotes,
  initialPerformedAt,
  initialExercises,
  availableExercises,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialNotes: string;
  initialPerformedAt: Date;
  initialExercises: WorkoutBlock[];
  availableExercises: ExerciseOption[];
}) {
  return (
    <WorkoutExerciseEditor
      routineId={routineId}
      initialNotes={initialNotes}
      initialPerformedAt={toLocalInputValue(initialPerformedAt)}
      initialBlocks={initialExercises}
      availableExercises={availableExercises}
      saveLabel="Save Changes"
      savingLabel="Saving..."
      backHref={returnTo}
      onSave={async (payload) => {
        await updateWorkoutLog({
          routineId,
          logId,
          notes: payload.notes,
          performedAtLocal: payload.performedAtLocal || undefined,
          exercises: payload.exercises,
        });
        window.location.href = returnTo;
      }}
    />
  );
}
