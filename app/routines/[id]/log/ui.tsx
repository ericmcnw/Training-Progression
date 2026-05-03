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
  routineName,
  initialBlocks,
  availableExercises,
  smartDefaultLabel,
  activePainZones = [],
  onComplete,
  onBack,
}: {
  routineId: string;
  routineName: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  smartDefaultLabel?: string | null;
  activePainZones?: PainCheckZone[];
  onComplete?: () => void;
  onBack?: () => void;
}) {
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });

  if (painCheckLogId) {
    return <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={finish} />;
  }

  return (
    <WorkoutExerciseEditor
      routineId={routineId}
      routineName={routineName}
      draftEnabled
      initialNotes=""
      initialPerformedAt=""
      initialBlocks={initialBlocks}
      availableExercises={availableExercises}
      smartDefaultLabel={smartDefaultLabel}
      saveLabel="Save Workout"
      savingLabel="Saving..."
      backHref="/routines"
      onBack={onBack}
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
        finish();
      }}
    />
  );
}
