"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { logGuided, updateGuidedLog } from "../../actions";
import { EXERCISE_LIBRARY_KIND_LABELS, guidedPreferredLibraryKinds, orderExercisesForLibraryContext } from "@/lib/exercise-library";
import { buildGuidedRunnerSegments, formatGuidedRepSetSummary, formatGuidedSeconds, formatGuidedStepLabel } from "@/lib/guided";
import type { ExerciseLibraryKind, GuidedStepKind } from "@/generated/prisma";
import { Field, FieldGrid, FormActions, FormSection, FormStack, OptionalDateSection, helperTextStyle, inputStyle, pillButtonStyle, textareaStyle } from "../log/form-ui";
import PostSessionPainCheck, { type PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";

type ExerciseOption = { id: string; name: string; unit: "REPS" | "TIME"; supportsWeight: boolean; libraryKind: ExerciseLibraryKind };
type InitialStep = {
  guidedStepId: string | null;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  weightLb?: number | null;
  sortOrder: number;
};
type DraftMode = "FOLLOW" | "START_STOP" | "LOG_AFTER";
type FollowScope = "SET" | "ROUTINE";
type DraftStep = {
  id: string;
  guidedStepId: string | null;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string;
  durationSec: string;
  restSec: string;
  repeatCount: string;
  repCount: string;
  setCount: string;
  weightLb: string;
  includeInLog: boolean;
};

const card: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(128,128,128,0.22)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(128,128,128,0.05)",
};
const pillRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const pillBaseStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(128,128,128,0.7)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
};
const primaryPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  fontWeight: 900,
  borderColor: "rgba(89,154,255,0.72)",
  background: "rgba(68,126,217,0.22)",
};
const dangerPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  borderColor: "rgba(255,80,80,0.55)",
  color: "#ffd0d0",
};

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createDraftId() {
  return `guided-draft-${Math.random().toString(36).slice(2, 10)}`;
}

function toPositiveInt(value: string, fallback = 1) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.floor(parsed)) : fallback;
}

function toOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftFromStep(step: InitialStep): DraftStep {
  return {
    id: createDraftId(),
    guidedStepId: step.guidedStepId,
    kind: step.kind,
    title: step.kind === "EXERCISE" && step.exerciseName === step.title ? "" : step.title,
    exerciseId: step.exerciseId ?? "",
    durationSec: step.durationSec ? String(step.durationSec) : "",
    restSec: step.restSec ? String(step.restSec) : "",
    repeatCount: step.repeatCount > 1 ? String(step.repeatCount) : "",
    repCount: (step.repCount ?? step.repeatCount) > 1 ? String(step.repCount ?? step.repeatCount) : "",
    setCount: (step.setCount ?? 1) > 1 ? String(step.setCount ?? 1) : "",
    weightLb: step.weightLb !== null && step.weightLb !== undefined ? String(step.weightLb) : "",
    includeInLog: true,
  };
}

function createBlankStep(kind: GuidedStepKind): DraftStep {
  return { id: createDraftId(), guidedStepId: null, kind, title: "", exerciseId: "", durationSec: "", restSec: "", repeatCount: "", repCount: "", setCount: "", weightLb: "", includeInLog: true };
}

function stepExerciseName(step: DraftStep, exerciseById: Map<string, ExerciseOption>) {
  return step.exerciseId ? exerciseById.get(step.exerciseId)?.name ?? null : null;
}

function stepLabel(step: DraftStep, exerciseById: Map<string, ExerciseOption>) {
  return formatGuidedStepLabel({ kind: step.kind, title: step.title.trim() || stepExerciseName(step, exerciseById) || "Untitled step", exerciseName: stepExerciseName(step, exerciseById) });
}

function stepSummary(step: DraftStep) {
  const repeatCount = toPositiveInt(step.repeatCount || step.repCount, 1);
  const repCount = toPositiveInt(step.repCount || step.repeatCount, 1);
  const setCount = toPositiveInt(step.setCount, 1);
  const parts: string[] = [];
  const work = toOptionalInt(step.durationSec);
  const rest = toOptionalInt(step.restSec);
  const weight = toOptionalNumber(step.weightLb);
  if (work) parts.push(`${formatGuidedSeconds(work)} work`);
  if (rest) parts.push(`${formatGuidedSeconds(rest)} rest`);
  const repSet = formatGuidedRepSetSummary({ repeatCount, repCount, setCount });
  if (repSet) parts.push(repSet);
  if (weight !== null) parts.push(`${weight} lb`);
  return parts.join(" | ") || "No timing or targets set";
}

function payloadStep(step: DraftStep, index: number, exerciseById: Map<string, ExerciseOption>) {
  const exerciseName = stepExerciseName(step, exerciseById);
  const title = step.kind === "EXERCISE" ? exerciseName ?? step.title.trim() : step.title.trim();
  if (step.kind === "EXERCISE" && !step.exerciseId) throw new Error("Each exercise item needs an exercise.");
  if (step.kind === "STEP" && !title) throw new Error("Each step item needs a title.");
  const repeatCount = toPositiveInt(step.repeatCount || step.repCount, 1);
  return {
    guidedStepId: step.guidedStepId,
    kind: step.kind,
    title,
    exerciseId: step.kind === "EXERCISE" ? step.exerciseId || null : null,
    durationSec: toOptionalInt(step.durationSec),
    restSec: toOptionalInt(step.restSec),
    repeatCount,
    repCount: toPositiveInt(step.repCount || step.repeatCount, repeatCount),
    setCount: toPositiveInt(step.setCount, 1),
    weightLb: step.kind === "EXERCISE" ? toOptionalNumber(step.weightLb) : null,
    sortOrder: index,
  };
}

export default function GuidedSessionEditor({
  routineId, backHref, saveLabel, savePendingLabel, initialSteps, availableExercises, initialDurationSec = 0, initialNotes = "", initialPerformedAt, logId, activePainZones = [],
}: {
  routineId: string;
  backHref: string;
  saveLabel: string;
  savePendingLabel: string;
  initialSteps: InitialStep[];
  availableExercises: ExerciseOption[];
  initialDurationSec?: number;
  initialNotes?: string;
  initialPerformedAt?: Date;
  logId?: string;
  activePainZones?: PainCheckZone[];
}) {
  const orderedExercises = useMemo(() => orderExercisesForLibraryContext(availableExercises, guidedPreferredLibraryKinds()), [availableExercises]);
  const exerciseById = useMemo(() => new Map(orderedExercises.map((exercise) => [exercise.id, exercise])), [orderedExercises]);
  const baseDraftSteps = useMemo(() => initialSteps.map(draftFromStep), [initialSteps]);
  const [mode, setMode] = useState<DraftMode>(logId ? "LOG_AFTER" : "FOLLOW");
  const [followScope, setFollowScope] = useState<FollowScope>("SET");
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>(baseDraftSteps);
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(initialPerformedAt ? toLocalInputValue(initialPerformedAt) : "");
  const [durationOverrideMin, setDurationOverrideMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);

  const activeDraftSteps = useMemo(() => draftSteps.filter((step) => step.includeInLog), [draftSteps]);
  const runnerSteps = useMemo(() => activeDraftSteps.map((step, index) => ({
    id: step.id,
    kind: step.kind,
    title: step.kind === "EXERCISE" ? ((stepExerciseName(step, exerciseById) ?? step.title.trim()) || "Exercise") : step.title.trim() || "Step",
    durationSec: toOptionalInt(step.durationSec),
    restSec: toOptionalInt(step.restSec),
    repeatCount: toPositiveInt(step.repeatCount || step.repCount, 1),
    repCount: toPositiveInt(step.repCount || step.repeatCount, 1),
    setCount: toPositiveInt(step.setCount, 1),
    sortOrder: index,
    exerciseId: step.kind === "EXERCISE" ? step.exerciseId || null : null,
    exerciseName: stepExerciseName(step, exerciseById),
  })), [activeDraftSteps, exerciseById]);
  const segments = useMemo(() => buildGuidedRunnerSegments(runnerSteps), [runnerSteps]);
  const currentSegment = currentSegmentIndex < segments.length ? segments[currentSegmentIndex] : null;
  const nextSegment = currentSegmentIndex + 1 < segments.length ? segments[currentSegmentIndex + 1] : null;
  const completedDurationSec = useMemo(() => {
    const done = segments.slice(0, Math.min(currentSegmentIndex, segments.length)).reduce((sum, segment) => sum + segment.durationSec, 0);
    return currentSegment ? done + Math.max(0, currentSegment.durationSec - remainingSec) : done;
  }, [currentSegment, currentSegmentIndex, remainingSec, segments]);
  const estimatedDurationSec = useMemo(() => segments.reduce((sum, segment) => sum + segment.durationSec, 0), [segments]);

  useEffect(() => {
    if (segments.length === 0) {
      setCurrentSegmentIndex(0);
      setRemainingSec(0);
      setIsRunning(false);
      return;
    }
    if (currentSegmentIndex >= segments.length) {
      setRemainingSec(0);
      setIsRunning(false);
      return;
    }
    const segment = segments[currentSegmentIndex];
    setRemainingSec((value) => (value > 0 && value <= segment.durationSec ? value : segment.durationSec));
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
        const nextSegment = segments[nextIndex];
        const sameSet =
          nextSegment.guidedStepId === currentSegment.guidedStepId &&
          nextSegment.setIndex === currentSegment.setIndex;
        const shouldAutoContinue =
          mode === "START_STOP" ? false : followScope === "ROUTINE" ? true : sameSet;
        setCurrentSegmentIndex(nextIndex);
        setIsRunning(shouldAutoContinue);
        return segments[nextIndex].durationSec;
      });
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [currentSegment, currentSegmentIndex, followScope, isRunning, mode, remainingSec, segments]);

  function updateStep(stepId: string, updater: (step: DraftStep) => DraftStep) {
    setDraftSteps((current) => current.map((step) => (step.id === stepId ? updater(step) : step)));
  }

  function moveStep(stepId: string, offset: -1 | 1) {
    setDraftSteps((current) => {
      const index = current.findIndex((step) => step.id === stepId);
      const swapIndex = index + offset;
      if (index < 0 || swapIndex < 0 || swapIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
    setIsRunning(false);
  }

  async function onSave() {
    const parsedDurationMin = durationOverrideMin.trim() ? Number(durationOverrideMin) : null;
    if (parsedDurationMin !== null && (!Number.isFinite(parsedDurationMin) || parsedDurationMin <= 0)) {
      alert("Enter a valid duration override in minutes or leave it blank.");
      return;
    }
    const steps = draftSteps.filter((step) => step.includeInLog).map((step, index) => payloadStep(step, index, exerciseById));
    const durationSec = parsedDurationMin !== null ? Math.round(parsedDurationMin * 60) : completedDurationSec > 0 ? completedDurationSec : estimatedDurationSec > 0 ? estimatedDurationSec : null;
    setSaving(true);
    try {
      if (logId) {
        await updateGuidedLog({ routineId, logId, durationSec, notes, performedAtLocal: performedAtLocal || undefined, steps });
      } else {
        const createdLogId = await logGuided({ routineId, durationSec, notes, performedAtLocal: performedAtLocal || undefined, steps });
        if (createdLogId && activePainZones.length > 0) {
          setPainCheckLogId(createdLogId);
          return;
        }
      }
      window.location.href = backHref;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save guided session.");
    } finally {
      setSaving(false);
    }
  }

  if (painCheckLogId) {
    return <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={() => { window.location.href = backHref; }} />;
  }

  return (
    <FormStack maxWidth={920}>
      <FormSection title="Guided session" description="Run the flow live, edit it while you go, or log what actually happened after the fact.">
        <div style={pillRow}>
          {["FOLLOW", "START_STOP", "LOG_AFTER"].map((value) => (
            <button key={value} type="button" onClick={() => setMode(value as DraftMode)} style={{ ...pillBaseStyle, borderRadius: 999, ...(mode === value ? { borderColor: "rgba(84,203,130,0.72)", background: "rgba(84,203,130,0.16)" } : null) }}>{value === "LOG_AFTER" ? "Log After" : value === "START_STOP" ? "Start/Stop" : "Follow"}</button>
          ))}
        </div>
        {mode === "FOLLOW" ? (
          <div style={pillRow}>
            <span style={helperTextStyle}>Play behavior:</span>
            <button type="button" onClick={() => setFollowScope("SET")} style={{ ...pillBaseStyle, borderRadius: 999, ...(followScope === "SET" ? { borderColor: "rgba(89,154,255,0.72)", background: "rgba(68,126,217,0.18)" } : null) }}>
              Run Current Set
            </button>
            <button type="button" onClick={() => setFollowScope("ROUTINE")} style={{ ...pillBaseStyle, borderRadius: 999, ...(followScope === "ROUTINE" ? { borderColor: "rgba(89,154,255,0.72)", background: "rgba(68,126,217,0.18)" } : null) }}>
              Run Entire Routine
            </button>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div style={card}><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.68 }}>Included items</div><div style={{ fontSize: 26, fontWeight: 900 }}>{activeDraftSteps.length}</div><div style={helperTextStyle}>{draftSteps.length - activeDraftSteps.length > 0 ? `${draftSteps.length - activeDraftSteps.length} excluded from this log.` : "All rows save into the log."}</div></div>
          <div style={card}><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.68 }}>Estimated duration</div><div style={{ fontSize: 26, fontWeight: 900 }}>{formatGuidedSeconds(estimatedDurationSec)}</div><div style={helperTextStyle}>Updates as you change the queue.</div></div>
          <div style={card}><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.68 }}>Timer progress</div><div style={{ fontSize: 26, fontWeight: 900 }}>{formatGuidedSeconds(completedDurationSec)}</div><div style={helperTextStyle}>Manual logging still works without using the timer.</div></div>
        </div>
        <div style={pillRow}>
          <button type="button" onClick={() => { setDraftSteps(baseDraftSteps); setCurrentSegmentIndex(0); setRemainingSec(0); setIsRunning(false); }} style={pillButtonStyle}>Reset Draft</button>
          <button type="button" onClick={() => { setDraftSteps([]); setMode("LOG_AFTER"); setCurrentSegmentIndex(0); setRemainingSec(0); setIsRunning(false); }} style={pillButtonStyle}>Start Blank</button>
          <button type="button" onClick={() => { setDraftSteps((current) => [...current, createBlankStep("STEP")]); setMode("LOG_AFTER"); }} style={pillButtonStyle}>Add Step</button>
          <button type="button" onClick={() => { setDraftSteps((current) => [...current, createBlankStep("EXERCISE")]); setMode("LOG_AFTER"); }} style={pillButtonStyle}>Add Exercise</button>
        </div>
      </FormSection>
      {mode !== "LOG_AFTER" ? (
        <FormSection title="Runner" description={mode === "FOLLOW" ? "Use follow mode when you want the flow to keep moving for the current set or the full routine." : "Use start/stop when you want to trigger each timer manually."}>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)" }}>
            <div style={{ ...card, display: "grid", gap: 12, alignContent: "start", background: "linear-gradient(180deg, rgba(46,64,116,0.16), rgba(17,24,39,0.44))" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.68 }}>{currentSegment ? currentSegment.phase : "Done"}</div>
                <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1 }}>{currentSegment ? formatGuidedSeconds(remainingSec) : "Finished"}</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{currentSegment ? currentSegment.segmentLabel : "No active segment"}</div>
                <div style={helperTextStyle}>{currentSegment ? `${currentSegmentIndex + 1} of ${segments.length}` : segments.length > 0 ? "All timed segments completed." : "Add durations to use the timer."}</div>
              </div>
              <div style={pillRow}>
                <button type="button" onClick={() => { if (!currentSegment && segments.length > 0) { setCurrentSegmentIndex(0); setRemainingSec(segments[0].durationSec); } setIsRunning((value) => !value); }} disabled={segments.length === 0} style={primaryPillStyle}>{isRunning ? "Pause" : currentSegment ? "Play" : "Start"}</button>
                <button type="button" onClick={() => { if (!currentSegment || currentSegmentIndex >= segments.length - 1) return; setCurrentSegmentIndex(currentSegmentIndex + 1); setRemainingSec(segments[currentSegmentIndex + 1].durationSec); setIsRunning(false); }} disabled={!currentSegment || currentSegmentIndex >= segments.length - 1} style={pillButtonStyle}>Next</button>
                <button type="button" onClick={() => { if (segments.length === 0 || currentSegmentIndex <= 0) return; setCurrentSegmentIndex(currentSegmentIndex - 1); setRemainingSec(segments[currentSegmentIndex - 1].durationSec); setIsRunning(false); }} disabled={segments.length === 0 || currentSegmentIndex <= 0} style={pillButtonStyle}>Previous</button>
              </div>
              {nextSegment ? <div style={{ ...card, padding: 12, background: "rgba(0,0,0,0.18)" }}><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.68 }}>Up next</div><div style={{ fontWeight: 900 }}>{nextSegment.segmentLabel}</div><div style={helperTextStyle}>{formatGuidedSeconds(nextSegment.durationSec)}</div></div> : null}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.68 }}>Routine steps</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{mode === "FOLLOW" ? "Keep the runner simple and only expand a step when you need to change it." : "Use play, then manually move to the next timer when you are ready."}</div>
                </div>
                <div style={helperTextStyle}>Step details stay hidden until you press edit.</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {draftSteps.length === 0 ? <div style={{ ...card, borderStyle: "dashed", opacity: 0.78 }}>No items in this draft yet.</div> : null}
                {draftSteps.map((step, index) => {
                  const isCurrent = currentSegment?.guidedStepId === step.id;
                  const exercise = step.exerciseId ? exerciseById.get(step.exerciseId) ?? null : null;
                  const isExpanded = expandedStepId === step.id;
                  return (
                    <div key={step.id} style={{ ...card, ...(isCurrent ? { borderColor: "rgba(84,203,130,0.58)", background: "rgba(84,203,130,0.08)" } : null), ...(step.includeInLog ? null : { opacity: 0.72, background: "rgba(128,128,128,0.03)" }) }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={pillRow}>
                            <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>#{index + 1}</span>
                            <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(76,163,255,0.28)", background: "rgba(76,163,255,0.12)", fontSize: 12, fontWeight: 800 }}>{step.kind === "EXERCISE" ? "Exercise" : "Step"}</span>
                            {isCurrent ? <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(84,203,130,0.45)", background: "rgba(84,203,130,0.14)", fontSize: 12, fontWeight: 800 }}>Now</span> : null}
                            {!step.includeInLog ? <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(128,128,128,0.26)", background: "rgba(128,128,128,0.08)", fontSize: 12, fontWeight: 800 }}>Excluded</span> : null}
                          </div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{stepLabel(step, exerciseById)}</div>
                        <div style={helperTextStyle}>{stepSummary(step)}</div>
                        {step.kind === "EXERCISE" ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={helperTextStyle}>Weight</span>
                            <input
                              style={{ ...inputStyle, width: 96, padding: "8px 10px" }}
                              inputMode="decimal"
                              value={step.weightLb}
                              onChange={(event) => updateStep(step.id, (current) => ({ ...current, weightLb: event.target.value }))}
                              placeholder="lb"
                            />
                          </div>
                        ) : null}
                        </div>

                        <div style={pillRow}>
                          <button type="button" onClick={() => { const nextIndex = segments.findIndex((segment) => segment.guidedStepId === step.id); if (nextIndex >= 0) { setCurrentSegmentIndex(nextIndex); setRemainingSec(segments[nextIndex].durationSec); setIsRunning(false); } }} disabled={segments.every((segment) => segment.guidedStepId !== step.id)} style={pillButtonStyle}>Jump</button>
                          <button type="button" onClick={() => setExpandedStepId((current) => current === step.id ? null : step.id)} style={pillButtonStyle}>{isExpanded ? "Done Editing" : "Edit"}</button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div style={{ marginTop: 12 }}>
                          <FieldGrid minWidth={160}>
                            <Field label="Save in log">
                              <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                                <input type="checkbox" checked={step.includeInLog} onChange={(event) => updateStep(step.id, (current) => ({ ...current, includeInLog: event.target.checked }))} />
                                <span>{step.includeInLog ? "Included" : "Excluded"}</span>
                              </label>
                            </Field>
                            <Field label="Item type">
                              <select style={inputStyle} value={step.kind} onChange={(event) => updateStep(step.id, (current) => ({ ...current, kind: event.target.value as GuidedStepKind, exerciseId: event.target.value === "EXERCISE" ? current.exerciseId : "" }))}>
                                <option value="STEP">Step</option>
                                <option value="EXERCISE">Exercise</option>
                              </select>
                            </Field>
                            {step.kind === "EXERCISE" ? (
                              <Field label="Exercise">
                                <select style={inputStyle} value={step.exerciseId} onChange={(event) => updateStep(step.id, (current) => ({ ...current, exerciseId: event.target.value }))}>
                                  <option value="">Select exercise</option>
                                  {orderedExercises.map((option) => <option key={option.id} value={option.id}>{option.name} ({EXERCISE_LIBRARY_KIND_LABELS[option.libraryKind]})</option>)}
                                </select>
                              </Field>
                            ) : null}
                            <Field label={step.kind === "EXERCISE" ? "Display title" : "Step title"} hint={step.kind === "EXERCISE" && exercise ? `Defaults to ${exercise.name}` : undefined}>
                              <input style={inputStyle} value={step.title} onChange={(event) => updateStep(step.id, (current) => ({ ...current, title: event.target.value }))} placeholder={step.kind === "EXERCISE" ? "Optional override" : "Warmup, breathing, cooldown..."} />
                            </Field>
                            <Field label="Work (sec)"><input style={inputStyle} inputMode="numeric" value={step.durationSec} onChange={(event) => updateStep(step.id, (current) => ({ ...current, durationSec: event.target.value }))} /></Field>
                            <Field label="Rest (sec)"><input style={inputStyle} inputMode="numeric" value={step.restSec} onChange={(event) => updateStep(step.id, (current) => ({ ...current, restSec: event.target.value }))} /></Field>
                            <Field label="Reps"><input style={inputStyle} inputMode="numeric" value={step.repCount} onChange={(event) => updateStep(step.id, (current) => ({ ...current, repCount: event.target.value }))} /></Field>
                            <Field label="Sets"><input style={inputStyle} inputMode="numeric" value={step.setCount} onChange={(event) => updateStep(step.id, (current) => ({ ...current, setCount: event.target.value }))} /></Field>
                            {step.kind === "EXERCISE" ? <Field label="Weight (lb)"><input style={inputStyle} inputMode="decimal" value={step.weightLb} onChange={(event) => updateStep(step.id, (current) => ({ ...current, weightLb: event.target.value }))} /></Field> : null}
                          </FieldGrid>
                          <div style={{ ...pillRow, marginTop: 12 }}>
                            <button type="button" onClick={() => moveStep(step.id, -1)} disabled={index === 0} style={pillButtonStyle}>Move Up</button>
                            <button type="button" onClick={() => moveStep(step.id, 1)} disabled={index === draftSteps.length - 1} style={pillButtonStyle}>Move Down</button>
                            <button type="button" onClick={() => { setDraftSteps((current) => { const stepIndex = current.findIndex((item) => item.id === step.id); if (stepIndex < 0) return current; const next = [...current]; next.splice(stepIndex + 1, 0, { ...current[stepIndex], id: createDraftId(), guidedStepId: null }); return next; }); }} style={pillButtonStyle}>Duplicate</button>
                            <button type="button" onClick={() => setDraftSteps((current) => current.filter((item) => item.id !== step.id))} style={dangerPillStyle}>Remove</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </FormSection>
      ) : (
        <FormSection title="Log After" description="Use this clean template when you completed the routine without running the guide live.">
          <Field label="Performed at">
            <input type="datetime-local" style={inputStyle} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
          </Field>
          <div style={{ display: "grid", gap: 10 }}>
            {draftSteps.length === 0 ? <div style={{ ...card, borderStyle: "dashed", opacity: 0.78 }}>Start blank or add the steps you completed.</div> : null}
            {draftSteps.map((step, index) => {
              const exercise = step.exerciseId ? exerciseById.get(step.exerciseId) ?? null : null;
              const isExpanded = expandedStepId === step.id;
              return (
                <div key={step.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={pillRow}>
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>#{index + 1}</span>
                        <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(76,163,255,0.28)", background: "rgba(76,163,255,0.12)", fontSize: 12, fontWeight: 800 }}>{step.kind === "EXERCISE" ? "Exercise" : "Step"}</span>
                        {!step.includeInLog ? <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(128,128,128,0.26)", background: "rgba(128,128,128,0.08)", fontSize: 12, fontWeight: 800 }}>Excluded</span> : null}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{stepLabel(step, exerciseById)}</div>
                      <div style={helperTextStyle}>{stepSummary(step)}</div>
                      {step.kind === "EXERCISE" ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={helperTextStyle}>Weight</span>
                          <input
                            style={{ ...inputStyle, width: 96, padding: "8px 10px" }}
                            inputMode="decimal"
                            value={step.weightLb}
                            onChange={(event) => updateStep(step.id, (current) => ({ ...current, weightLb: event.target.value }))}
                            placeholder="lb"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div style={pillRow}>
                      <button type="button" onClick={() => setExpandedStepId((current) => current === step.id ? null : step.id)} style={pillButtonStyle}>{isExpanded ? "Done Editing" : "Edit"}</button>
                    </div>
                  </div>
                  {isExpanded ? (
                    <div style={{ marginTop: 12 }}>
                      <FieldGrid minWidth={160}>
                        <Field label="Save in log">
                          <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                            <input type="checkbox" checked={step.includeInLog} onChange={(event) => updateStep(step.id, (current) => ({ ...current, includeInLog: event.target.checked }))} />
                            <span>{step.includeInLog ? "Included" : "Excluded"}</span>
                          </label>
                        </Field>
                        <Field label="Item type">
                          <select style={inputStyle} value={step.kind} onChange={(event) => updateStep(step.id, (current) => ({ ...current, kind: event.target.value as GuidedStepKind, exerciseId: event.target.value === "EXERCISE" ? current.exerciseId : "" }))}>
                            <option value="STEP">Step</option>
                            <option value="EXERCISE">Exercise</option>
                          </select>
                        </Field>
                        {step.kind === "EXERCISE" ? (
                          <Field label="Exercise">
                            <select style={inputStyle} value={step.exerciseId} onChange={(event) => updateStep(step.id, (current) => ({ ...current, exerciseId: event.target.value }))}>
                              <option value="">Select exercise</option>
                              {orderedExercises.map((option) => <option key={option.id} value={option.id}>{option.name} ({EXERCISE_LIBRARY_KIND_LABELS[option.libraryKind]})</option>)}
                            </select>
                          </Field>
                        ) : null}
                        <Field label={step.kind === "EXERCISE" ? "Display title" : "Step title"} hint={step.kind === "EXERCISE" && exercise ? `Defaults to ${exercise.name}` : undefined}>
                          <input style={inputStyle} value={step.title} onChange={(event) => updateStep(step.id, (current) => ({ ...current, title: event.target.value }))} placeholder={step.kind === "EXERCISE" ? "Optional override" : "Warmup, breathing, cooldown..."} />
                        </Field>
                        <Field label="Work (sec)"><input style={inputStyle} inputMode="numeric" value={step.durationSec} onChange={(event) => updateStep(step.id, (current) => ({ ...current, durationSec: event.target.value }))} /></Field>
                        <Field label="Rest (sec)"><input style={inputStyle} inputMode="numeric" value={step.restSec} onChange={(event) => updateStep(step.id, (current) => ({ ...current, restSec: event.target.value }))} /></Field>
                        <Field label="Reps"><input style={inputStyle} inputMode="numeric" value={step.repCount} onChange={(event) => updateStep(step.id, (current) => ({ ...current, repCount: event.target.value }))} /></Field>
                        <Field label="Sets"><input style={inputStyle} inputMode="numeric" value={step.setCount} onChange={(event) => updateStep(step.id, (current) => ({ ...current, setCount: event.target.value }))} /></Field>
                        {step.kind === "EXERCISE" ? <Field label="Weight (lb)"><input style={inputStyle} inputMode="decimal" value={step.weightLb} onChange={(event) => updateStep(step.id, (current) => ({ ...current, weightLb: event.target.value }))} /></Field> : null}
                      </FieldGrid>
                      <div style={{ ...pillRow, marginTop: 12 }}>
                        <button type="button" onClick={() => moveStep(step.id, -1)} disabled={index === 0} style={pillButtonStyle}>Move Up</button>
                        <button type="button" onClick={() => moveStep(step.id, 1)} disabled={index === draftSteps.length - 1} style={pillButtonStyle}>Move Down</button>
                        <button type="button" onClick={() => { setDraftSteps((current) => { const stepIndex = current.findIndex((item) => item.id === step.id); if (stepIndex < 0) return current; const next = [...current]; next.splice(stepIndex + 1, 0, { ...current[stepIndex], id: createDraftId(), guidedStepId: null }); return next; }); }} style={pillButtonStyle}>Duplicate</button>
                        <button type="button" onClick={() => setDraftSteps((current) => current.filter((item) => item.id !== step.id))} style={dangerPillStyle}>Remove</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </FormSection>
      )}

      <FormSection title="Session details" description="Duration is auto-derived unless you override it here.">
        <FieldGrid minWidth={220}>
          <Field label="Duration override (minutes, optional)">
            <input style={inputStyle} inputMode="decimal" value={durationOverrideMin} onChange={(event) => setDurationOverrideMin(event.target.value)} placeholder={estimatedDurationSec > 0 ? String(Math.round(estimatedDurationSec / 60)) : ""} />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes (optional)">
          <textarea style={textareaStyle} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FormSection>

      {mode === "LOG_AFTER" ? null : <OptionalDateSection value={performedAtLocal} onChange={setPerformedAtLocal} />}

      <FormActions primaryLabel={saveLabel} primaryPendingLabel={savePendingLabel} saving={saving} onPrimary={onSave} backHref={backHref} />
    </FormStack>
  );
}
