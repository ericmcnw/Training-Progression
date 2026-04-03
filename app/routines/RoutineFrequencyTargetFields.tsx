"use client";

import { useMemo, useState } from "react";
import type { RoutineFrequencyUnit } from "@/generated/prisma";
import { formatRoutineTargetLabel } from "@/lib/routine-frequency";

export default function RoutineFrequencyTargetFields({
  initialCount,
  initialUnit,
  initialInterval,
  initialEnabled,
}: {
  initialCount?: number | null;
  initialUnit?: RoutineFrequencyUnit | null;
  initialInterval?: number | null;
  initialEnabled?: boolean;
}) {
  const hasInitialTarget =
    Number.isFinite(initialCount) &&
    (initialCount ?? 0) > 0 &&
    !!initialUnit &&
    Number.isFinite(initialInterval) &&
    (initialInterval ?? 0) > 0;
  const [enabled, setEnabled] = useState(initialEnabled ?? hasInitialTarget);
  const [count, setCount] = useState(String(initialCount ?? 3));
  const [unit, setUnit] = useState<RoutineFrequencyUnit>(initialUnit ?? "WEEK");
  const [interval, setInterval] = useState(String(initialInterval ?? 1));

  const preview = useMemo(
    () =>
      enabled
        ? formatRoutineTargetLabel({
            targetFrequencyCount: Number(count),
            targetFrequencyUnit: unit,
            targetFrequencyInterval: Number(interval),
          })
        : "No target",
    [count, enabled, interval, unit]
  );

  return (
    <div style={cardStyle}>
      <label style={toggleRowStyle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span style={{ fontWeight: 900 }}>Set target frequency</span>
      </label>

      <input type="hidden" name="frequencyTargetEnabled" value={enabled ? "1" : "0"} />

      {enabled ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={controlsRowStyle}>
            <span style={inlineLabelStyle}>Target:</span>
            <input
              name="targetFrequencyCount"
              style={{ ...inputStyle, width: 84 }}
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
            <span style={inlineLabelStyle}>times per</span>
            <input
              name="targetFrequencyInterval"
              style={{ ...inputStyle, width: 84 }}
              inputMode="numeric"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
            <select
              name="targetFrequencyUnit"
              style={{ ...inputStyle, width: 120 }}
              value={unit}
              onChange={(event) => setUnit(event.target.value as RoutineFrequencyUnit)}
            >
              <option value="DAY">day</option>
              <option value="WEEK">week</option>
              <option value="MONTH">month</option>
            </select>
          </div>
          <div style={helpStyle}>Preview: {preview}</div>
        </div>
      ) : (
        <div style={helpStyle}>Leave this off if the routine is open-ended or you only want to track completions without a target.</div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.05)",
  display: "grid",
  gap: 10,
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const controlsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const inlineLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.74,
  lineHeight: 1.45,
};
