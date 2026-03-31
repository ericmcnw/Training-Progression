"use client";

import { compareExerciseNames, condensedExerciseName, exerciseMatchesQuery, exerciseUnitFieldLabel, exerciseUnitLabel, normalizeExerciseName } from "@/lib/exercises";
import { useMemo, useState, useTransition } from "react";
import { Field, FormActions, FormSection, FormStack, inputStyle, textareaStyle } from "./form-ui";

export type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  libraryKind?: "STRENGTH" | "CONDITIONING" | "MOBILITY" | "STRETCH" | "BREATHWORK" | "SKILL";
};

export type SetRow = {
  setNumber: number;
  reps?: string;
  seconds?: string;
  weightLb?: string;
};

export type WorkoutBlock = {
  exerciseId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  rows: SetRow[];
};

type SavePayload = {
  notes: string;
  performedAtLocal: string;
  exercises: {
    exerciseId: string;
    sets: {
      setNumber: number;
      reps?: number | null;
      seconds?: number | null;
      weightLb?: number | null;
    }[];
  }[];
};

type CreateExerciseOptionFn = (params: {
  routineId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight?: boolean;
}) => Promise<ExerciseOption>;

function defaultRows(count = 3) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    setNumber: index + 1,
  }));
}

export default function WorkoutExerciseEditor({
  routineId,
  initialNotes,
  initialPerformedAt,
  initialBlocks,
  availableExercises,
  saveLabel,
  savingLabel,
  backHref,
  smartDefaultLabel,
  addExerciseTitle = "Add Exercise To This Routine",
  addExerciseHelp = "Saving here updates the routine template too. Remove a block to remove it from the routine.",
  createExerciseHelp = "Creating here saves the exercise for future workouts and adds it to this routine now.",
  emptyStateHelp = "",
  createExerciseOption,
  onSave,
}: {
  routineId: string;
  initialNotes: string;
  initialPerformedAt: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  saveLabel: string;
  savingLabel: string;
  backHref: string;
  smartDefaultLabel?: string | null;
  addExerciseTitle?: string;
  addExerciseHelp?: string;
  createExerciseHelp?: string;
  emptyStateHelp?: string;
  createExerciseOption: CreateExerciseOptionFn;
  onSave: (payload: SavePayload) => Promise<void>;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(initialPerformedAt);
  const [saving, setSaving] = useState(false);
  const [creatingExercise, startCreateExercise] = useTransition();
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [customUnit, setCustomUnit] = useState<"REPS" | "TIME">("REPS");
  const [customSupportsWeight, setCustomSupportsWeight] = useState(false);
  const [exerciseError, setExerciseError] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState(availableExercises);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks);

  const availableToAdd = useMemo(() => {
    const activeIds = new Set(blocks.map((block) => block.exerciseId));
    return exerciseOptions.filter((exercise) => {
      if (activeIds.has(exercise.id)) return false;
      return exerciseMatchesQuery(exercise.name, exerciseQuery);
    });
  }, [exerciseOptions, blocks, exerciseQuery]);

  const hasExactMatch = useMemo(() => {
    const normalizedQuery = condensedExerciseName(exerciseQuery);
    if (!normalizedQuery) return false;
    return exerciseOptions.some((exercise) => condensedExerciseName(exercise.name) === normalizedQuery);
  }, [exerciseOptions, exerciseQuery]);

  const activeSelectedExerciseId = useMemo(() => {
    if (availableToAdd.some((exercise) => exercise.id === selectedExerciseId)) {
      return selectedExerciseId;
    }
    return availableToAdd[0]?.id ?? "";
  }, [availableToAdd, selectedExerciseId]);

  function addExercise(exerciseId: string) {
    const exercise = exerciseOptions.find((item) => item.id === exerciseId);
    if (!exercise) return;

    setBlocks((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        unit: exercise.unit,
        supportsWeight: exercise.supportsWeight,
        rows: defaultRows(),
      },
    ]);
    setExerciseQuery("");
    setSelectedExerciseId("");
    setExerciseError("");
  }

  function removeExercise(exerciseId: string) {
    setBlocks((prev) => prev.filter((block) => block.exerciseId !== exerciseId));
  }

  function addRow(exerciseId: string) {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        return { ...block, rows: [...block.rows, { setNumber: block.rows.length + 1 }] };
      })
    );
  }

  function removeRow(exerciseId: string, setNumber: number) {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        const rows = block.rows
          .filter((row) => row.setNumber !== setNumber)
          .map((row, index) => ({ ...row, setNumber: index + 1 }));
        return { ...block, rows: rows.length > 0 ? rows : [{ setNumber: 1 }] };
      })
    );
  }

  function updateCell(exerciseId: string, setNumber: number, key: keyof SetRow, value: string) {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        return {
          ...block,
          rows: block.rows.map((row) => (row.setNumber === setNumber ? { ...row, [key]: value } : row)),
        };
      })
    );
  }

  function toNumOrNull(value?: string) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        notes,
        performedAtLocal,
        exercises: blocks.map((block) => ({
          exerciseId: block.exerciseId,
          sets: block.rows.map((row) => ({
            setNumber: row.setNumber,
            reps: toNumOrNull(row.reps),
            seconds: toNumOrNull(row.seconds),
            weightLb: toNumOrNull(row.weightLb),
          })),
        })),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleAddSelectedExercise() {
    if (!activeSelectedExerciseId) return;
    addExercise(activeSelectedExerciseId);
  }

  function handleCreateExercise() {
    const name = normalizeExerciseName(exerciseQuery);
    if (!name) {
      setExerciseError("Enter an exercise name.");
      return;
    }

    setExerciseError("");
    startCreateExercise(async () => {
      try {
        const created = await createExerciseOption({
          routineId,
          name,
          unit: customUnit,
          supportsWeight: customSupportsWeight,
        });

        setExerciseOptions((prev) => {
          if (prev.some((exercise) => exercise.id === created.id)) return prev;
          return [...prev, created].sort((a, b) => compareExerciseNames(a.name, b.name));
        });
        setBlocks((prev) => [
          ...prev,
          {
            exerciseId: created.id,
            name: created.name,
            unit: created.unit,
            supportsWeight: created.supportsWeight,
            rows: defaultRows(),
          },
        ]);
        setExerciseQuery("");
        setSelectedExerciseId("");
        setExerciseError("");
      } catch (error) {
        setExerciseError(error instanceof Error ? error.message : "Could not create exercise.");
      }
    });
  }

  return (
    <FormStack maxWidth={880}>
      <FormSection title="Workout details" description="Keep the top of every log consistent: time first, notes second, then the type-specific editor.">
        {smartDefaultLabel ? <div style={styles.smartDefaultNote}>{smartDefaultLabel}</div> : null}
        <Field label="Performed at">
          <input
            type="datetime-local"
            style={inputStyle}
            value={performedAtLocal}
            onChange={(event) => setPerformedAtLocal(event.target.value)}
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            style={{ ...textareaStyle, minHeight: 80 }}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection title="Exercise blocks" description="Add, swap, or remove exercises here. The template stays editable without leaving the logging flow.">
        <div className="mobileCard" style={styles.addPanel}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{addExerciseTitle}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{addExerciseHelp}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Workout search uses the workout library by default, so stretch, mobility, and breathwork items do not crowd this picker.
          </div>
        </div>
        <input
          style={{ ...inputStyle, minWidth: 260 }}
          value={exerciseQuery}
          onChange={(event) => setExerciseQuery(event.target.value)}
          placeholder="Search by name, even without punctuation"
        />
        <div style={{ display: "grid", gap: 10 }}>
          <div className="mobileWorkoutPickerRow" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={activeSelectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              style={{ ...inputStyle, minWidth: 280, maxWidth: 420 }}
              disabled={availableToAdd.length === 0}
            >
              {availableToAdd.length === 0 && <option value="">No matches</option>}
              {availableToAdd.slice(0, 20).map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} ({exerciseUnitLabel(exercise.unit)}{exercise.supportsWeight ? " + weight" : ""})
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAddSelectedExercise} style={styles.smallBtn} disabled={!activeSelectedExerciseId}>
              Add Selected
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Create Custom</div>
            <div className="mobileWorkoutCreateRow" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={customUnit} onChange={(event) => setCustomUnit(event.target.value as "REPS" | "TIME")} style={{ ...inputStyle, width: 140 }}>
                <option value="REPS">Rep-based</option>
                <option value="TIME">Timed</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={customSupportsWeight}
                  onChange={(event) => setCustomSupportsWeight(event.target.checked)}
                />
                Supports Weight
              </label>
              <button type="button" onClick={handleCreateExercise} style={styles.smallBtn} disabled={!exerciseQuery.trim() || creatingExercise}>
                {creatingExercise ? "Creating..." : hasExactMatch ? "Use Matching Exercise" : "Create Exercise"}
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>
              {customUnit === "TIME"
                ? "Timed exercises log seconds per set. Search ignores punctuation, so names like Pull-Up and Pull Up match the same way."
                : "Rep-based exercises log reps per set. Search ignores punctuation, so names like Pull-Up and Pull Up match the same way."}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {createExerciseHelp}
            </div>
          </div>

          {exerciseError && (
            <div style={{ fontSize: 12, color: "#fca5a5" }}>
              {exerciseError}
            </div>
          )}
        </div>
        </div>
      </FormSection>

      {blocks.length === 0 && emptyStateHelp ? (
        <div className="mobileCard" style={{ ...styles.card, fontSize: 13, opacity: 0.82 }}>{emptyStateHelp}</div>
      ) : null}

      {blocks.map((block) => {
        const showReps = block.unit === "REPS";
        const showTime = block.unit === "TIME";
        const showWeight = block.supportsWeight;
        const metricLabel = exerciseUnitFieldLabel(block.unit);

        return (
          <div key={block.exerciseId} className="mobileCard" style={styles.card}>
            <div className="mobileWorkoutBlockHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{block.name}</div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  {exerciseUnitLabel(block.unit)} {showWeight ? "| Weighted" : ""} | Leave every row blank to keep this exercise on the routine without logging it today.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => addRow(block.exerciseId)} style={styles.smallBtn}>
                  + set
                </button>
                <button type="button" onClick={() => removeExercise(block.exerciseId)} style={styles.warnBtn}>
                  Remove Exercise
                </button>
              </div>
            </div>

            <div className="mobileWorkoutSetList" style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {block.rows.map((row) => (
                <div key={row.setNumber} className="mobileWorkoutSetCard" style={styles.setCard}>
                  <div className="mobileWorkoutSetRow" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4, opacity: 0.78 }}>Set {row.setNumber}</div>
                    <button
                      type="button"
                      onClick={() => removeRow(block.exerciseId, row.setNumber)}
                      style={styles.smallBtn}
                    >
                      Remove Set
                    </button>
                  </div>
                  <div className="mobileWorkoutSetGrid mobileFormGrid" style={{ display: "grid", gap: 10, gridTemplateColumns: `repeat(${showWeight && (showReps || showTime) ? 2 : 1}, minmax(0, 1fr))` }}>
                    {showWeight && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={styles.fieldLabel}>Weight (lb)</label>
                        <input
                          style={inputStyle}
                          value={row.weightLb ?? ""}
                          inputMode="decimal"
                          onChange={(event) => updateCell(block.exerciseId, row.setNumber, "weightLb", event.target.value)}
                        />
                      </div>
                    )}
                    {showReps && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={styles.fieldLabel}>{metricLabel}</label>
                        <input
                          style={inputStyle}
                          value={row.reps ?? ""}
                          inputMode="numeric"
                          onChange={(event) => updateCell(block.exerciseId, row.setNumber, "reps", event.target.value)}
                        />
                      </div>
                    )}
                    {showTime && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={styles.fieldLabel}>{metricLabel}</label>
                        <input
                          style={inputStyle}
                          value={row.seconds ?? ""}
                          inputMode="numeric"
                          onChange={(event) => updateCell(block.exerciseId, row.setNumber, "seconds", event.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <FormActions
        primaryLabel={saveLabel}
        primaryPendingLabel={savingLabel}
        saving={saving}
        onPrimary={handleSave}
        backHref={backHref}
      />
    </FormStack>
  );
}

const styles = {
  addPanel: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(128,128,128,0.06)",
    display: "grid",
    gap: 12,
  },
  card: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(128,128,128,0.06)",
  },
  setCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
  },
  fieldLabel: { fontSize: 12, fontWeight: 800, opacity: 0.8 },
  smallBtn: {
    minHeight: 38,
    padding: "7px 11px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "rgba(128,128,128,0.10)",
    fontWeight: 800,
  },
  warnBtn: {
    minHeight: 38,
    padding: "7px 11px",
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,0.45)",
    background: "rgba(220,38,38,0.10)",
    color: "inherit",
    fontWeight: 800,
  },
  smartDefaultNote: {
    border: "1px solid rgba(84,203,130,0.35)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(84,203,130,0.08)",
    fontSize: 12,
    opacity: 0.86,
  },
};
