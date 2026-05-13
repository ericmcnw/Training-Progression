"use client";

import { useMemo, useState } from "react";
import type { RoutineFrequencyUnit } from "@/generated/prisma";
import { formatRoutineTargetLabel } from "@/lib/routine-frequency";

export default function RoutineFrequencyTargetFields({
  initialCount,
  initialUnit,
  initialInterval,
  initialEnabled,
  // Substitutes: other routines that satisfy this habit on days the primary
  // wasn't done (e.g. climbing covers a daily hangboard). Days with only a
  // substitute log render as "covered" in the heatmap and still count toward
  // the streak. Empty list → behavior unchanged from before.
  availableSubstituteRoutines = [],
  initialSubstituteRoutineIds = [],
}: {
  initialCount?: number | null;
  initialUnit?: RoutineFrequencyUnit | null;
  initialInterval?: number | null;
  initialEnabled?: boolean;
  availableSubstituteRoutines?: Array<{ id: string; name: string }>;
  initialSubstituteRoutineIds?: string[];
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
  const [substituteIds, setSubstituteIds] = useState<Set<string>>(
    () => new Set(initialSubstituteRoutineIds)
  );

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

          {availableSubstituteRoutines.length > 0 ? (
            <div style={substitutesBlockStyle}>
              <div style={substitutesHeaderStyle}>
                <span style={{ fontWeight: 800, fontSize: 12 }}>Covered by</span>
                <span style={substitutesHintStyle}>
                  Pick routines that <em>cover</em> this goal. On a day you log one of them (and not the primary), the slot renders as <strong>covered</strong> instead of missed — the streak keeps going. Examples: a climb covers your daily fingers work, or it covers a pull-day slot in a 3×/week strength goal.
                </span>
              </div>
              <div style={substitutesListStyle}>
                {availableSubstituteRoutines.map((r) => {
                  const checked = substituteIds.has(r.id);
                  return (
                    <label key={r.id} style={substituteRowStyle}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSubstituteIds((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                          });
                        }}
                      />
                      {checked ? (
                        <input type="hidden" name="substituteRoutineId" value={r.id} />
                      ) : null}
                      <span style={{ fontSize: 13 }}>{r.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
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

const substitutesBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px dashed rgba(132,204,255,0.32)",
  background: "rgba(132,204,255,0.04)",
};

const substitutesHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const substitutesHintStyle: React.CSSProperties = {
  fontSize: 11.5,
  opacity: 0.7,
  lineHeight: 1.4,
};

const substitutesListStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  maxHeight: 180,
  overflowY: "auto",
};

const substituteRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  cursor: "pointer",
};
