"use client";

import { useState, useTransition } from "react";
import { switchRoutineExerciseMetric } from "./actions";

export default function TemplateMetricControl({
  routineId,
  routineExerciseId,
  initialUnit,
}: {
  routineId: string;
  routineExerciseId: string;
  initialUnit: "REPS" | "TIME";
}) {
  const [unit, setUnit] = useState<"REPS" | "TIME">(initialUnit);
  const [isPending, startTransition] = useTransition();

  function onSet() {
    startTransition(async () => {
      await switchRoutineExerciseMetric({ routineId, routineExerciseId, unit });
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <label style={{ fontSize: 13, fontWeight: 800, opacity: 0.85 }}>Metric</label>
      <select
        name={`metric:${routineExerciseId}`}
        form="template-save-form"
        value={unit}
        onChange={(event) => setUnit(event.target.value as "REPS" | "TIME")}
        style={{
          padding: "7px 8px",
          border: "1px solid rgba(128,128,128,0.6)",
          borderRadius: 10,
          background: "rgba(128,128,128,0.08)",
          color: "inherit",
          minWidth: 120,
        }}
      >
        <option value="REPS">REPS</option>
        <option value="TIME">TIME</option>
      </select>
      <button
        type="button"
        onClick={onSet}
        disabled={isPending}
        style={{
          padding: "7px 10px",
          border: "1px solid rgba(128,128,128,0.8)",
          borderRadius: 10,
          background: "rgba(128,128,128,0.12)",
          color: "inherit",
          fontWeight: 900,
        }}
      >
        {isPending ? "Saving..." : "Set"}
      </button>
    </div>
  );
}

