"use client";

import { useState, useTransition } from "react";
import type React from "react";
import { updateDefaultSetsQuiet } from "./actions";

export default function DefaultSetsControl({
  routineId,
  routineExerciseId,
  initialValue,
}: {
  routineId: string;
  routineExerciseId: string;
  initialValue: number;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function update(next: number) {
    if (next < 1 || next > 20) return;
    setValue(next);
    startTransition(async () => {
      await updateDefaultSetsQuiet(routineId, routineExerciseId, next);
    });
  }

  const stepBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900,
    fontSize: 15,
    lineHeight: 1,
    cursor: isPending ? "default" : "pointer",
    opacity: isPending ? 0.5 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>Sets</span>
      <button
        type="button"
        onClick={() => update(value - 1)}
        disabled={value <= 1 || isPending}
        style={stepBtn}
      >
        −
      </button>
      <span style={{ minWidth: 18, textAlign: "center", fontWeight: 900, fontSize: 14 }}>{value}</span>
      <button
        type="button"
        onClick={() => update(value + 1)}
        disabled={value >= 20 || isPending}
        style={stepBtn}
      >
        +
      </button>
    </div>
  );
}
