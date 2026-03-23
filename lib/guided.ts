import type { GuidedStepKind } from "@/generated/prisma";

export type GuidedTemplateStep = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  sortOrder: number;
  exerciseId?: string | null;
  exerciseName?: string | null;
};

export type GuidedRunnerSegment = {
  id: string;
  guidedStepId: string;
  phase: "WORK" | "REST";
  stepKind: GuidedStepKind;
  stepLabel: string;
  segmentLabel: string;
  durationSec: number;
  stepIndex: number;
  roundIndex: number;
  roundCount: number;
  repIndex: number;
  repCount: number;
  setIndex: number;
  setCount: number;
  sortOrder: number;
};

export function clampGuidedRepeatCount(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value) return 1;
  return Math.max(1, Math.floor(value));
}

export function clampGuidedRepCount(step: Pick<GuidedTemplateStep, "repCount" | "repeatCount">) {
  return clampGuidedRepeatCount(step.repCount ?? step.repeatCount);
}

export function clampGuidedSetCount(step: Pick<GuidedTemplateStep, "setCount">) {
  return clampGuidedRepeatCount(step.setCount);
}

export function formatGuidedRepSetSummary(step: Pick<GuidedTemplateStep, "repCount" | "repeatCount" | "setCount">) {
  const reps = clampGuidedRepCount(step);
  const sets = clampGuidedSetCount(step);
  if (reps <= 1 && sets <= 1) return "";
  if (reps > 1 && sets > 1) return `${reps} reps x ${sets} sets`;
  if (reps > 1) return `${reps} reps`;
  return `${sets} sets`;
}

export function formatGuidedStepLabel(step: Pick<GuidedTemplateStep, "kind" | "title" | "exerciseName">) {
  if (step.kind === "EXERCISE" && step.exerciseName) return step.exerciseName;
  return step.title;
}

export function buildGuidedRunnerSegments(steps: GuidedTemplateStep[]) {
  const segments: GuidedRunnerSegment[] = [];

  steps.forEach((step, stepIndex) => {
    const stepLabel = formatGuidedStepLabel(step);
    const repCount = clampGuidedRepCount(step);
    const setCount = clampGuidedSetCount(step);
    const roundCount = repCount * setCount;
    const workDuration = step.durationSec ?? 0;
    const restDuration = step.restSec ?? 0;

    for (let setIndex = 0; setIndex < setCount; setIndex += 1) {
      for (let repIndex = 0; repIndex < repCount; repIndex += 1) {
        const roundIndex = setIndex * repCount + repIndex;
        const progressBits = [];
        if (setCount > 1) progressBits.push(`Set ${setIndex + 1} of ${setCount}`);
        if (repCount > 1) progressBits.push(`Rep ${repIndex + 1} of ${repCount}`);
        const progressLabel = progressBits.join(" | ");

        if (workDuration > 0) {
          segments.push({
            id: `${step.id}-work-${setIndex + 1}-${repIndex + 1}`,
            guidedStepId: step.id,
            phase: "WORK",
            stepKind: step.kind,
            stepLabel,
            segmentLabel: progressLabel ? `${stepLabel} | ${progressLabel}` : stepLabel,
            durationSec: workDuration,
            stepIndex,
            roundIndex,
            roundCount,
            repIndex,
            repCount,
            setIndex,
            setCount,
            sortOrder: segments.length,
          });
        }

        const isLastRound = setIndex === setCount - 1 && repIndex === repCount - 1;
        if (restDuration > 0 && !isLastRound) {
          segments.push({
            id: `${step.id}-rest-${setIndex + 1}-${repIndex + 1}`,
            guidedStepId: step.id,
            phase: "REST",
            stepKind: step.kind,
            stepLabel,
            segmentLabel: progressLabel ? `${stepLabel} | Rest after ${progressLabel}` : `${stepLabel} | Rest`,
            durationSec: restDuration,
            stepIndex,
            roundIndex,
            roundCount,
            repIndex,
            repCount,
            setIndex,
            setCount,
            sortOrder: segments.length,
          });
        }
      }
    }
  });

  return segments;
}

export function totalGuidedTemplateDuration(steps: GuidedTemplateStep[]) {
  return buildGuidedRunnerSegments(steps).reduce((sum, segment) => sum + segment.durationSec, 0);
}

export function formatGuidedSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return "0s";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
