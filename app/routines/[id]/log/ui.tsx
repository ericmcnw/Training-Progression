"use client";

import { createWorkoutExerciseOption, logWorkout } from "../../actions";
import PostSessionPainCheck, { type PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import { useState } from "react";
import WorkoutExerciseEditor, {
  type ExerciseOption,
  type WorkoutBlock,
} from "./WorkoutExerciseEditor";

export default function LogWorkoutForm({
  routineId,
  initialBlocks,
  availableExercises,
  smartDefaultLabel,
  activePainZones = [],
}: {
  routineId: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  smartDefaultLabel?: string | null;
  activePainZones?: PainCheckZone[];
}) {
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);

  if (painCheckLogId) {
    return <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={() => { window.location.href = "/routines"; }} />;
  }

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
        const logId = await logWorkout({
          routineId,
          notes: payload.notes,
          performedAtLocal: payload.performedAtLocal || undefined,
          exercises: payload.exercises,
        });
        if (logId && activePainZones.length > 0) {
          setPainCheckLogId(logId);
          return;
        }
        window.location.href = "/routines";
      }}
    />
  );
}
