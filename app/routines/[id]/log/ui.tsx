"use client";

import { createWorkoutExerciseOption, logWorkout } from "../../actions";
import InlinePainCheck, { type PainCheckZone } from "@/app/components/log/InlinePainCheck";
import type { PainContext } from "@/generated/prisma";
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
  defaultPerformedAtLocal,
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
  defaultPerformedAtLocal?: string;
}) {
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });
  const [painLevels, setPainLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(activePainZones.map((zone) => [zone.slug, 0])),
  );
  const [painContext, setPainContext] = useState<PainContext>("AFTER_ACTIVITY");

  return (
    <WorkoutExerciseEditor
      routineId={routineId}
      routineName={routineName}
      draftEnabled
      initialNotes=""
      initialPerformedAt={defaultPerformedAtLocal ?? ""}
      initialBlocks={initialBlocks}
      availableExercises={availableExercises}
      initialExpandedId={initialExpandedId}
      onExpandedIdChange={onExpandedIdChange}
      saveLabel="Save Workout"
      savingLabel="Saving…"
      backHref="/routines"
      onBack={onBack}
      createExerciseOption={createWorkoutExerciseOption}
      bottomSlot={
        activePainZones.length > 0 ? (
          <InlinePainCheck
            zones={activePainZones}
            levels={painLevels}
            onLevelsChange={setPainLevels}
            context={painContext}
            onContextChange={setPainContext}
          />
        ) : null
      }
      onSave={async (payload) => {
        await logWorkout({
          routineId,
          notes: payload.notes,
          performedAtLocal: payload.performedAtLocal || undefined,
          exercises: payload.exercises,
          painCheck:
            activePainZones.length > 0
              ? {
                  context: painContext,
                  rows: activePainZones.map((zone) => ({
                    zoneSlug: zone.slug,
                    level: painLevels[zone.slug] ?? 0,
                  })),
                }
              : undefined,
        });
        finish();
      }}
    />
  );
}
