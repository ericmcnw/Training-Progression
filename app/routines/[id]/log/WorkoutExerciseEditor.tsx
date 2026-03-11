"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
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

function defaultRows(count = 3) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    setNumber: index + 1,
  }));
}

export default function WorkoutExerciseEditor({
  initialNotes,
  initialPerformedAt,
  initialBlocks,
  availableExercises,
  saveLabel,
  savingLabel,
  backHref,
  onSave,
}: {
  initialNotes: string;
  initialPerformedAt: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  saveLabel: string;
  savingLabel: string;
  backHref: string;
  onSave: (payload: SavePayload) => Promise<void>;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(initialPerformedAt);
  const [saving, setSaving] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks);

  const availableToAdd = useMemo(() => {
    const activeIds = new Set(blocks.map((block) => block.exerciseId));
    const query = exerciseQuery.trim().toLowerCase();
    return availableExercises.filter((exercise) => {
      if (activeIds.has(exercise.id)) return false;
      if (!query) return true;
      return exercise.name.toLowerCase().includes(query);
    });
  }, [availableExercises, blocks, exerciseQuery]);

  function addExercise(exerciseId: string) {
    const exercise = availableExercises.find((item) => item.id === exerciseId);
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

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 16 }}>
      <div>
        <label style={styles.label}>Performed at</label>
        <input
          type="datetime-local"
          style={styles.input}
          value={performedAtLocal}
          onChange={(event) => setPerformedAtLocal(event.target.value)}
        />
      </div>

      <div>
        <label style={styles.label}>Notes (optional)</label>
        <textarea
          style={{ ...styles.input, height: 70 }}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div style={styles.addPanel}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>Add Exercise To This Routine</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Saving here updates the routine template too. Remove a block to remove it from the routine.
          </div>
        </div>
        <input
          style={{ ...styles.input, minWidth: 260 }}
          value={exerciseQuery}
          onChange={(event) => setExerciseQuery(event.target.value)}
          placeholder="Filter exercises..."
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableToAdd.slice(0, 10).map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => addExercise(exercise.id)}
              style={styles.smallBtn}
            >
              + {exercise.name}
            </button>
          ))}
          {availableToAdd.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              No matching exercises available. Create one in Exercises if needed.
            </div>
          )}
        </div>
      </div>

      {blocks.map((block) => {
        const showReps = block.unit === "REPS";
        const showTime = block.unit === "TIME";
        const showWeight = block.supportsWeight;

        return (
          <div key={block.exerciseId} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{block.name}</div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  Leave every row blank to keep this exercise on the routine without logging it today.
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

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Set</th>
                    {showReps && <th style={styles.th}>Reps</th>}
                    {showTime && <th style={styles.th}>Time (sec)</th>}
                    {showWeight && <th style={styles.th}>Weight (lb)</th>}
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.setNumber}>
                      <td style={styles.tdCenter}>{row.setNumber}</td>
                      {showReps && (
                        <td style={styles.td}>
                          <input
                            style={styles.input}
                            value={row.reps ?? ""}
                            inputMode="numeric"
                            onChange={(event) => updateCell(block.exerciseId, row.setNumber, "reps", event.target.value)}
                          />
                        </td>
                      )}
                      {showTime && (
                        <td style={styles.td}>
                          <input
                            style={styles.input}
                            value={row.seconds ?? ""}
                            inputMode="numeric"
                            onChange={(event) => updateCell(block.exerciseId, row.setNumber, "seconds", event.target.value)}
                          />
                        </td>
                      )}
                      {showWeight && (
                        <td style={styles.td}>
                          <input
                            style={styles.input}
                            value={row.weightLb ?? ""}
                            inputMode="decimal"
                            onChange={(event) => updateCell(block.exerciseId, row.setNumber, "weightLb", event.target.value)}
                          />
                        </td>
                      )}
                      <td style={styles.tdCenter}>
                        <button
                          type="button"
                          onClick={() => removeRow(block.exerciseId, row.setNumber)}
                          style={styles.smallBtn}
                        >
                          -
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={styles.bigBtn}>
          {saving ? savingLabel : saveLabel}
        </button>
        <Link href={backHref} style={styles.linkBtn}>
          Back
        </Link>
      </div>
    </div>
  );
}

const styles = {
  label: { display: "block", fontWeight: 800, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.06)",
  },
  addPanel: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
    display: "grid",
    gap: 10,
  },
  card: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
  th: {
    textAlign: "left" as const,
    borderBottom: "1px solid rgba(128,128,128,0.35)",
    padding: "8px 6px",
    fontSize: 12,
    opacity: 0.85,
  },
  td: { borderBottom: "1px solid rgba(128,128,128,0.18)", padding: 6 },
  tdCenter: {
    borderBottom: "1px solid rgba(128,128,128,0.18)",
    padding: 6,
    textAlign: "center" as const,
    width: 50,
  },
  smallBtn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "rgba(128,128,128,0.10)",
    fontWeight: 800,
  },
  warnBtn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(220,38,38,0.45)",
    background: "rgba(220,38,38,0.10)",
    color: "inherit",
    fontWeight: 800,
  },
  bigBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "rgba(128,128,128,0.12)",
    fontWeight: 900,
  },
  linkBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "rgba(128,128,128,0.12)",
    fontWeight: 900,
    textDecoration: "none",
    color: "inherit",
  },
};
