"use client";

import { compareExerciseNames, condensedExerciseName, exerciseMatchesQuery, exerciseUnitLabel, normalizeExerciseName } from "@/lib/exercises";
import { useMemo, useState } from "react";
import { addExerciseToRoutine } from "./actions";

type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  libraryKind?: "STRENGTH" | "CONDITIONING" | "MOBILITY" | "STRETCH" | "BREATHWORK" | "SKILL";
};

export default function ExercisePicker({
  routineId,
  available,
}: {
  routineId: string;
  available: ExerciseOption[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");
  const [unit, setUnit] = useState<"REPS" | "TIME">("REPS");
  const [supportsWeight, setSupportsWeight] = useState(false);

  const filtered = useMemo(() => {
    const sorted = [...available].sort((left, right) => compareExerciseNames(left.name, right.name));
    if (!query.trim()) return sorted.slice(0, 12);
    return sorted.filter((exercise) => exerciseMatchesQuery(exercise.name, query)).slice(0, 12);
  }, [available, query]);

  const activeSelectedId = filtered.some((exercise) => exercise.id === selectedId)
    ? selectedId
    : filtered[0]?.id ?? "";

  const hasExactMatch = useMemo(() => {
    const normalizedQuery = condensedExerciseName(query);
    if (!normalizedQuery) return false;
    return available.some((exercise) => condensedExerciseName(exercise.name) === normalizedQuery);
  }, [available, query]);

  const normalizedQuery = normalizeExerciseName(query);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6, maxWidth: 640 }}>
        <label style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Search Existing Exercises</label>
        <div style={{ fontSize: 12, opacity: 0.72 }}>
          Showing the workout library by default, so stretch, mobility, and breathwork entries stay in guided flows unless you classify them differently.
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, even without punctuation"
          style={input}
        />
      </div>

      <form action={addExerciseToRoutine} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input type="hidden" name="routineId" value={routineId} />
        <input type="hidden" name="mode" value="existing" />
        <select
          name="exerciseId"
          style={{ ...input, minWidth: 340 }}
          value={activeSelectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={filtered.length === 0}
        >
          {filtered.length === 0 && <option value="">No matches</option>}
          {filtered.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name} ({exerciseUnitLabel(exercise.unit)}{exercise.supportsWeight ? " + weight" : ""})
            </option>
          ))}
        </select>
        <button type="submit" style={btn} disabled={!activeSelectedId}>
          Add Selected
        </button>
      </form>

      <form action={addExerciseToRoutine} style={{ display: "grid", gap: 10 }}>
        <input type="hidden" name="routineId" value={routineId} />
        <input type="hidden" name="mode" value="new" />

        <div style={{ fontWeight: 800, fontSize: 13 }}>Create Custom Exercise Inline</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            name="customName"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Custom exercise name"
            style={{ ...input, minWidth: 300 }}
          />
          <select name="unit" value={unit} onChange={(event) => setUnit(event.target.value as "REPS" | "TIME")} style={input}>
            <option value="REPS">Rep-based</option>
            <option value="TIME">Timed</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
            <input
              name="supportsWeight"
              type="checkbox"
              checked={supportsWeight}
              onChange={(event) => setSupportsWeight(event.target.checked)}
            />
            Supports Weight
          </label>
          <button type="submit" style={btn} disabled={!normalizedQuery}>
            {hasExactMatch ? "Add Exact Match" : "Create + Add"}
          </button>
        </div>

        {!hasExactMatch && normalizedQuery && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            No exact match found for &quot;{normalizedQuery}&quot;. Submitting will create both metric variants
            (Reps + Time) and attach the selected metric.
          </div>
        )}
      </form>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
};

const btn: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 900,
};
