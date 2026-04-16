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

  function select(next: "REPS" | "TIME") {
    if (next === unit || isPending) return;
    setUnit(next);
    startTransition(async () => {
      await switchRoutineExerciseMetric({ routineId, routineExerciseId, unit: next });
    });
  }

  const pill = (label: "REPS" | "TIME"): React.CSSProperties => ({
    padding: "5px 12px",
    border: "none",
    background: unit === label ? "rgba(115,220,152,0.22)" : "rgba(128,128,128,0.08)",
    color: "inherit",
    fontWeight: unit === label ? 900 : 700,
    fontSize: 12,
    cursor: isPending ? "default" : "pointer",
    opacity: isPending ? 0.6 : 1,
    letterSpacing: 0.3,
    borderRight: label === "REPS" ? "1px solid rgba(128,128,128,0.3)" : undefined,
  });

  return (
    <div
      style={{
        display: "flex",
        border: "1px solid rgba(128,128,128,0.45)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <button type="button" onClick={() => select("REPS")} disabled={isPending} style={pill("REPS")}>
        REPS
      </button>
      <button type="button" onClick={() => select("TIME")} disabled={isPending} style={pill("TIME")}>
        TIME
      </button>
    </div>
  );
}
