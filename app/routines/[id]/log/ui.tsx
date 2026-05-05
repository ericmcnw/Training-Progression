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
  activePainZones = [],
  initialExpandedId,
  onExpandedIdChange,
  onComplete,
  onBack,
}: {
  routineId: string;
  routineName: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  activePainZones?: PainCheckZone[];
  initialExpandedId?: string | null;
  onExpandedIdChange?: (expandedId: string | null) => void;
  onComplete?: () => void;
  onBack?: () => void;
}) {
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });

  if (painCheckLogId) {
    return (
      <div className="painCheckEnter">
        <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={finish} />
      </div>
    );
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
      initialExpandedId={initialExpandedId}
      onExpandedIdChange={onExpandedIdChange}
      saveLabel="Save Workout"
      savingLabel="Saving…"
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
