"use client";

import { useMemo, useState } from "react";
import {
  GOAL_METRIC_LABELS,
  GOAL_TARGET_TYPE_LABELS,
  GOAL_TIMEFRAME_LABELS,
  GOAL_TYPE_LABELS,
  type GoalMetricTypeValue,
  type GoalTargetTypeValue,
  type GoalTimeframeValue,
  type GoalTypeValue,
  getAllowedMetricTypes,
} from "@/lib/goals-config";
import type { GoalFormOptions } from "@/lib/goals";
import { formInputStyle } from "./ui";

type GoalFormInitial = {
  id?: string;
  name: string;
  goalType: GoalTypeValue;
  targetType: GoalTargetTypeValue;
  targetId: string;
  metricType: GoalMetricTypeValue;
  timeframe: GoalTimeframeValue;
  targetValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes: string;
  benchmarkDistanceMi: string;
  benchmarkLabel: string;
};

function splitSeconds(value: number) {
  const total = Math.max(0, Math.round(value));
  return {
    minutes: String(Math.floor(total / 60)),
    seconds: String(total % 60),
  };
}

function metricInputMeta(metricType: GoalMetricTypeValue) {
  if (metricType === "DISTANCE") return { label: "Target miles", step: "0.1" };
  if (metricType === "MAX_WEIGHT") return { label: "Target weight (lb)", step: "0.5" };
  if (metricType === "VOLUME") return { label: "Target volume (lb)", step: "1" };
  if (metricType === "REPS") return { label: "Target reps", step: "1" };
  if (metricType === "SETS") return { label: "Target sets", step: "1" };
  if (metricType === "SESSIONS") return { label: "Target sessions", step: "1" };
  if (metricType === "COMPLETED") return { label: "Target completions", step: "1" };
  return { label: "Target value", step: "1" };
}

export default function GoalForm({
  action,
  options,
  submitLabel,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: GoalFormOptions;
  submitLabel: string;
  initial: GoalFormInitial;
}) {
  const [goalType, setGoalType] = useState<GoalTypeValue>(initial.goalType);
  const [targetType, setTargetType] = useState<GoalTargetTypeValue>(initial.targetType);
  const [metricType, setMetricType] = useState<GoalMetricTypeValue>(initial.metricType);
  const [targetId, setTargetId] = useState(initial.targetId);
  const [rawTargetValue, setRawTargetValue] = useState(String(initial.targetValue || ""));
  const [durationParts, setDurationParts] = useState(splitSeconds(initial.targetValue || 0));
  const [benchmarkDistanceMi, setBenchmarkDistanceMi] = useState(initial.benchmarkDistanceMi);
  const [benchmarkLabel, setBenchmarkLabel] = useState(initial.benchmarkLabel);

  const allowedMetrics = useMemo(() => getAllowedMetricTypes(goalType, targetType), [goalType, targetType]);

  const activeTargetOptions = useMemo(() => {
    if (targetType === "ROUTINE") return options.routines;
    if (targetType === "EXERCISE") return options.exercises;
    if (targetType === "CARDIO") return options.cardioTargets;
    return options.groups;
  }, [options, targetType]);

  const effectiveMetricType = allowedMetrics.includes(metricType)
    ? metricType
    : (allowedMetrics[0] ?? "SESSIONS");

  const effectiveTargetId = activeTargetOptions.some((option) => option.id === targetId)
    ? targetId
    : (activeTargetOptions[0]?.id ?? "");

  const canonicalTargetValue = useMemo(() => {
    if (effectiveMetricType === "DURATION" || effectiveMetricType === "MAX_DURATION" || effectiveMetricType === "PACE") {
      const minutes = Number(durationParts.minutes || "0");
      const seconds = Number(durationParts.seconds || "0");
      const total = minutes * 60 + seconds;
      return Number.isFinite(total) ? String(total) : "";
    }
    return rawTargetValue;
  }, [durationParts, effectiveMetricType, rawTargetValue]);

  const metricMeta = metricInputMeta(effectiveMetricType);

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {initial.id ? <input type="hidden" name="goalId" value={initial.id} /> : null}
      <input type="hidden" name="targetValue" value={canonicalTargetValue} />

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Basics</div>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span>Goal name</span>
            <input name="name" defaultValue={initial.name} style={formInputStyle} placeholder="Bench 225 by summer" />
          </label>
          <label style={fieldStyle}>
            <span>Goal type</span>
            <select name="goalType" value={goalType} onChange={(event) => setGoalType(event.target.value as GoalTypeValue)} style={formInputStyle}>
              {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Timeframe</span>
            <select name="timeframe" defaultValue={initial.timeframe} style={formInputStyle}>
              {Object.entries(GOAL_TIMEFRAME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Target</div>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span>Target type</span>
            <select name="targetType" value={targetType} onChange={(event) => setTargetType(event.target.value as GoalTargetTypeValue)} style={formInputStyle}>
              {Object.entries(GOAL_TARGET_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Specific target</span>
            <select name="targetId" value={effectiveTargetId} onChange={(event) => setTargetId(event.target.value)} style={formInputStyle}>
              {activeTargetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {activeTargetOptions.find((option) => option.id === effectiveTargetId)?.subtitle ? (
              <span style={hintStyle}>{activeTargetOptions.find((option) => option.id === effectiveTargetId)?.subtitle}</span>
            ) : null}
          </label>
          <label style={fieldStyle}>
            <span>Metric</span>
            <select name="metricType" value={effectiveMetricType} onChange={(event) => setMetricType(event.target.value as GoalMetricTypeValue)} style={formInputStyle}>
              {allowedMetrics.map((value) => (
                <option key={value} value={value}>
                  {GOAL_METRIC_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Target Value</div>
        <div style={gridStyle}>
          {effectiveMetricType === "DURATION" || effectiveMetricType === "MAX_DURATION" || effectiveMetricType === "PACE" ? (
            <>
              <label style={fieldStyle}>
                <span>{effectiveMetricType === "PACE" ? "Target time minutes" : "Target minutes"}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={durationParts.minutes}
                  onChange={(event) => setDurationParts((current) => ({ ...current, minutes: event.target.value }))}
                  style={formInputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span>{effectiveMetricType === "PACE" ? "Target time seconds" : "Target seconds"}</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={durationParts.seconds}
                  onChange={(event) => setDurationParts((current) => ({ ...current, seconds: event.target.value }))}
                  style={formInputStyle}
                />
              </label>
            </>
          ) : (
            <label style={fieldStyle}>
              <span>{metricMeta.label}</span>
              <input
                type="number"
                min="0"
                step={metricMeta.step}
                value={rawTargetValue}
                onChange={(event) => setRawTargetValue(event.target.value)}
                style={formInputStyle}
              />
            </label>
          )}

          {effectiveMetricType === "PACE" ? (
            <>
              <label style={fieldStyle}>
                <span>Benchmark distance (mi)</span>
                <input
                  name="benchmarkDistanceMi"
                  type="number"
                  min="0"
                  step="0.01"
                  value={benchmarkDistanceMi}
                  onChange={(event) => setBenchmarkDistanceMi(event.target.value)}
                  style={formInputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span>Benchmark label</span>
                <input
                  name="benchmarkLabel"
                  value={benchmarkLabel}
                  onChange={(event) => setBenchmarkLabel(event.target.value)}
                  style={formInputStyle}
                  placeholder="5K"
                />
              </label>
            </>
          ) : null}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Dates & Notes</div>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span>Start date</span>
            <input name="startDate" type="date" defaultValue={initial.startDate} style={formInputStyle} />
          </label>
          <label style={fieldStyle}>
            <span>End date</span>
            <input name="endDate" type="date" defaultValue={initial.endDate} style={formInputStyle} />
          </label>
          <label style={{ ...fieldStyle, justifyContent: "center" }}>
            <span>Active</span>
            <input name="isActive" type="checkbox" defaultChecked={initial.isActive} style={{ width: 18, height: 18 }} />
          </label>
        </div>
        <label style={fieldStyle}>
          <span>Notes</span>
          <textarea name="notes" defaultValue={initial.notes} rows={4} style={{ ...formInputStyle, resize: "vertical" }} />
        </label>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" style={submitStyle}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(128,128,128,0.05)",
  display: "grid",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

const submitStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid rgba(34,197,94,0.5)",
  borderRadius: 12,
  background: "rgba(34,197,94,0.12)",
  color: "inherit",
  fontWeight: 800,
};

export type { GoalFormInitial };
