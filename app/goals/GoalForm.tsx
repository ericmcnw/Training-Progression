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
import { GOAL_TEMPLATES, getGoalTemplate, type GoalTemplateKey } from "@/lib/goal-templates";
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
  sessionMetricDefinitionId: string;
  sessionMetricTarget: string;
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

function templateForCurrentConfig(params: {
  goalType: GoalTypeValue;
  targetType: GoalTargetTypeValue;
  metricType: GoalMetricTypeValue;
  timeframe: GoalTimeframeValue;
}) {
  return (
    GOAL_TEMPLATES.find(
      (template) =>
        template.goalType === params.goalType &&
        template.targetType === params.targetType &&
        template.metricType === params.metricType &&
        template.timeframe === params.timeframe
    )?.key ?? GOAL_TEMPLATES[0].key
  );
}

export default function GoalForm({
  action,
  options,
  submitLabel,
  initial,
  mode = "advanced",
  initialTemplateKey,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: GoalFormOptions;
  submitLabel: string;
  initial: GoalFormInitial;
  mode?: "guided" | "advanced";
  initialTemplateKey?: GoalTemplateKey;
}) {
  const [goalType, setGoalType] = useState<GoalTypeValue>(initial.goalType);
  const [targetType, setTargetType] = useState<GoalTargetTypeValue>(initial.targetType);
  const [metricType, setMetricType] = useState<GoalMetricTypeValue>(initial.metricType);
  const [timeframe, setTimeframe] = useState<GoalTimeframeValue>(initial.timeframe);
  const [targetId, setTargetId] = useState(initial.targetId);
  const [rawTargetValue, setRawTargetValue] = useState(String(initial.targetValue || ""));
  const [durationParts, setDurationParts] = useState(splitSeconds(initial.targetValue || 0));
  const [benchmarkDistanceMi, setBenchmarkDistanceMi] = useState(initial.benchmarkDistanceMi);
  const [benchmarkLabel, setBenchmarkLabel] = useState(initial.benchmarkLabel);
  const [sessionMetricDefinitionId, setSessionMetricDefinitionId] = useState(initial.sessionMetricDefinitionId);
  const [sessionMetricTarget, setSessionMetricTarget] = useState(initial.sessionMetricTarget);
  const [templateKey, setTemplateKey] = useState<GoalTemplateKey>(
    initialTemplateKey ??
      templateForCurrentConfig({
        goalType: initial.goalType,
        targetType: initial.targetType,
        metricType: initial.metricType,
        timeframe: initial.timeframe,
      })
  );

  const allowedMetrics = useMemo(() => getAllowedMetricTypes(goalType, targetType), [goalType, targetType]);

  const activeTargetOptions = useMemo(() => {
    if (targetType === "ROUTINE") return options.routines;
    if (targetType === "EXERCISE") return options.exercises;
    if (targetType === "CARDIO") return options.cardioTargets;
    if (targetType === "SESSION_TEMPLATE") return options.sessionTemplates;
    return options.groups;
  }, [options, targetType]);

  const effectiveTargetId = activeTargetOptions.some((option) => option.id === targetId)
    ? targetId
    : (activeTargetOptions[0]?.id ?? "");

  const sessionMetricOptions = useMemo(() => {
    if (targetType === "ROUTINE") return options.sessionMetricsByRoutineId[effectiveTargetId] ?? [];
    if (targetType === "SESSION_TEMPLATE") return options.sessionMetricsByTemplateId[effectiveTargetId] ?? [];
    return [];
  }, [effectiveTargetId, options.sessionMetricsByRoutineId, options.sessionMetricsByTemplateId, targetType]);

  const filteredAllowedMetrics = useMemo(() => {
    if (sessionMetricOptions.length > 0) return allowedMetrics;
    return allowedMetrics.filter((value) => value !== "SESSION_METRIC");
  }, [allowedMetrics, sessionMetricOptions.length]);

  const effectiveMetricType = filteredAllowedMetrics.includes(metricType)
    ? metricType
    : (filteredAllowedMetrics[0] ?? "SESSIONS");

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
  const selectedTarget = activeTargetOptions.find((option) => option.id === effectiveTargetId);
  const effectiveSessionMetricDefinitionId =
    sessionMetricOptions.some((option) => option.id === sessionMetricDefinitionId)
      ? sessionMetricDefinitionId
      : (sessionMetricOptions[0]?.id ?? "");

  function applyTemplate(nextTemplateKey: GoalTemplateKey) {
    const template = getGoalTemplate(nextTemplateKey);
    setTemplateKey(nextTemplateKey);
    setGoalType(template.goalType);
    setTargetType(template.targetType);
    setMetricType(template.metricType);
    setTimeframe(template.timeframe);
    setRawTargetValue(String(template.targetValue));
    setDurationParts(splitSeconds(template.targetValue));
    setBenchmarkDistanceMi(template.benchmarkDistanceMi ? String(template.benchmarkDistanceMi) : "");
    setBenchmarkLabel(template.benchmarkLabel ?? "");
    setSessionMetricDefinitionId("");
    setSessionMetricTarget("");
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {initial.id ? <input type="hidden" name="goalId" value={initial.id} /> : null}
      <input type="hidden" name="targetValue" value={canonicalTargetValue} />
      <input type="hidden" name="sessionMetricDefinitionId" value={effectiveSessionMetricDefinitionId} />

      {mode === "guided" ? (
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>Goal Shape</div>
          <div style={templateGridStyle}>
            {GOAL_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => applyTemplate(template.key)}
                style={{
                  ...templateCardStyle,
                  ...(templateKey === template.key ? templateCardActiveStyle : null),
                }}
              >
                <div style={{ fontWeight: 900 }}>{template.label}</div>
                <div style={hintStyle}>{template.description}</div>
              </button>
            ))}
          </div>
          <div style={hintStyle}>
            Pick the closest goal shape. It sets the default goal type, target type, metric, and timeframe for you.
          </div>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>{mode === "guided" ? "Goal Details" : "Basics"}</div>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span>Goal name</span>
            <input
              name="name"
              defaultValue={initial.name}
              style={formInputStyle}
              placeholder={mode === "guided" ? "Weekly running target" : "Bench 225 by summer"}
            />
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
            {selectedTarget?.subtitle ? <span style={hintStyle}>{selectedTarget.subtitle}</span> : null}
          </label>
          {effectiveMetricType === "SESSION_METRIC" ? (
            <>
              <label style={fieldStyle}>
                <span>Session metric</span>
                <select
                  value={effectiveSessionMetricDefinitionId}
                  onChange={(event) => setSessionMetricDefinitionId(event.target.value)}
                  style={formInputStyle}
                >
                  {sessionMetricOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                <span>Metric target</span>
                <input
                  name="sessionMetricTarget"
                  value={sessionMetricTarget}
                  onChange={(event) => setSessionMetricTarget(event.target.value)}
                  style={formInputStyle}
                  placeholder="5, 1200, V6, 5.11a"
                />
              </label>
            </>
          ) : null}
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
          ) : effectiveMetricType !== "SESSION_METRIC" ? (
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
          ) : null}
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
          <label style={fieldStyle}>
            <span>Start date</span>
            <input name="startDate" type="date" defaultValue={initial.startDate} style={formInputStyle} />
          </label>
        </div>
      </section>

      <details style={advancedSectionStyle} open={mode === "advanced"}>
        <summary data-collapsible-summary style={advancedSummaryStyle}>
          Advanced goal settings
        </summary>
        <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
          <section style={sectionStyle}>
            <div style={sectionTitleStyle}>Definition</div>
            <div style={gridStyle}>
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
                <span>Target type</span>
                <select
                  name="targetType"
                  value={targetType}
                  onChange={(event) => {
                    setTargetType(event.target.value as GoalTargetTypeValue);
                    setTargetId("");
                    setSessionMetricDefinitionId("");
                  }}
                  style={formInputStyle}
                >
                  {Object.entries(GOAL_TARGET_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                <span>Metric</span>
                <select name="metricType" value={effectiveMetricType} onChange={(event) => setMetricType(event.target.value as GoalMetricTypeValue)} style={formInputStyle}>
                  {filteredAllowedMetrics.map((value) => (
                    <option key={value} value={value}>
                      {GOAL_METRIC_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                <span>Timeframe</span>
                <select name="timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value as GoalTimeframeValue)} style={formInputStyle}>
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
            <div style={sectionTitleStyle}>Dates & Status</div>
            <div style={gridStyle}>
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
        </div>
      </details>

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

const advancedSectionStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(128,128,128,0.04)",
};

const advancedSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
};

const templateGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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

const templateCardStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.05)",
  color: "inherit",
};

const templateCardActiveStyle: React.CSSProperties = {
  borderColor: "rgba(34,197,94,0.45)",
  background: "rgba(34,197,94,0.12)",
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
