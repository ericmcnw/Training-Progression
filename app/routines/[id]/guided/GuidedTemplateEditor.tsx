"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatGuidedSeconds } from "@/lib/guided";
import { addGuidedStep, deleteGuidedStep, updateGuidedStep } from "./actions";

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
  sortOrder: number;
  exerciseId: string | null;
  exerciseName: string | null;
};

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
  repeatCount,
  setRepeatCount,
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
  repeatCount: string;
  setRepeatCount: (value: string) => void;
}) {
  return (
    <div className="mobileGuidedTemplateGrid" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
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
          <Link href="/exercises" style={miniLink}>
            Create your own exercise
          </Link>
        </label>
      ) : (
        <>
          <label style={field}>
            <span>General library</span>
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
            <span>Custom section title</span>
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

      {kind === "EXERCISE" ? (
        <label style={field}>
          <span>Display title (optional)</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            style={input}
            placeholder="Leave blank to use exercise name"
          />
        </label>
      ) : null}

      <label style={field}>
        <span>Work duration (sec)</span>
        <input name="durationSec" value={durationSec} onChange={(event) => setDurationSec(event.target.value)} style={input} inputMode="numeric" placeholder="60" />
      </label>

      <label style={field}>
        <span>Rest duration (sec)</span>
        <input name="restSec" value={restSec} onChange={(event) => setRestSec(event.target.value)} style={input} inputMode="numeric" placeholder="15" />
      </label>

      <label style={field}>
        <span>Repeats / sets</span>
        <input name="repeatCount" value={repeatCount} onChange={(event) => setRepeatCount(event.target.value)} style={input} inputMode="numeric" />
      </label>
    </div>
  );
}

function GuidedTemplateRow({
  routineId,
  step,
  exercises,
  stepLibraryOptions,
}: {
  routineId: string;
  step: GuidedStepRow;
  exercises: ExerciseOption[];
  stepLibraryOptions: ExerciseOption[];
}) {
  const [kind, setKind] = useState<"STEP" | "EXERCISE">(step.kind);
  const [selectedExerciseId, setSelectedExerciseId] = useState(step.exerciseId ?? "");
  const [selectedLibraryTitle, setSelectedLibraryTitle] = useState(
    step.kind === "STEP" && stepLibraryOptions.some((option) => option.name === step.title) ? step.title : ""
  );
  const [title, setTitle] = useState(step.kind === "EXERCISE" && step.exerciseName === step.title ? "" : step.title);
  const [durationSec, setDurationSec] = useState(step.durationSec === null ? "" : String(step.durationSec));
  const [restSec, setRestSec] = useState(step.restSec === null ? "" : String(step.restSec));
  const [repeatCount, setRepeatCount] = useState(String(step.repeatCount));

  const itemLabel = kind === "EXERCISE"
    ? (exercises.find((exercise) => exercise.id === selectedExerciseId)?.name ?? step.exerciseName ?? step.title)
    : (title || selectedLibraryTitle || step.title);

  return (
    <form action={updateGuidedStep} style={card}>
      <input type="hidden" name="routineId" value={routineId} />
      <input type="hidden" name="stepId" value={step.id} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>
          Item {step.sortOrder + 1} • {kind === "EXERCISE" ? "Exercise" : "Step"}
        </div>
        <div style={{ fontSize: 12, opacity: 0.72 }}>
          {itemLabel} • {formatGuidedSeconds(durationSec ? Number(durationSec) : step.durationSec)} work
          {restSec ? ` • ${formatGuidedSeconds(Number(restSec))} rest` : step.restSec ? ` • ${formatGuidedSeconds(step.restSec)} rest` : ""}
          {(repeatCount ? Number(repeatCount) : step.repeatCount) > 1 ? ` • ${repeatCount || step.repeatCount} sets` : ""}
        </div>
      </div>

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
        repeatCount={repeatCount}
        setRepeatCount={setRepeatCount}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={btn}>Save</button>
        <button type="submit" formAction={deleteGuidedStep} style={dangerBtn}>Delete</button>
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
  const [repeatCount, setRepeatCount] = useState("1");

  const stepLibraryOptions = useMemo(
    () => exercises.filter((exercise) => exercise.unit === "TIME" && !exercise.supportsWeight),
    [exercises]
  );

  return (
    <>
      <section style={panel}>
        <div style={panelHeader}>ADD TEMPLATE ITEM</div>
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={helperText}>
            Exercise items use the exercise library and support weight at log time. Step items use the general library for breathwork, stretching, and similar sections, plus an optional custom section title.
          </div>
          <form action={addGuidedStep} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="routineId" value={routineId} />
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
              repeatCount={repeatCount}
              setRepeatCount={setRepeatCount}
            />
            <div>
              <button type="submit" style={btn}>Add Item</button>
            </div>
          </form>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 16 }}>
        <div style={panelHeader}>CURRENT FLOW</div>
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {steps.length === 0 && <div style={{ opacity: 0.75 }}>No template items yet.</div>}
          {steps.map((step) => (
            <GuidedTemplateRow
              key={step.id}
              routineId={routineId}
              step={step}
              exercises={exercises}
              stepLibraryOptions={stepLibraryOptions}
            />
          ))}
        </div>
      </section>
    </>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  gap: 10,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 4,
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

const btn: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 900,
};

const dangerBtn: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(255,80,80,0.65)",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

const miniLink: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "inherit",
  opacity: 0.78,
};
