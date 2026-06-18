"use client";

import { createWorkoutExerciseOption, updateWorkoutLog } from "../../../actions";
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
  initialEffort = null,
  initialExercises,
  availableExercises,
  onComplete,
  onCancel,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialNotes: string;
  initialPerformedAt: Date;
  initialEffort?: number | null;
  initialExercises: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  return (
    <WorkoutExerciseEditor
      routineId={routineId}
      initialNotes={initialNotes}
      initialPerformedAt={toLocalInputValue(initialPerformedAt)}
      initialEffort={initialEffort}
      initialBlocks={initialExercises}
      availableExercises={availableExercises}
      saveLabel="Save Changes"
      savingLabel="Saving..."
      backHref={returnTo}
      onBack={onCancel}
      createExerciseOption={createWorkoutExerciseOption}
      onSave={async (payload) => {
        await updateWorkoutLog({
          routineId,
          logId,
          notes: payload.notes,
          performedAtLocal: payload.performedAtLocal || undefined,
          exercises: payload.exercises,
          effort: payload.effort,
        });
        if (onComplete) onComplete();
        else window.location.href = returnTo;
      }}
    />
  );
}
