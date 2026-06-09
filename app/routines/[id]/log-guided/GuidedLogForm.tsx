"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseLibraryKind, GuidedStepKind, PainContext } from "@/generated/prisma";
import InlinePainCheck, { type PainCheckZone } from "@/app/components/log/InlinePainCheck";
import { logGuided } from "../../actions";
import GuidedEntryScreen from "./GuidedEntryScreen";
import GuidedPlayer from "./GuidedPlayer";
import GuidedReviewForm from "./GuidedReviewForm";
import type { ReviewSaveData } from "./GuidedReviewForm";
import { useOptionalLogDraft } from "@/app/contexts/LogDraftContext";
import {
  type GuidedDraft,
  clearDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "@/lib/log-draft";
import { localDateTimeNow } from "../log/form-ui";

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
type GuidedDrawerState = {
  screen: Screen;
  autoPlay: boolean;
  currentSegmentIndex: number;
  completedDurationSec: number;
  skippedStepIds: string[];
  reviewMode: "review" | "log-after";
};

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
  initialDrawerState,
  onDrawerStateChange,
  onComplete,
  onBack,
  defaultPerformedAtLocal,
}: {
  routineId: string;
  routineName?: string;
  steps: Step[];
  availableExercises: ExerciseOption[];
  activePainZones?: PainCheckZone[];
  initialDrawerState?: GuidedDrawerState | null;
  onDrawerStateChange?: (state: GuidedDrawerState) => void;
  onComplete?: () => void;
  onBack?: () => void;
  defaultPerformedAtLocal?: string;
}) {
  const draftCtx = useOptionalLogDraft();
  // Restore from localStorage takes priority over the in-memory drawerState
  // — needed for refresh-survival across page loads.
  const restoredDraft = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = loadDraftFromStorage(routineId);
    return stored && stored.kind === "GUIDED" ? stored : null;
  }, [routineId]);

  const [screen, setScreen] = useState<Screen>(restoredDraft?.screen ?? initialDrawerState?.screen ?? "entry");
  const [autoPlay, setAutoPlay] = useState(restoredDraft?.autoPlay ?? initialDrawerState?.autoPlay ?? true);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  // Data flowing from player → review
  const [skippedStepIds, setSkippedStepIds] = useState<Set<string>>(
    new Set(restoredDraft?.skippedStepIds ?? initialDrawerState?.skippedStepIds ?? [])
  );
  const [completedDurationSec, setCompletedDurationSec] = useState(
    restoredDraft?.completedDurationSec ?? initialDrawerState?.completedDurationSec ?? 0
  );
  const [reviewMode, setReviewMode] = useState<"review" | "log-after">(
    restoredDraft?.reviewMode ?? initialDrawerState?.reviewMode ?? "log-after"
  );
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(
    restoredDraft?.currentSegmentIndex ?? initialDrawerState?.currentSegmentIndex ?? 0
  );

  const [saving, setSaving] = useState(false);
  const [painLevels, setPainLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(activePainZones.map((zone) => [zone.slug, 0])),
  );
  const [painContext, setPainContext] = useState<PainContext>("AFTER_ACTIVITY");
  const finish = onComplete ?? (() => { window.location.href = "/log"; });

  const draftStartedAtRef = useRef<string>(restoredDraft?.startedAt ?? new Date().toISOString());
  const isDirtyRef = useRef(restoredDraft !== null);

  // Hydrate the draft context with the restored draft so the chip strip
  // shows it on first paint of the page (not after the first edit).
  useEffect(() => {
    if (restoredDraft) draftCtx?.saveDraft(restoredDraft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave guided progression to localStorage so a refresh resumes the
  // user mid-session and the chip strip stays accurate. Uses a 600ms
  // debounce to avoid hammering storage during scrub.
  useEffect(() => {
    if (!isDirtyRef.current && screen === "entry") return;
    const draft: GuidedDraft = {
      kind: "GUIDED",
      routineId,
      routineName: routineName ?? "Guided Routine",
      startedAt: draftStartedAtRef.current,
      notes: "",
      performedAtLocal: defaultPerformedAtLocal ?? localDateTimeNow(),
      screen,
      autoPlay,
      currentSegmentIndex,
      completedDurationSec,
      skippedStepIds: Array.from(skippedStepIds),
      reviewMode,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      draftCtx?.saveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, autoPlay, currentSegmentIndex, completedDurationSec, skippedStepIds, reviewMode]);

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

  useEffect(() => {
    onDrawerStateChange?.({
      screen,
      autoPlay,
      currentSegmentIndex,
      completedDurationSec,
      skippedStepIds: Array.from(skippedStepIds),
      reviewMode,
    });
  }, [autoPlay, completedDurationSec, currentSegmentIndex, onDrawerStateChange, reviewMode, screen, skippedStepIds]);

  function startPlayer() {
    isDirtyRef.current = true;
    setSessionStartedAt(new Date());
    setScreen("player");
  }

  function startLogAfter() {
    isDirtyRef.current = true;
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
      await logGuided({
        routineId,
        durationSec,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        steps: stepsPayload,
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
      clearDraftFromStorage(routineId);
      draftCtx?.clearDraft(routineId);
      finish();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save guided session.");
    } finally {
      setSaving(false);
    }
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
        backHref="/log"
        onBack={onBack}
      />
    );
  }

  if (screen === "player") {
    return (
      <GuidedPlayer
        steps={templateSteps}
        autoPlay={autoPlay}
        initialCurrentSegmentIndex={currentSegmentIndex}
        initialSkippedStepIds={Array.from(skippedStepIds)}
        initialCompletedDurationSec={completedDurationSec}
        onStateChange={({ currentSegmentIndex, skippedStepIds, completedDurationSec }) => {
          setCurrentSegmentIndex(currentSegmentIndex);
          setSkippedStepIds(new Set(skippedStepIds));
          setCompletedDurationSec(completedDurationSec);
        }}
        onDone={onPlayerDone}
        onBack={() => setScreen("entry")}
      />
    );
  }

  // review screen — back-date param wins when present (user is logging
  // for a past day), otherwise fall back to the live session start time.
  const initialPerformedAt =
    defaultPerformedAtLocal ??
    (reviewMode === "review" && sessionStartedAt
      ? toLocalInputValue(sessionStartedAt)
      : undefined);

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
    />
  );
}
