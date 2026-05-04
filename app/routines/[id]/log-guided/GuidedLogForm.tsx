"use client";

import { useMemo, useState } from "react";
import type { ExerciseLibraryKind, GuidedStepKind } from "@/generated/prisma";
import type { PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import PostSessionPainCheck from "@/app/components/pain-log/PostSessionPainCheck";
import { logGuided } from "../../actions";
import GuidedEntryScreen from "./GuidedEntryScreen";
import GuidedPlayer from "./GuidedPlayer";
import GuidedReviewForm from "./GuidedReviewForm";
import type { ReviewSaveData } from "./GuidedReviewForm";

type Step = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  sortOrder: number;
};

type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  libraryKind: ExerciseLibraryKind;
};

type Screen = "entry" | "player" | "review";

function toLocalInputValue(date: Date) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function GuidedLogForm({
  routineId,
  routineName,
  steps,
  availableExercises: _availableExercises,
  activePainZones = [],
  onComplete,
  onBack,
}: {
  routineId: string;
  routineName?: string;
  steps: Step[];
  availableExercises: ExerciseOption[];
  activePainZones?: PainCheckZone[];
  onComplete?: () => void;
  onBack?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("entry");
  const [autoPlay, setAutoPlay] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  // Data flowing from player → review
  const [skippedStepIds, setSkippedStepIds] = useState<Set<string>>(new Set());
  const [completedDurationSec, setCompletedDurationSec] = useState(0);
  const [reviewMode, setReviewMode] = useState<"review" | "log-after">("log-after");

  const [saving, setSaving] = useState(false);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });

  const templateSteps = useMemo(
    () =>
      steps.map((step) => ({
        id: step.id,
        kind: step.kind,
        title: step.title,
        exerciseId: step.exerciseId,
        exerciseName: step.exerciseName,
        durationSec: step.durationSec,
        restSec: step.restSec,
        repeatCount: step.repeatCount,
        repCount: step.repCount,
        setCount: step.setCount,
        sortOrder: step.sortOrder,
      })),
    [steps]
  );

  function startPlayer() {
    setSessionStartedAt(new Date());
    setScreen("player");
  }

  function startLogAfter() {
    setSkippedStepIds(new Set());
    setCompletedDurationSec(0);
    setReviewMode("log-after");
    setScreen("review");
  }

  function onPlayerDone(result: { skippedStepIds: Set<string>; completedDurationSec: number }) {
    setSkippedStepIds(result.skippedStepIds);
    setCompletedDurationSec(result.completedDurationSec);
    setReviewMode("review");
    setScreen("review");
  }

  async function onSave({ reviewMap, notes, performedAtLocal, durationOverrideMin }: ReviewSaveData) {
    const parsedDurationMin = durationOverrideMin.trim() ? Number(durationOverrideMin) : null;
    if (
      parsedDurationMin !== null &&
      (!Number.isFinite(parsedDurationMin) || parsedDurationMin <= 0)
    ) {
      alert("Enter a valid duration in minutes or leave it blank.");
      return;
    }

    const completedSteps = steps.filter((step) => !reviewMap.get(step.id)?.skipped);

    const stepsPayload = completedSteps.map((step, idx) => {
      const review = reviewMap.get(step.id) ?? { skipped: false, weightLb: "" };
      const weightLbRaw = review.weightLb.trim();
      const weightLb =
        step.kind === "EXERCISE" && weightLbRaw
          ? Number.isFinite(Number(weightLbRaw))
            ? Number(weightLbRaw)
            : null
          : null;
      const repeatCount = step.repeatCount ?? 1;
      return {
        guidedStepId: step.id,
        kind: step.kind,
        title: step.kind === "EXERCISE" ? (step.exerciseName ?? step.title) : step.title,
        exerciseId: step.kind === "EXERCISE" ? step.exerciseId : null,
        durationSec: step.durationSec,
        restSec: step.restSec,
        repeatCount,
        repCount: step.repCount ?? repeatCount,
        setCount: step.setCount ?? 1,
        weightLb,
        sortOrder: idx,
      };
    });

    const durationSec =
      parsedDurationMin !== null
        ? Math.round(parsedDurationMin * 60)
        : completedDurationSec > 0
        ? completedDurationSec
        : null;

    setSaving(true);
    try {
      const createdLogId = await logGuided({
        routineId,
        durationSec,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        steps: stepsPayload,
      });
      if (createdLogId && activePainZones.length > 0) {
        setPainCheckLogId(createdLogId);
        return;
      }
      finish();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save guided session.");
    } finally {
      setSaving(false);
    }
  }

  if (painCheckLogId) {
    return (
      <PostSessionPainCheck
        zones={activePainZones}
        routineLogId={painCheckLogId}
        onDone={finish}
      />
    );
  }

  const name = routineName ?? "Guided Routine";

  if (screen === "entry") {
    return (
      <GuidedEntryScreen
        routineName={name}
        steps={templateSteps}
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        onGuideMe={startPlayer}
        onLogAfter={startLogAfter}
        backHref="/routines"
        onBack={onBack}
      />
    );
  }

  if (screen === "player") {
    return (
      <GuidedPlayer
        steps={templateSteps}
        autoPlay={autoPlay}
        onDone={onPlayerDone}
        onBack={() => setScreen("entry")}
      />
    );
  }

  // review screen
  const initialPerformedAt =
    reviewMode === "review" && sessionStartedAt
      ? toLocalInputValue(sessionStartedAt)
      : undefined;

  return (
    <GuidedReviewForm
      steps={templateSteps}
      initialSkippedStepIds={skippedStepIds}
      initialPerformedAtLocal={initialPerformedAt}
      completedDurationSec={completedDurationSec}
      mode={reviewMode}
      saving={saving}
      onSave={onSave}
      onBack={() => setScreen(reviewMode === "review" ? "player" : "entry")}
    />
  );
}
