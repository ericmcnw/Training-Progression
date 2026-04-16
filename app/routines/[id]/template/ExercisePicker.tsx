"use client";

import { compareExerciseNames, exerciseMatchesQuery, exerciseUnitLabel, normalizeExerciseName } from "@/lib/exercises";
import { useMemo, useState } from "react";
import type React from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [createName, setCreateName] = useState("");
  const [unit, setUnit] = useState<"REPS" | "TIME">("REPS");
  const [supportsWeight, setSupportsWeight] = useState(false);

  const filtered = useMemo(() => {
    const sorted = [...available].sort((a, b) => compareExerciseNames(a.name, b.name));
    if (!searchQuery.trim()) return sorted.slice(0, 10);
    return sorted.filter((ex) => exerciseMatchesQuery(ex.name, searchQuery)).slice(0, 12);
  }, [available, searchQuery]);

  const normalizedQuery = normalizeExerciseName(createName);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Search */}
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Search Existing</label>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Includes strength, conditioning, skill, mobility, and stretch. Breathwork stays in guided flows.
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type to filter…"
          style={inputStyle}
        />
      </div>

      {/* Filtered list */}
      <div style={{ display: "grid", gap: 4, maxHeight: 300, overflowY: "auto" }}>
        {filtered.length === 0 && searchQuery.trim() && (
          <div style={{ fontSize: 12, opacity: 0.65, padding: "6px 0" }}>
            No matches for &quot;{searchQuery}&quot; — create one below.
          </div>
        )}
        {filtered.length === 0 && !searchQuery.trim() && available.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.65, padding: "6px 0" }}>
            All exercises are already attached.
          </div>
        )}
        {filtered.map((exercise) => (
          <form key={exercise.id} action={addExerciseToRoutine} style={{ display: "contents" }}>
            <input type="hidden" name="routineId" value={routineId} />
            <input type="hidden" name="mode" value="existing" />
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <button type="submit" style={listItem}>
              <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{exercise.name}</div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 1 }}>
                  {exerciseUnitLabel(exercise.unit)}{exercise.supportsWeight ? " · Weighted" : ""}
                </div>
              </div>
              <span style={addBadge}>+ Add</span>
            </button>
          </form>
        ))}
      </div>

      {/* Create new */}
      <div style={{ borderTop: "1px solid rgba(128,128,128,0.25)", paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82, marginBottom: 8 }}>Create New Exercise</div>
        <form action={addExerciseToRoutine} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="routineId" value={routineId} />
          <input type="hidden" name="mode" value="new" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              name="customName"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Exercise name"
              style={{ ...inputStyle, flex: "1 1 160px", minWidth: 140 }}
            />
            <select
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as "REPS" | "TIME")}
              style={{ ...inputStyle, width: 120, flex: "0 0 auto" }}
            >
              <option value="REPS">Rep-based</option>
              <option value="TIME">Timed</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
              <input
                name="supportsWeight"
                type="checkbox"
                checked={supportsWeight}
                onChange={(e) => setSupportsWeight(e.target.checked)}
              />
              Weighted
            </label>
            <button type="submit" style={createBtn} disabled={!normalizedQuery}>
              Create + Add
            </button>
          </div>
          {normalizedQuery && (
            <div style={{ fontSize: 11, opacity: 0.65 }}>
              Will create both metric variants (Reps + Time) and attach the selected one.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  width: "100%",
};

const listItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.22)",
  background: "rgba(128,128,128,0.06)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 52,
};

const addBadge: React.CSSProperties = {
  padding: "4px 9px",
  borderRadius: 8,
  border: "1px solid rgba(115,220,152,0.45)",
  background: "rgba(115,220,152,0.1)",
  fontWeight: 800,
  fontSize: 12,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const createBtn: React.CSSProperties = {
  padding: "8px 14px",
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
