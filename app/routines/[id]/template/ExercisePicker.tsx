"use client";

import { useMemo, useState } from "react";
import { addExerciseToRoutine } from "./actions";

type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

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
    const q = query.trim().toLowerCase();
    if (!q) return available.slice(0, 12);
    return available.filter((exercise) => exercise.name.toLowerCase().includes(q)).slice(0, 12);
  }, [available, query]);

  const activeSelectedId = filtered.some((exercise) => exercise.id === selectedId)
    ? selectedId
    : filtered[0]?.id ?? "";

  const hasExactMatch = useMemo(() => {
    const normalizedQuery = normalizeName(query);
    if (!normalizedQuery) return false;
    return available.some((exercise) => normalizeName(exercise.name) === normalizedQuery);
  }, [available, query]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6, maxWidth: 640 }}>
        <label style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Search Existing Exercises</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type to filter exercises..."
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
              {exercise.name} ({exercise.unit}{exercise.supportsWeight ? "+wt" : ""})
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
            <option value="REPS">REPS</option>
            <option value="TIME">TIME</option>
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
          <button type="submit" style={btn} disabled={!query.trim()}>
            {hasExactMatch ? "Add Exact Match" : "Create + Add"}
          </button>
        </div>

        {!hasExactMatch && query.trim() && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            No exact match found for &quot;{query.trim()}&quot;. Submitting will create both metric variants
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
