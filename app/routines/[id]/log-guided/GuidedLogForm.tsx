"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logGuided } from "../../actions";
import {
  buildGuidedRunnerSegments,
  formatGuidedRepSetSummary,
  formatGuidedSeconds,
  formatGuidedStepLabel,
  totalGuidedTemplateDuration,
  type GuidedTemplateStep,
} from "@/lib/guided";

type Step = GuidedTemplateStep;

export default function GuidedLogForm({
  routineId,
  steps,
}: {
  routineId: string;
  steps: Step[];
}) {
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [runMode, setRunMode] = useState<"MANUAL" | "CONTINUOUS">("MANUAL");
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const segments = useMemo(() => buildGuidedRunnerSegments(steps), [steps]);
  const [remainingSec, setRemainingSec] = useState(segments[0]?.durationSec ?? 0);
  const [isRunning, setIsRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exerciseWeights, setExerciseWeights] = useState<Record<string, string>>({});
  const defaultDurationSec = useMemo(() => totalGuidedTemplateDuration(steps), [steps]);

  const currentSegment = currentSegmentIndex < segments.length ? segments[currentSegmentIndex] : null;
  const completedDurationSec = useMemo(() => {
    if (segments.length === 0) return 0;
    const completed = segments
      .slice(0, Math.min(currentSegmentIndex, segments.length))
      .reduce((sum, segment) => sum + segment.durationSec, 0);
    if (!currentSegment) return completed;
    return completed + Math.max(0, currentSegment.durationSec - remainingSec);
  }, [currentSegment, currentSegmentIndex, remainingSec, segments]);
  const nextSegment = currentSegmentIndex + 1 < segments.length ? segments[currentSegmentIndex + 1] : null;

  useEffect(() => {
    const segment = currentSegmentIndex < segments.length ? segments[currentSegmentIndex] : null;
    if (!segment) {
      setIsRunning(false);
      return;
    }
    setRemainingSec(segment.durationSec);
  }, [currentSegmentIndex, segments]);

  useEffect(() => {
    if (!isRunning || !currentSegment) return;
    const timeout = window.setTimeout(() => {
      setRemainingSec((value) => {
        if (value > 1) return value - 1;

        const nextIndex = currentSegmentIndex + 1;
        if (nextIndex >= segments.length) {
          setCurrentSegmentIndex(segments.length);
          setIsRunning(false);
          return 0;
        }

        setCurrentSegmentIndex(nextIndex);
        setIsRunning(runMode === "CONTINUOUS");
        return segments[nextIndex].durationSec;
      });
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [currentSegment, currentSegmentIndex, isRunning, remainingSec, runMode, segments]);

  async function onSave() {
    setSaving(true);
    try {
      await logGuided({
        routineId,
        durationSec: completedDurationSec > 0 ? completedDurationSec : defaultDurationSec || null,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        steps: steps.map((step) => ({
          guidedStepId: step.id,
          kind: step.kind,
          title: step.title,
          exerciseId: step.exerciseId ?? null,
          durationSec: step.durationSec,
          restSec: step.restSec,
          repeatCount: step.repeatCount,
          repCount: step.repCount ?? step.repeatCount,
          setCount: step.setCount ?? 1,
          weightLb: step.kind === "EXERCISE" ? (exerciseWeights[step.id]?.trim() ? Number(exerciseWeights[step.id]) : null) : null,
          sortOrder: step.sortOrder,
        })),
      });
      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  function goToSegment(nextIndex: number) {
    if (segments.length === 0) return;
    const clamped = Math.max(0, Math.min(nextIndex, segments.length - 1));
    setCurrentSegmentIndex(clamped);
    setRemainingSec(segments[clamped].durationSec);
    setIsRunning(false);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <div style={modeCard}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>Playback</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" onClick={() => setRunMode("MANUAL")} style={{ ...modeBtn, ...(runMode === "MANUAL" ? modeBtnActive : null) }}>
            Manual start each step
          </button>
          <button type="button" onClick={() => setRunMode("CONTINUOUS")} style={{ ...modeBtn, ...(runMode === "CONTINUOUS" ? modeBtnActive : null) }}>
            Continuous auto-advance
          </button>
        </div>
        <div style={helpText}>
          Manual mode pauses when a step or rest finishes. Continuous mode rolls straight into the next segment. You can still pause any time.
        </div>
      </div>

      <div style={runnerCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Current timer</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>
              {segments.length === 0
                ? "No timed items yet."
                : currentSegment
                ? `Segment ${currentSegmentIndex + 1} of ${segments.length}`
                : "Flow complete"}
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>
            Completed {formatGuidedSeconds(completedDurationSec)} / {formatGuidedSeconds(defaultDurationSec)}
          </div>
        </div>

        <div style={timerFace}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.68 }}>
            {currentSegment ? currentSegment.phase : "DONE"}
          </div>
          <div style={timerValue}>
            {currentSegment ? formatGuidedSeconds(remainingSec) : "Finished"}
          </div>
          <div style={{ fontWeight: 900, textAlign: "center" }}>
            {currentSegment ? currentSegment.segmentLabel : "All template items completed"}
          </div>
          {currentSegment ? (
            <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
              {currentSegment.stepKind === "EXERCISE" ? "Exercise" : "Step"} | {currentSegment.stepLabel}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (!currentSegment && segments.length > 0) {
                goToSegment(0);
              }
              setIsRunning((value) => !value);
            }}
            disabled={segments.length === 0}
            style={actionBtn}
          >
            {isRunning ? "Pause" : currentSegment ? "Play" : "Restart"}
          </button>
          <button type="button" onClick={() => currentSegment && goToSegment(currentSegmentIndex + 1)} disabled={!currentSegment || currentSegmentIndex >= segments.length - 1} style={actionBtn}>
            Next
          </button>
          <button type="button" onClick={() => goToSegment(currentSegmentIndex - 1)} disabled={segments.length === 0 || currentSegmentIndex <= 0} style={actionBtn}>
            Previous
          </button>
          <button type="button" onClick={() => goToSegment(0)} disabled={segments.length === 0} style={actionBtn}>
            Reset
          </button>
        </div>

        {nextSegment ? (
          <div style={nextCard}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.68 }}>Next up</div>
            <div style={{ fontWeight: 800 }}>{nextSegment.segmentLabel}</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>{formatGuidedSeconds(nextSegment.durationSec)}</div>
          </div>
        ) : null}

        {currentSegment?.stepKind === "EXERCISE" ? (
          <div>
            <label style={styles.label}>Weight for this exercise item (lb, optional)</label>
            <input
              style={styles.input}
              inputMode="decimal"
              value={exerciseWeights[currentSegment.guidedStepId] ?? ""}
              onChange={(event) =>
                setExerciseWeights((current) => ({
                  ...current,
                  [currentSegment.guidedStepId]: event.target.value,
                }))
              }
              placeholder="25"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label style={styles.label}>Notes (optional)</label>
        <textarea style={{ ...styles.input, minHeight: 90 }} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <details style={styles.details}>
        <summary data-collapsible-summary style={styles.summary}>Log with custom date/time (optional)</summary>
        <div style={{ marginTop: 8 }}>
          <label style={styles.label}>Performed at</label>
          <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
        </div>
      </details>

      <div style={styles.templateCard}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>Template flow</div>
        {steps.length === 0 && <div style={{ marginTop: 8, opacity: 0.75 }}>No guided items are saved yet. You can still save a guided log with notes.</div>}
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {steps.map((step, index) => (
            <div key={step.id} style={styles.stepRow}>
              <div style={{ fontWeight: 800 }}>
                {index + 1}. {formatGuidedStepLabel(step)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {step.kind === "EXERCISE" ? "Exercise" : "Step"} | {formatGuidedSeconds(step.durationSec)} work
                {step.restSec ? ` | ${formatGuidedSeconds(step.restSec)} rest` : ""}
                {formatGuidedRepSetSummary(step) ? ` | ${formatGuidedRepSetSummary(step)}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Guided Log"}
        </button>
        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
      </div>
    </div>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 10,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  linkBtn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
    textDecoration: "none",
  },
  details: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(128,128,128,0.06)",
  },
  summary: {
    cursor: "pointer",
    fontWeight: 800 as const,
    fontSize: 13,
  },
  templateCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
  stepRow: {
    border: "1px solid rgba(128,128,128,0.24)",
    borderRadius: 10,
    padding: 8,
    background: "rgba(128,128,128,0.05)",
  },
};

const modeCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.05)",
};

const modeBtn: React.CSSProperties = {
  padding: "9px 12px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(128,128,128,0.4)",
  borderRadius: 999,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
};

const modeBtnActive: React.CSSProperties = {
  borderColor: "rgba(84,203,130,0.72)",
  background: "rgba(84,203,130,0.14)",
};

const runnerCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 16,
  padding: 14,
  background: "linear-gradient(180deg, rgba(34,197,94,0.08), rgba(17,24,39,0.2))",
  display: "grid",
  gap: 12,
};

const timerFace: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.26)",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 8,
  placeItems: "center",
  background: "rgba(0,0,0,0.18)",
};

const timerValue: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1,
};

const actionBtn: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(128,128,128,0.7)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
};

const nextCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(255,255,255,0.04)",
};

const helpText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.72,
};
