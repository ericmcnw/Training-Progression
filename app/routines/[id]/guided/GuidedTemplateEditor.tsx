"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatGuidedRepSetSummary, formatGuidedSeconds } from "@/lib/guided";
import { addGuidedStep, deleteGuidedStep, moveGuidedStep, saveAllGuidedStepsAndExit, updateGuidedStep } from "./actions";

type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
};

type GuidedStepRow = {
  id: string;
  kind: "STEP" | "EXERCISE";
  title: string;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount: number;
  setCount: number;
  sortOrder: number;
  exerciseId: string | null;
  exerciseName: string | null;
};

type GuidedStepDraft = {
  id: string;
  kind: "STEP" | "EXERCISE";
  selectedExerciseId: string;
  selectedLibraryTitle: string;
  title: string;
  durationSec: string;
  restSec: string;
  repCount: string;
  setCount: string;
  repeatCount: string;
  sortOrder: number;
  exerciseName: string | null;
};

function buildMetricSummary({
  durationSec,
  restSec,
  repeatCount,
  repCount,
  setCount,
}: {
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount: number;
  setCount: number;
}) {
  const parts: string[] = [];
  if (durationSec) parts.push(`${formatGuidedSeconds(durationSec)} work`);
  if (restSec) parts.push(`${formatGuidedSeconds(restSec)} rest`);
  const repSetSummary = formatGuidedRepSetSummary({ repeatCount, repCount, setCount });
  if (repSetSummary) parts.push(repSetSummary);
  return parts.length > 0 ? parts.join(" | ") : "No timing or rep targets yet";
}

function GuidedTemplateItemFields({
  kind,
  setKind,
  exercises,
  stepLibraryOptions,
  selectedExerciseId,
  setSelectedExerciseId,
  selectedLibraryTitle,
  setSelectedLibraryTitle,
  title,
  setTitle,
  durationSec,
  setDurationSec,
  restSec,
  setRestSec,
  repCount,
  setRepCount,
  setCount,
  setSetCount,
  variant = "editor",
}: {
  kind: "STEP" | "EXERCISE";
  setKind: (value: "STEP" | "EXERCISE") => void;
  exercises: ExerciseOption[];
  stepLibraryOptions: ExerciseOption[];
  selectedExerciseId: string;
  setSelectedExerciseId: (value: string) => void;
  selectedLibraryTitle: string;
  setSelectedLibraryTitle: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  durationSec: string;
  setDurationSec: (value: string) => void;
  restSec: string;
  setRestSec: (value: string) => void;
  repCount: string;
  setRepCount: (value: string) => void;
  setCount: string;
  setSetCount: (value: string) => void;
  variant?: "creator" | "editor";
}) {
  return (
    <div style={{ display: "grid", gap: variant === "creator" ? 12 : 14 }}>
      <div style={fieldGroup}>
        <div style={groupHeading}>Identity</div>
        <div style={{ ...inputGrid, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={field}>
            <span>Item type</span>
            <select
              name="kind"
              value={kind}
              onChange={(event) => {
                const nextKind = event.target.value as "STEP" | "EXERCISE";
                setKind(nextKind);
                if (nextKind === "EXERCISE") {
                  setSelectedLibraryTitle("");
                } else {
                  setSelectedExerciseId("");
                }
              }}
              style={input}
            >
              <option value="STEP">Step</option>
              <option value="EXERCISE">Exercise</option>
            </select>
          </label>

          {kind === "EXERCISE" ? (
            <>
              <label style={field}>
                <span>Exercise</span>
                <select
                  name="exerciseId"
                  value={selectedExerciseId}
                  onChange={(event) => setSelectedExerciseId(event.target.value)}
                  style={input}
                >
                  <option value="">Select exercise</option>
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={field}>
                <span>Display title</span>
                <input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  style={input}
                  placeholder="Leave blank to use exercise name"
                />
              </label>
            </>
          ) : (
            <>
              <label style={field}>
                <span>Step library</span>
                <select
                  value={selectedLibraryTitle}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSelectedLibraryTitle(next);
                    if (next) setTitle(next);
                  }}
                  style={input}
                >
                  <option value="">Custom step</option>
                  {stepLibraryOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={field}>
                <span>Step title</span>
                <input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  style={input}
                  placeholder="Warmup, nasal breathing, cooldown..."
                />
              </label>
            </>
          )}
        </div>
        {kind === "EXERCISE" ? (
          <Link href="/exercises" style={miniLink}>
            Create your own exercise
          </Link>
        ) : null}
      </div>

      <div style={tripleGrid}>
        <div style={fieldGroup}>
          <div style={groupHeading}>Timing</div>
          <div style={compactGrid}>
            <label style={field}>
              <span>Work duration (sec)</span>
              <input name="durationSec" value={durationSec} onChange={(event) => setDurationSec(event.target.value)} style={input} inputMode="numeric" placeholder="7" />
            </label>

            <label style={field}>
              <span>Rest duration (sec)</span>
              <input name="restSec" value={restSec} onChange={(event) => setRestSec(event.target.value)} style={input} inputMode="numeric" placeholder="3" />
            </label>
          </div>
        </div>

        <div style={fieldGroup}>
          <div style={groupHeading}>Targets</div>
          <div style={compactGrid}>
            <label style={field}>
              <span>Reps</span>
              <input name="repCount" value={repCount} onChange={(event) => setRepCount(event.target.value)} style={input} inputMode="numeric" placeholder="10" />
            </label>

            <label style={field}>
              <span>Sets</span>
              <input name="setCount" value={setCount} onChange={(event) => setSetCount(event.target.value)} style={input} inputMode="numeric" placeholder="2" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuidedTemplateRow({
  routineId,
  step,
  draft,
  exercises,
  stepLibraryOptions,
  onDraftChange,
}: {
  routineId: string;
  step: GuidedStepRow;
  draft: GuidedStepDraft;
  exercises: ExerciseOption[];
  stepLibraryOptions: ExerciseOption[];
  onDraftChange: (stepId: string, updater: (current: GuidedStepDraft) => GuidedStepDraft) => void;
}) {
  const itemLabel = draft.kind === "EXERCISE"
    ? (exercises.find((exercise) => exercise.id === draft.selectedExerciseId)?.name ?? draft.exerciseName ?? step.title)
    : (draft.title || draft.selectedLibraryTitle || step.title);
  const effectiveRepCount = draft.repCount ? Number(draft.repCount) : step.repCount;
  const effectiveSetCount = draft.setCount ? Number(draft.setCount) : step.setCount;
  const effectiveDurationSec = draft.durationSec ? Number(draft.durationSec) : step.durationSec;
  const effectiveRestSec = draft.restSec ? Number(draft.restSec) : step.restSec;
  const metricSummary = buildMetricSummary({
    durationSec: effectiveDurationSec,
    restSec: effectiveRestSec,
    repeatCount: step.repeatCount,
    repCount: effectiveRepCount,
    setCount: effectiveSetCount,
  });
  const moveUpAction = moveGuidedStep.bind(null, "UP");
  const moveDownAction = moveGuidedStep.bind(null, "DOWN");

  return (
    <form action={updateGuidedStep} style={card}>
      <input type="hidden" name="routineId" value={routineId} />
      <input type="hidden" name="stepId" value={step.id} />
      <input type="hidden" name="repeatCount" value={String(effectiveRepCount || 1)} />
      <div style={cardSummary}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={indexPill}>#{step.sortOrder + 1}</span>
            <span style={typePill}>{draft.kind === "EXERCISE" ? "Exercise" : "Step"}</span>
          </div>
          <div style={cardTitle}>{itemLabel || (draft.kind === "EXERCISE" ? "Untitled exercise" : "Untitled step")}</div>
        </div>
        <div style={summaryMetric}>{metricSummary}</div>
      </div>

      <div style={editorBody}>
        <GuidedTemplateItemFields
          kind={draft.kind}
          setKind={(nextKind) => {
            onDraftChange(step.id, (current) => ({
              ...current,
              kind: nextKind,
              selectedLibraryTitle: nextKind === "EXERCISE" ? "" : current.selectedLibraryTitle,
              selectedExerciseId: nextKind === "EXERCISE" ? current.selectedExerciseId : "",
            }));
          }}
          exercises={exercises}
          stepLibraryOptions={stepLibraryOptions}
          selectedExerciseId={draft.selectedExerciseId}
          setSelectedExerciseId={(value) => onDraftChange(step.id, (current) => ({ ...current, selectedExerciseId: value }))}
          selectedLibraryTitle={draft.selectedLibraryTitle}
          setSelectedLibraryTitle={(value) => onDraftChange(step.id, (current) => ({ ...current, selectedLibraryTitle: value }))}
          title={draft.title}
          setTitle={(value) => onDraftChange(step.id, (current) => ({ ...current, title: value }))}
          durationSec={draft.durationSec}
          setDurationSec={(value) => onDraftChange(step.id, (current) => ({ ...current, durationSec: value }))}
          restSec={draft.restSec}
          setRestSec={(value) => onDraftChange(step.id, (current) => ({ ...current, restSec: value }))}
          repCount={draft.repCount}
          setRepCount={(value) => onDraftChange(step.id, (current) => ({ ...current, repCount: value }))}
          setCount={draft.setCount}
          setSetCount={(value) => onDraftChange(step.id, (current) => ({ ...current, setCount: value }))}
          variant="editor"
        />
      </div>

      <div style={cardActions}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" formAction={moveUpAction} style={quietBtn}>
            Up
          </button>
          <button type="submit" formAction={moveDownAction} style={quietBtn}>
            Down
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" style={primaryBtn}>Save Changes</button>
          <button type="submit" formAction={deleteGuidedStep} style={dangerBtn}>Delete</button>
        </div>
      </div>
    </form>
  );
}

export default function GuidedTemplateEditor({
  routineId,
  exercises,
  steps,
}: {
  routineId: string;
  exercises: ExerciseOption[];
  steps: GuidedStepRow[];
}) {
  const [kind, setKind] = useState<"STEP" | "EXERCISE">("STEP");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [selectedLibraryTitle, setSelectedLibraryTitle] = useState("");
  const [title, setTitle] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [restSec, setRestSec] = useState("");
  const [repCount, setRepCount] = useState("");
  const [setCount, setSetCount] = useState("");
  const [stepDrafts, setStepDrafts] = useState<GuidedStepDraft[]>(() =>
    steps.map((step) => ({
      id: step.id,
      kind: step.kind,
      selectedExerciseId: step.exerciseId ?? "",
      selectedLibraryTitle:
        step.kind === "STEP" && stepLibraryOptionsForRow(step, exercises).some((option) => option.name === step.title)
          ? step.title
          : "",
      title: step.kind === "EXERCISE" && step.exerciseName === step.title ? "" : step.title,
      durationSec: step.durationSec === null ? "" : String(step.durationSec),
      restSec: step.restSec === null ? "" : String(step.restSec),
      repCount: step.repCount > 1 ? String(step.repCount) : "",
      setCount: step.setCount > 1 ? String(step.setCount) : "",
      repeatCount: String(step.repeatCount || 1),
      sortOrder: step.sortOrder,
      exerciseName: step.exerciseName,
    }))
  );

  const stepLibraryOptions = useMemo(
    () => exercises.filter((exercise) => exercise.unit === "TIME"),
    [exercises]
  );
  const totalItems = steps.length;
  const totalExerciseItems = steps.filter((step) => step.kind === "EXERCISE").length;
  const totalStepItems = totalItems - totalExerciseItems;
  const updateStepDraft = (stepId: string, updater: (current: GuidedStepDraft) => GuidedStepDraft) => {
    setStepDrafts((current) => current.map((draft) => (draft.id === stepId ? updater(draft) : draft)));
  };

  return (
    <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
      <form id="guided-save-all-form" action={saveAllGuidedStepsAndExit} style={{ display: "none" }}>
        <input type="hidden" name="routineId" value={routineId} />
        {stepDrafts
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((draft) => (
            <div key={draft.id}>
              <input type="hidden" name="stepId" value={draft.id} />
              <input type="hidden" name="kind" value={draft.kind} />
              <input type="hidden" name="exerciseId" value={draft.selectedExerciseId} />
              <input type="hidden" name="title" value={draft.title} />
              <input type="hidden" name="durationSec" value={draft.durationSec} />
              <input type="hidden" name="restSec" value={draft.restSec} />
              <input type="hidden" name="repeatCount" value={draft.repeatCount} />
              <input type="hidden" name="repCount" value={draft.repCount} />
              <input type="hidden" name="setCount" value={draft.setCount} />
            </div>
          ))}
      </form>

      <section style={creatorPanel}>
        <div style={creatorHeader}>
          <div>
            <div style={sectionEyebrow}>Add Item</div>
            <div style={sectionTitle}>Build the next part of the flow</div>
          </div>
          <div style={headerActionGroup}>
            <button type="submit" form="guided-save-all-form" style={primaryBtn}>
              Save & Back To Routines
            </button>
          </div>
          <div style={creatorBadgeRow}>
            <span style={statPill}>{totalItems} items total</span>
            <span style={statPill}>{totalExerciseItems} exercise</span>
            <span style={statPill}>{totalStepItems} step</span>
          </div>
        </div>
        <div style={creatorBody}>
          <div style={helperText}>
            Add one flow item at a time. Use exercise items for tracked movements and step items for breathwork, stretching, mobility, warmups, cooldowns, and guided cues.
          </div>
          <form action={addGuidedStep} style={{ display: "grid", gap: 14 }}>
            <input type="hidden" name="routineId" value={routineId} />
            <input type="hidden" name="repeatCount" value={repCount || "1"} />
            <GuidedTemplateItemFields
              kind={kind}
              setKind={(nextKind) => {
                setKind(nextKind);
                if (nextKind === "EXERCISE") {
                  setSelectedLibraryTitle("");
                } else {
                  setSelectedExerciseId("");
                }
              }}
              exercises={exercises}
              stepLibraryOptions={stepLibraryOptions}
              selectedExerciseId={selectedExerciseId}
              setSelectedExerciseId={setSelectedExerciseId}
              selectedLibraryTitle={selectedLibraryTitle}
              setSelectedLibraryTitle={setSelectedLibraryTitle}
              title={title}
              setTitle={setTitle}
              durationSec={durationSec}
              setDurationSec={setDurationSec}
              restSec={restSec}
              setRestSec={setRestSec}
              repCount={repCount}
              setRepCount={setRepCount}
              setCount={setCount}
              setSetCount={setSetCount}
              variant="creator"
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={subtleNote}>Keep this panel lightweight, then fine-tune items below.</div>
              <button type="submit" style={primaryBtn}>Add Item To Flow</button>
            </div>
          </form>
        </div>
      </section>

      <section style={panel}>
        <div style={flowHeader}>
          <div>
            <div style={sectionEyebrow}>Current Flow</div>
            <div style={sectionTitle}>Scan and edit the sequence</div>
          </div>
          <div style={helperText}>Summary first, editable details below each card.</div>
        </div>
        <div style={{ padding: 14, display: "grid", gap: 14 }}>
          {steps.length === 0 && <div style={emptyState}>No template items yet.</div>}
          {steps.map((step) => (
            <GuidedTemplateRow
              key={step.id}
              routineId={routineId}
              step={step}
              draft={stepDrafts.find((draft) => draft.id === step.id) ?? {
                id: step.id,
                kind: step.kind,
                selectedExerciseId: step.exerciseId ?? "",
                selectedLibraryTitle: "",
                title: step.title,
                durationSec: step.durationSec === null ? "" : String(step.durationSec),
                restSec: step.restSec === null ? "" : String(step.restSec),
                repCount: step.repCount > 1 ? String(step.repCount) : "",
                setCount: step.setCount > 1 ? String(step.setCount) : "",
                repeatCount: String(step.repeatCount || 1),
                sortOrder: step.sortOrder,
                exerciseName: step.exerciseName,
              }}
              exercises={exercises}
              stepLibraryOptions={stepLibraryOptions}
              onDraftChange={updateStepDraft}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function stepLibraryOptionsForRow(step: GuidedStepRow, exercises: ExerciseOption[]) {
  const timeOptions = exercises.filter((exercise) => exercise.unit === "TIME");
  return step.kind === "STEP" ? timeOptions : timeOptions;
}

const panel: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(17,24,39,0.4)",
};

const creatorPanel: React.CSSProperties = {
  ...panel,
  border: "1px solid rgba(110,140,220,0.28)",
  background: "linear-gradient(180deg, rgba(46,64,116,0.16), rgba(17,24,39,0.5))",
};

const creatorHeader: React.CSSProperties = {
  padding: "16px 18px 12px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
};

const headerActionGroup: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 14,
  background: "rgba(128,128,128,0.05)",
  display: "grid",
  overflow: "hidden",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(89,154,255,0.72)",
  borderRadius: 10,
  background: "rgba(68,126,217,0.2)",
  color: "inherit",
  fontWeight: 900,
};

const quietBtn: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 999,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
};

const dangerBtn: React.CSSProperties = {
  ...quietBtn,
  border: "1px solid rgba(255,80,80,0.65)",
  color: "#ffd0d0",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
  lineHeight: 1.5,
};

const miniLink: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "inherit",
  opacity: 0.78,
};

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid rgba(128,128,128,0.18)",
  borderRadius: 12,
  background: "rgba(17,24,39,0.4)",
};

const groupHeading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  opacity: 0.7,
};

const inputGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const compactGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
};

const tripleGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const creatorBody: React.CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 14,
};

const creatorBadgeRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const statPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(128,128,128,0.1)",
  border: "1px solid rgba(128,128,128,0.22)",
  fontSize: 12,
  fontWeight: 800,
};

const sectionEyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 1,
  opacity: 0.65,
};

const sectionTitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 22,
  fontWeight: 900,
};

const flowHeader: React.CSSProperties = {
  padding: "16px 18px 12px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  background: "rgba(128,128,128,0.08)",
};

const subtleNote: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.68,
};

const emptyState: React.CSSProperties = {
  padding: 18,
  border: "1px dashed rgba(128,128,128,0.35)",
  borderRadius: 14,
  opacity: 0.75,
};

const cardSummary: React.CSSProperties = {
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "center",
  background: "linear-gradient(180deg, rgba(128,128,128,0.08), rgba(128,128,128,0.03))",
  borderBottom: "1px solid rgba(128,128,128,0.16)",
};

const indexPill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  fontSize: 12,
  fontWeight: 900,
};

const typePill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(76,163,255,0.12)",
  border: "1px solid rgba(76,163,255,0.28)",
  fontSize: 12,
  fontWeight: 800,
};

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.2,
};

const summaryMetric: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  background: "rgba(17,24,39,0.55)",
  border: "1px solid rgba(128,128,128,0.22)",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.88,
};

const editorBody: React.CSSProperties = {
  padding: 14,
  display: "grid",
  gap: 14,
};

const cardActions: React.CSSProperties = {
  padding: "0 14px 14px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};
