"use client";

import { useEffect, useMemo, useState } from "react";
import { buildGuidedRunnerSegments, formatGuidedSeconds } from "@/lib/guided";
import type { GuidedTemplateStep } from "@/lib/guided";

type PlayerStep = GuidedTemplateStep;

export default function GuidedPlayer({
  steps,
  autoPlay,
  onDone,
  onBack,
}: {
  steps: PlayerStep[];
  autoPlay: boolean;
  onDone: (result: { skippedStepIds: Set<string>; completedDurationSec: number }) => void;
  onBack: () => void;
}) {
  const allSegments = useMemo(() => buildGuidedRunnerSegments(steps), [steps]);

  const [skippedStepIds, setSkippedStepIds] = useState<Set<string>>(new Set());
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [completedDurationSec, setCompletedDurationSec] = useState(0);

  const effectiveSegments = useMemo(
    () => allSegments.filter((s) => !skippedStepIds.has(s.guidedStepId)),
    [allSegments, skippedStepIds]
  );

  const isDone =
    effectiveSegments.length > 0 && currentSegmentIndex >= effectiveSegments.length;
  const currentSegment =
    !isDone && currentSegmentIndex < effectiveSegments.length
      ? effectiveSegments[currentSegmentIndex]
      : null;
  const nextSegment =
    currentSegment && currentSegmentIndex + 1 < effectiveSegments.length
      ? effectiveSegments[currentSegmentIndex + 1]
      : null;

  // Reset remainingSec when segment changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentSegment) setRemainingSec(currentSegment.durationSec);
  }, [currentSegment?.id]);

  // Countdown timer — runs in both auto-play and manual mode
  useEffect(() => {
    if (!isRunning || !currentSegment) return;
    const timeout = window.setTimeout(() => {
      if (remainingSec > 1) {
        setRemainingSec((v) => v - 1);
        return;
      }
      // Segment finished
      if (autoPlay) {
        const dur = currentSegment.durationSec;
        const nextIndex = currentSegmentIndex + 1;
        setCompletedDurationSec((v) => v + dur);
        setCurrentSegmentIndex(nextIndex);
        setRemainingSec(0);
        if (nextIndex >= effectiveSegments.length) setIsRunning(false);
      } else {
        // Manual: stop at 0, wait for user to press Next
        setIsRunning(false);
        setRemainingSec(0);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [isRunning, autoPlay, remainingSec, currentSegment, currentSegmentIndex, effectiveSegments]);

  function goToNext() {
    if (!currentSegment) return;
    setCompletedDurationSec((v) => v + currentSegment.durationSec);
    setIsRunning(false);
    setCurrentSegmentIndex((v) => v + 1);
  }

  function goToPrev() {
    if (currentSegmentIndex <= 0) return;
    const prevDur = effectiveSegments[currentSegmentIndex - 1]?.durationSec ?? 0;
    setCompletedDurationSec((v) => Math.max(0, v - prevDur));
    setIsRunning(false);
    setCurrentSegmentIndex((v) => Math.max(0, v - 1));
  }

  function skipCurrentStep() {
    if (!currentSegment) return;
    const stepId = currentSegment.guidedStepId;
    const stepIndex = currentSegment.stepIndex;
    const newSkipped = new Set([...skippedStepIds, stepId]);
    const newEffective = allSegments.filter((s) => !newSkipped.has(s.guidedStepId));
    const nextStepSeg = allSegments.find(
      (s) => s.stepIndex > stepIndex && !newSkipped.has(s.guidedStepId)
    );
    const newIdx = nextStepSeg
      ? newEffective.findIndex((s) => s.id === nextStepSeg.id)
      : newEffective.length;
    setSkippedStepIds(newSkipped);
    setCurrentSegmentIndex(newIdx >= 0 ? newIdx : newEffective.length);
    setIsRunning(false);
  }

  function handleFinish() {
    setIsRunning(false);
    onDone({ skippedStepIds, completedDurationSec });
  }

  const totalSteps = steps.length;
  const currentStepNumber = currentSegment ? currentSegment.stepIndex + 1 : totalSteps;
  const progressPct =
    totalSteps > 0
      ? Math.min(1, (currentSegment ? currentSegment.stepIndex : totalSteps) / totalSteps)
      : 0;

  const phase = currentSegment?.phase ?? "WORK";
  const isWork = phase === "WORK";
  const phaseColor = isWork ? "#4ade80" : "#60a5fa";
  const phaseBg = isWork ? "rgba(34,197,94,0.07)" : "rgba(59,130,246,0.07)";
  const phaseBorder = isWork ? "rgba(34,197,94,0.22)" : "rgba(59,130,246,0.22)";

  const noTimedSteps = effectiveSegments.length === 0;

  // Done screen
  if (isDone) {
    return (
      <div
        style={{
          display: "grid",
          gap: 20,
          textAlign: "center",
          padding: "48px 20px",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: 64, lineHeight: 1 }}>✓</div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>Session Complete!</div>
        {completedDurationSec > 0 && (
          <div style={{ fontSize: 14, opacity: 0.65 }}>
            Duration: {formatGuidedSeconds(completedDurationSec)}
          </div>
        )}
        <button type="button" onClick={handleFinish} style={bigGreenBtn}>
          Review &amp; Save
        </button>
      </div>
    );
  }

  // No segments — steps have no durations configured
  if (noTimedSteps) {
    return (
      <div
        style={{
          display: "grid",
          gap: 16,
          padding: "32px 20px",
          textAlign: "center",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800 }}>No timed steps in this routine.</div>
        <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.6 }}>
          Add durations to your steps in the template editor to use the guided timer. You can still
          log the session below.
        </div>
        <button type="button" onClick={handleFinish} style={ghostActionBtn}>
          Continue to Review
        </button>
        <button
          type="button"
          onClick={onBack}
          style={{ ...ghostActionBtn, background: "transparent", border: "none", opacity: 0.6 }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 480, margin: "0 auto" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "2px 0",
        }}
      >
        <button type="button" onClick={onBack} style={topBarBtn}>
          ← Back
        </button>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.65 }}>
          Step {currentStepNumber} of {totalSteps}
        </div>
        <button type="button" onClick={handleFinish} style={topBarBtn}>
          Finish
        </button>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: "rgba(128,128,128,0.15)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPct * 100}%`,
            background: phaseColor,
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Main display panel */}
      <div
        style={{
          border: `1px solid ${phaseBorder}`,
          borderRadius: 22,
          padding: "28px 20px 24px",
          background: phaseBg,
          display: "grid",
          gap: 14,
        }}
      >
        {/* Phase label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 2,
            color: phaseColor,
            textTransform: "uppercase",
          }}
        >
          {phase}
        </div>

        {/* Step name */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            lineHeight: 1.25,
          }}
        >
          {currentSegment?.stepLabel ?? ""}
        </div>

        {/* Timer */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1,
            color: phaseColor,
            letterSpacing: -3,
            fontVariantNumeric: "tabular-nums",
            opacity: !autoPlay && !isRunning && remainingSec === currentSegment?.durationSec ? 0.45 : 1,
          }}
        >
          {formatGuidedSeconds(remainingSec)}
        </div>
        {!autoPlay && !isRunning && remainingSec === currentSegment?.durationSec && (
          <div style={{ fontSize: 11, opacity: 0.5, letterSpacing: 0.5 }}>target duration · press Start when ready</div>
        )}

        {/* Set / rep context */}
        {currentSegment &&
          (currentSegment.setCount > 1 || currentSegment.repCount > 1) && (
            <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.78 }}>
              {currentSegment.setCount > 1
                ? `Set ${currentSegment.setIndex + 1} of ${currentSegment.setCount}`
                : ""}
              {currentSegment.setCount > 1 && currentSegment.repCount > 1 ? "  ·  " : ""}
              {currentSegment.repCount > 1
                ? `Rep ${currentSegment.repIndex + 1} of ${currentSegment.repCount}`
                : ""}
            </div>
          )}

        {/* Segment count */}
        <div style={{ fontSize: 11, opacity: 0.45 }}>
          Segment {currentSegmentIndex + 1} of {effectiveSegments.length}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "grid", gap: 10 }}>
        {/* Prev / Play / Next row */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={goToPrev}
            disabled={currentSegmentIndex <= 0}
            style={navBtn(false, currentSegmentIndex <= 0)}
          >
            ←
          </button>

          {/* Start / Pause — both modes */}
          <button
            type="button"
            onClick={() => setIsRunning((v) => !v)}
            style={{ ...navBtn(true), flex: 2 }}
          >
            {isRunning ? "Pause" : remainingSec === 0 ? "Done" : currentSegmentIndex === 0 && !isRunning ? "Start" : "Resume"}
          </button>

          {/* Next — auto-play shows arrow, manual shows label */}
          <button
            type="button"
            onClick={goToNext}
            disabled={currentSegmentIndex >= effectiveSegments.length - 1}
            style={navBtn(false, currentSegmentIndex >= effectiveSegments.length - 1)}
          >
            →
          </button>
        </div>

        {/* Skip step */}
        <button type="button" onClick={skipCurrentStep} style={skipStepBtn}>
          Skip Step
        </button>
      </div>

      {/* Up Next */}
      {nextSegment && nextSegment.guidedStepId !== currentSegment?.guidedStepId ? (
        <div
          style={{
            padding: "14px 16px",
            border: "1px solid rgba(128,128,128,0.18)",
            borderRadius: 14,
            background: "rgba(128,128,128,0.04)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              opacity: 0.5,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            Up Next
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 5 }}>
            {nextSegment.stepLabel}
          </div>
          {nextSegment.durationSec > 0 && (
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>
              {nextSegment.phase} · {formatGuidedSeconds(nextSegment.durationSec)}
            </div>
          )}
        </div>
      ) : nextSegment ? (
        <div
          style={{
            padding: "10px 16px",
            border: "1px solid rgba(128,128,128,0.14)",
            borderRadius: 14,
            background: "rgba(128,128,128,0.03)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              opacity: 0.45,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            Up Next
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, opacity: 0.75 }}>
            {nextSegment.phase === "REST" ? "Rest" : nextSegment.segmentLabel}
            {nextSegment.durationSec > 0
              ? ` · ${formatGuidedSeconds(nextSegment.durationSec)}`
              : ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Styles

const bigGreenBtn: React.CSSProperties = {
  padding: "15px 20px",
  border: "none",
  borderRadius: 14,
  background: "rgba(34,197,94,0.88)",
  color: "#000",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const ghostActionBtn: React.CSSProperties = {
  padding: "12px 16px",
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const topBarBtn: React.CSSProperties = {
  padding: "7px 12px",
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.07)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

function navBtn(primary: boolean, disabled = false): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 56,
    padding: "10px 14px",
    border: primary
      ? "1px solid rgba(34,197,94,0.45)"
      : "1px solid rgba(128,128,128,0.3)",
    borderRadius: 14,
    background: primary
      ? "rgba(34,197,94,0.12)"
      : "rgba(128,128,128,0.07)",
    color: "inherit",
    fontWeight: 900,
    fontSize: primary ? 16 : 20,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.3 : 1,
  };
}

const skipStepBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "10px 14px",
  border: "1px solid rgba(255,80,80,0.3)",
  borderRadius: 14,
  background: "rgba(255,80,80,0.06)",
  color: "rgba(255,120,120,1)",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};
