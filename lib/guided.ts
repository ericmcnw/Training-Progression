import type { GuidedStepKind } from "@/generated/prisma";

export type GuidedTemplateStep = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
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
  sortOrder: number;
};

export function clampGuidedRepeatCount(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value) return 1;
  return Math.max(1, Math.floor(value));
}

export function formatGuidedStepLabel(step: Pick<GuidedTemplateStep, "kind" | "title" | "exerciseName">) {
  if (step.kind === "EXERCISE" && step.exerciseName) return step.exerciseName;
  return step.title;
}

export function buildGuidedRunnerSegments(steps: GuidedTemplateStep[]) {
  const segments: GuidedRunnerSegment[] = [];

  steps.forEach((step, stepIndex) => {
    const stepLabel = formatGuidedStepLabel(step);
    const roundCount = clampGuidedRepeatCount(step.repeatCount);
    const workDuration = step.durationSec ?? 0;
    const restDuration = step.restSec ?? 0;

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      if (workDuration > 0) {
        segments.push({
          id: `${step.id}-work-${roundIndex + 1}`,
          guidedStepId: step.id,
          phase: "WORK",
          stepKind: step.kind,
          stepLabel,
          segmentLabel: roundCount > 1 ? `${stepLabel} • Set ${roundIndex + 1} of ${roundCount}` : stepLabel,
          durationSec: workDuration,
          stepIndex,
          roundIndex,
          roundCount,
          sortOrder: segments.length,
        });
      }

      const shouldAddRest = restDuration > 0 && (roundCount > 1 ? roundIndex < roundCount - 1 : true);
      if (shouldAddRest) {
        segments.push({
          id: `${step.id}-rest-${roundIndex + 1}`,
          guidedStepId: step.id,
          phase: "REST",
          stepKind: step.kind,
          stepLabel,
          segmentLabel: roundCount > 1 ? `${stepLabel} • Rest after set ${roundIndex + 1}` : `${stepLabel} • Rest`,
          durationSec: restDuration,
          stepIndex,
          roundIndex,
          roundCount,
          sortOrder: segments.length,
        });
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
