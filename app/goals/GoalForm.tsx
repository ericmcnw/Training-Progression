"use client";

import { useMemo, useState } from "react";
import {
  GOAL_METRIC_LABELS,
  type GoalMetricTypeValue,
  type GoalTargetTypeValue,
  type GoalTimeframeValue,
  type GoalTypeValue,
  getAllowedMetricTypes,
} from "@/lib/goals-config";
import type { GoalFormOptions } from "@/lib/goals";
import { formInputStyle } from "./ui";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GoalFormInitial = {
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
  groupFrequencyGoalId?: string;
  groupFrequency?: {
    targetCount: number;
    targetInterval: number;
    targetUnit: "DAY" | "WEEK" | "MONTH";
    routineIds: string[];
  };
};

// ─── Config ─────────────────────────────────────────────────────────────────

const GOAL_TYPE_ORDER: GoalTypeValue[] = ["FREQUENCY", "VOLUME", "PERFORMANCE", "COMPLETION"];

const TYPE_ICON: Record<GoalTypeValue, string> = {
  FREQUENCY:   "↻",
  VOLUME:      "∑",
  PERFORMANCE: "◆",
  COMPLETION:  "✓",
};

const TYPE_LABEL: Record<GoalTypeValue, string> = {
  FREQUENCY:   "Frequency",
  VOLUME:      "Volume",
  PERFORMANCE: "Performance",
  COMPLETION:  "Completion",
};

const TYPE_TAGLINE: Record<GoalTypeValue, string> = {
  FREQUENCY:   "How often you show up",
  VOLUME:      "Total output over time",
  PERFORMANCE: "A personal best or benchmark",
  COMPLETION:  "Finish something",
};

const TYPE_ACCENT: Record<GoalTypeValue, { color: string; bg: string; border: string }> = {
  FREQUENCY:   { color: "rgb(129,140,248)", bg: "rgba(129,140,248,0.13)", border: "rgba(129,140,248,0.5)" },
  VOLUME:      { color: "rgb(34,211,238)",  bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.5)"  },
  PERFORMANCE: { color: "rgb(251,191,36)",  bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.5)"  },
  COMPLETION:  { color: "rgb(74,222,128)",  bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.5)"  },
};

type ScopeOption = { value: string; label: string; hint: string };

const SCOPES: Record<GoalTypeValue, ScopeOption[]> = {
  FREQUENCY: [
    { value: "routine",     label: "Routine",      hint: "Track one routine — e.g. Push Day, Climbing" },
    { value: "sessionType", label: "Session type", hint: "Count logs by sport or activity type" },
    { value: "group",       label: "Group",        hint: "Mix of routines counted together" },
  ],
  VOLUME: [
    { value: "routine",  label: "Routine",  hint: "Total output from a single routine" },
    { value: "exercise", label: "Exercise", hint: "Reps, sets, or volume on a lift" },
    { value: "cardio",   label: "Cardio",   hint: "Distance, elevation, or duration" },
    { value: "group",    label: "Group",    hint: "Combined workload across a training group" },
  ],
  PERFORMANCE: [
    { value: "exercise", label: "Lift / movement",  hint: "Best weight or best-set duration for a lift" },
    { value: "cardio",   label: "Cardio benchmark", hint: "Pace, distance, or elevation milestone" },
    { value: "grade",    label: "Grade / metric",   hint: "Climbing grade, session score, or sport metric" },
  ],
  COMPLETION: [
    { value: "routine", label: "Routine", hint: "Complete a routine N times" },
    { value: "cardio",  label: "Cardio",  hint: "Log cardio sessions" },
    { value: "group",   label: "Group",   hint: "Complete any session in a group" },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function scopeToTargetType(goalType: GoalTypeValue, scope: string): GoalTargetTypeValue {
  if (goalType === "FREQUENCY") {
    if (scope === "sessionType") return "SESSION_TEMPLATE";
    return "ROUTINE";
  }
  if (goalType === "VOLUME") {
    if (scope === "exercise") return "EXERCISE";
    if (scope === "cardio")   return "CARDIO";
    if (scope === "group")    return "GROUP";
    return "ROUTINE";
  }
  if (goalType === "PERFORMANCE") {
    if (scope === "exercise") return "EXERCISE";
    if (scope === "cardio")   return "CARDIO";
    return "ROUTINE"; // grade — overridden if template selected
  }
  // COMPLETION
  if (scope === "cardio") return "CARDIO";
  if (scope === "group")  return "GROUP";
  return "ROUTINE";
}

function deriveInitialScope(initial: GoalFormInitial): string {
  const isGroupFreq = !!initial.groupFrequency || !!initial.groupFrequencyGoalId;
  const { goalType, targetType } = initial;
  if (goalType === "FREQUENCY") {
    if (isGroupFreq) return "group";
    if (targetType === "SESSION_TEMPLATE") return "sessionType";
    return "routine";
  }
  if (goalType === "VOLUME") {
    if (targetType === "EXERCISE") return "exercise";
    if (targetType === "CARDIO")   return "cardio";
    if (targetType === "GROUP")    return "group";
    return "routine";
  }
  if (goalType === "PERFORMANCE") {
    if (targetType === "EXERCISE") return "exercise";
    if (targetType === "CARDIO")   return "cardio";
    return "grade";
  }
  if (targetType === "CARDIO") return "cardio";
  if (targetType === "GROUP")  return "group";
  return "routine";
}

function defaultScopeForType(type: GoalTypeValue): string {
  return SCOPES[type][0].value;
}

function defaultMetricForScope(goalType: GoalTypeValue, scope: string): GoalMetricTypeValue {
  if (goalType === "FREQUENCY") return "SESSIONS";
  if (goalType === "COMPLETION") return "COMPLETED";
  if (goalType === "PERFORMANCE") {
    if (scope === "exercise") return "MAX_WEIGHT";
    if (scope === "cardio")   return "PACE";
    return "SESSION_METRIC";
  }
  if (scope === "exercise") return "VOLUME";
  return "DISTANCE";
}

function splitSeconds(value: number) {
  const total = Math.max(0, Math.round(value));
  return { minutes: String(Math.floor(total / 60)), seconds: String(total % 60) };
}

function numericMeta(m: GoalMetricTypeValue): { label: string; step: string; placeholder: string } {
  const map: Partial<Record<GoalMetricTypeValue, { label: string; step: string; placeholder: string }>> = {
    DISTANCE:       { label: "Target distance (miles)",   step: "0.1",  placeholder: "20"   },
    ELEVATION_GAIN: { label: "Target elevation (ft)",     step: "1",    placeholder: "2500" },
    MAX_WEIGHT:     { label: "Target weight (lb)",        step: "2.5",  placeholder: "225"  },
    VOLUME:         { label: "Target volume (lb)",        step: "100",  placeholder: "5000" },
    REPS:           { label: "Target reps",               step: "1",    placeholder: "100"  },
    SETS:           { label: "Target sets",               step: "1",    placeholder: "20"   },
    SESSIONS:       { label: "Sessions per period",       step: "1",    placeholder: "3"    },
    COMPLETED:      { label: "Target completions",        step: "1",    placeholder: "1"    },
  };
  return map[m] ?? { label: "Target value", step: "1", placeholder: "1" };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GoalForm({
  action,
  groupFrequencyAction,
  options,
  submitLabel,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  groupFrequencyAction?: (formData: FormData) => void | Promise<void>;
  options: GoalFormOptions;
  submitLabel: string;
  initial: GoalFormInitial;
}) {
  const [goalType, setGoalType]     = useState<GoalTypeValue>(initial.goalType);
  const [scope, setScope]           = useState<string>(() => deriveInitialScope(initial));
  const [metricType, setMetricType] = useState<GoalMetricTypeValue>(initial.metricType);
  const [timeframe, setTimeframe]   = useState<GoalTimeframeValue>(initial.timeframe);
  const [targetId, setTargetId]     = useState(initial.targetId);

  const [rawTargetValue, setRawTargetValue]     = useState(String(initial.targetValue || ""));
  const [durationParts, setDurationParts]       = useState(splitSeconds(initial.targetValue || 0));
  const [benchmarkDistanceMi, setBenchmarkDistanceMi] = useState(initial.benchmarkDistanceMi);
  const [benchmarkLabel, setBenchmarkLabel]     = useState(initial.benchmarkLabel);
  const [sessionMetricDefinitionId, setSessionMetricDefinitionId] = useState(initial.sessionMetricDefinitionId);
  const [sessionMetricTarget, setSessionMetricTarget] = useState(initial.sessionMetricTarget);

  const [gfTargetCount, setGfTargetCount]   = useState(String(initial.groupFrequency?.targetCount ?? 3));
  const [gfTargetInterval, setGfTargetInterval] = useState(String(initial.groupFrequency?.targetInterval ?? 1));
  const [gfTargetUnit, setGfTargetUnit]     = useState<"DAY" | "WEEK" | "MONTH">(initial.groupFrequency?.targetUnit ?? "WEEK");

  // Whether the grade-scope target is a SESSION_TEMPLATE (vs ROUTINE)
  const [gradeTargetIsTemplate, setGradeTargetIsTemplate] = useState(
    initial.goalType === "PERFORMANCE" && initial.targetType === "SESSION_TEMPLATE"
  );

  const isEditMode       = !!initial.id;
  const isGroupFrequency = goalType === "FREQUENCY" && scope === "group";
  const isGradeScope     = goalType === "PERFORMANCE" && scope === "grade";

  // Combined targets for grade scope (routines + session templates with session metrics)
  const gradeTargets = useMemo(() => [
    ...options.routines
      .filter(r => (options.sessionMetricsByRoutineId[r.id] ?? []).length > 0)
      .map(r => ({ id: r.id, label: r.label, subtitle: r.subtitle, isTemplate: false as const })),
    ...options.sessionTemplates
      .filter(t => (options.sessionMetricsByTemplateId[t.id] ?? []).length > 0)
      .map(t => ({ id: t.id, label: t.label, subtitle: undefined as string | undefined, isTemplate: true as const })),
  ], [options]);

  // Hide grade scope pill if no grade targets exist
  const visibleScopes = useMemo(() => {
    if (goalType !== "PERFORMANCE") return SCOPES[goalType];
    return SCOPES[goalType].filter(s => s.value !== "grade" || gradeTargets.length > 0);
  }, [goalType, gradeTargets.length]);

  // Derive effective target type
  const effectiveTargetType: GoalTargetTypeValue = isGradeScope
    ? (gradeTargetIsTemplate ? "SESSION_TEMPLATE" : "ROUTINE")
    : scopeToTargetType(goalType, scope);

  // Standard target options
  const targetOptions = useMemo(() => {
    if (isGradeScope)                                    return [] as typeof options.routines;
    if (effectiveTargetType === "ROUTINE")               return options.routines;
    if (effectiveTargetType === "EXERCISE")              return options.exercises;
    if (effectiveTargetType === "CARDIO")                return options.cardioTargets;
    if (effectiveTargetType === "SESSION_TEMPLATE")      return options.sessionTemplates;
    return options.groups;
  }, [isGradeScope, effectiveTargetType, options]);

  // Effective targetId (falls back to first in pool)
  const effectiveTargetId = useMemo(() => {
    const pool = isGradeScope ? gradeTargets : targetOptions;
    return pool.some(t => t.id === targetId) ? targetId : (pool[0]?.id ?? "");
  }, [isGradeScope, gradeTargets, targetOptions, targetId]);

  // Session metric options for effective target
  const sessionMetricOptions = useMemo(() => {
    if (effectiveTargetType === "ROUTINE")          return options.sessionMetricsByRoutineId[effectiveTargetId] ?? [];
    if (effectiveTargetType === "SESSION_TEMPLATE") return options.sessionMetricsByTemplateId[effectiveTargetId] ?? [];
    return [] as GoalFormOptions["sessionMetricsByRoutineId"][string];
  }, [effectiveTargetId, effectiveTargetType, options]);

  // Filtered metric list (hide SESSION_METRIC when no metrics available)
  const allowedMetrics  = useMemo(() => getAllowedMetricTypes(goalType, effectiveTargetType), [goalType, effectiveTargetType]);
  const filteredMetrics = useMemo(
    () => sessionMetricOptions.length > 0 ? allowedMetrics : allowedMetrics.filter(m => m !== "SESSION_METRIC"),
    [allowedMetrics, sessionMetricOptions.length]
  );
  const effectiveMetricType: GoalMetricTypeValue = filteredMetrics.includes(metricType)
    ? metricType : (filteredMetrics[0] ?? "SESSIONS");

  // Resolve session metric definition
  const validSessionMetricId = sessionMetricOptions.some(o => o.id === sessionMetricDefinitionId)
    ? sessionMetricDefinitionId
    : (sessionMetricOptions.find(o => o.metricKey === "highest_send_grade" && o.gradeSystem === "BOULDER_V")?.id
       ?? sessionMetricOptions[0]?.id ?? "");
  const selectedSessionMetric = sessionMetricOptions.find(o => o.id === validSessionMetricId) ?? null;

  // Canonical target value (converts mm:ss to seconds when needed)
  const canonicalTargetValue = useMemo(() => {
    if (effectiveMetricType === "DURATION" || effectiveMetricType === "MAX_DURATION" || effectiveMetricType === "PACE") {
      const mins = Number(durationParts.minutes || "0");
      const secs = Number(durationParts.seconds || "0");
      const total = mins * 60 + secs;
      return Number.isFinite(total) ? String(total) : "";
    }
    return rawTargetValue;
  }, [durationParts, effectiveMetricType, rawTargetValue]);

  // Auto-promote grade goals to PERFORMANCE / ONE_TIME on new creates
  function maybePromoteGradeGoal(gradeSystem?: string | null) {
    if (isEditMode || !gradeSystem) return;
    setGoalType("PERFORMANCE");
    setTimeframe("ONE_TIME");
    setScope("grade");
  }

  function handleGoalTypeChange(next: GoalTypeValue) {
    if (next === goalType) return;
    const nextScope = defaultScopeForType(next);
    setGoalType(next);
    setScope(nextScope);
    setMetricType(defaultMetricForScope(next, nextScope));
    setTimeframe(next === "PERFORMANCE" ? "ONE_TIME" : "WEEK");
    setTargetId("");
    setSessionMetricDefinitionId("");
  }

  function handleScopeChange(next: string) {
    if (next === scope) return;
    setScope(next);
    setMetricType(defaultMetricForScope(goalType, next));
    setTimeframe(goalType === "PERFORMANCE" ? "ONE_TIME" : "WEEK");
    setTargetId("");
    setSessionMetricDefinitionId("");
  }

  // Derived display helpers
  const accent         = TYPE_ACCENT[goalType];
  const isDuration     = effectiveMetricType === "DURATION" || effectiveMetricType === "MAX_DURATION";
  const isPace         = effectiveMetricType === "PACE";
  const isSessionMetric = effectiveMetricType === "SESSION_METRIC" && !isGradeScope;

  const perfMetricPills: Array<[GoalMetricTypeValue, string]> =
    scope === "exercise" ? [["MAX_WEIGHT", "Top weight"], ["MAX_DURATION", "Best time"]] :
    scope === "cardio"   ? [["PACE", "Pace"], ["DISTANCE", "Distance"], ["ELEVATION_GAIN", "Elevation"]] :
    [];

  const timeframeOpts: Array<[GoalTimeframeValue, string]> =
    goalType === "PERFORMANCE" ? [["ONE_TIME", "One-time"]] :
    goalType === "COMPLETION"  ? [["ONE_TIME", "One-time"], ["WEEK", "Weekly"], ["MONTH", "Monthly"], ["DAY", "Daily"]] :
    [["DAY", "Daily"], ["WEEK", "Weekly"], ["MONTH", "Monthly"]];

  const numMeta = numericMeta(effectiveMetricType);

  const targetTypeLabel =
    effectiveTargetType === "EXERCISE"        ? "Exercise" :
    effectiveTargetType === "CARDIO"          ? "Cardio target" :
    effectiveTargetType === "SESSION_TEMPLATE"? "Session type" :
    effectiveTargetType === "GROUP"           ? "Group" : "Routine";

  const formAction = isGroupFrequency && groupFrequencyAction ? groupFrequencyAction : action;

  return (
    <form action={formAction} style={{ display: "grid", gap: 22 }}>
      {/* ── Hidden submission fields ─────────────────────────────── */}
      {isGroupFrequency && initial.groupFrequencyGoalId
        ? <input type="hidden" name="id" value={initial.groupFrequencyGoalId} />
        : null}
      {!isGroupFrequency && initial.id
        ? <input type="hidden" name="goalId" value={initial.id} />
        : null}
      {!isGroupFrequency && <>
        <input type="hidden" name="goalType"   value={goalType} />
        <input type="hidden" name="targetType" value={effectiveTargetType} />
        <input type="hidden" name="metricType" value={effectiveMetricType} />
        <input type="hidden" name="timeframe"  value={timeframe} />
        <input type="hidden" name="targetValue" value={canonicalTargetValue} />
        <input type="hidden" name="sessionMetricDefinitionId" value={validSessionMetricId} />
      </>}

      {/* ── Step 1: Goal type ────────────────────────────────────── */}
      <div>
        <div style={stepLabelStyle}>Goal type</div>
        <div style={typeGridStyle}>
          {GOAL_TYPE_ORDER.map(type => {
            const acc = TYPE_ACCENT[type];
            const isActive = goalType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleGoalTypeChange(type)}
                style={{
                  ...typeCardStyle,
                  borderColor: isActive ? acc.border : "rgba(128,128,128,0.22)",
                  background:  isActive ? acc.bg     : "rgba(128,128,128,0.04)",
                }}
              >
                <div style={{ fontSize: 22, lineHeight: 1, color: isActive ? acc.color : "inherit", opacity: isActive ? 1 : 0.45 }}>
                  {TYPE_ICON[type]}
                </div>
                <div style={{ fontWeight: 900, fontSize: 13, marginTop: 7 }}>{TYPE_LABEL[type]}</div>
                <div style={typeTaglineStyle}>{TYPE_TAGLINE[type]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step 2: Scope ────────────────────────────────────────── */}
      <div>
        <div style={stepLabelStyle}>Scope</div>
        <div style={pillRowStyle}>
          {visibleScopes.map(s => {
            const isActive = scope === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => handleScopeChange(s.value)}
                style={{
                  ...scopePillStyle,
                  borderColor: isActive ? accent.border : "rgba(128,128,128,0.28)",
                  background:  isActive ? accent.bg     : "transparent",
                  fontWeight:  isActive ? 900 : 700,
                  color:       isActive ? accent.color  : "inherit",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div style={{ ...hintStyle, marginTop: 7 }}>
          {visibleScopes.find(s => s.value === scope)?.hint}
        </div>
      </div>

      {/* ── Step 3a: Group frequency (special path) ──────────────── */}
      {isGroupFrequency ? (
        <>
          <div style={detailCardStyle}>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Goal name</span>
                <input
                  name="name"
                  defaultValue={initial.name}
                  style={formInputStyle}
                  placeholder="Push Days, Climbing Sessions..."
                  required
                />
              </label>
              <div style={fieldStyle}>
                <span style={fieldLabelStyle}>Target frequency</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    name="targetCount"
                    type="number"
                    min="1"
                    step="1"
                    value={gfTargetCount}
                    onChange={e => setGfTargetCount(e.target.value)}
                    style={{ ...formInputStyle, width: 76 }}
                    inputMode="numeric"
                  />
                  <span style={hintStyle}>times per</span>
                  <input
                    name="targetInterval"
                    type="number"
                    min="1"
                    step="1"
                    value={gfTargetInterval}
                    onChange={e => setGfTargetInterval(e.target.value)}
                    style={{ ...formInputStyle, width: 76 }}
                    inputMode="numeric"
                  />
                  <select
                    name="targetUnit"
                    value={gfTargetUnit}
                    onChange={e => setGfTargetUnit(e.target.value as "DAY" | "WEEK" | "MONTH")}
                    style={{ ...formInputStyle, width: 112 }}
                  >
                    <option value="DAY">day</option>
                    <option value="WEEK">week</option>
                    <option value="MONTH">month</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={detailCardStyle}>
            <div style={stepLabelStyle}>Included routines</div>
            <div style={{ ...hintStyle, marginBottom: 10 }}>Sessions from any checked routine count toward this goal.</div>
            <div style={routineChecklistStyle}>
              {options.routines.map(r => (
                <label key={r.id} style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    name="routineIds"
                    value={r.id}
                    defaultChecked={initial.groupFrequency?.routineIds.includes(r.id) ?? false}
                  />
                  <span style={{ fontSize: 13 }}>
                    {r.label}
                    {r.subtitle ? <span style={hintStyle}> — {r.subtitle}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── Step 3b: Standard detail fields ───────────────────── */
        <div style={detailCardStyle}>
          <div style={fieldGridStyle}>
            {/* Goal name — always shown */}
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Goal name</span>
              <input
                name="name"
                defaultValue={initial.name}
                style={formInputStyle}
                placeholder="Name this goal..."
                required
              />
            </label>

            {/* Grade scope: combined routine + session template picker */}
            {isGradeScope ? (
              <>
                {gradeTargets.length > 0 ? (
                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Routine or session type</span>
                    <select
                      name="targetId"
                      value={effectiveTargetId}
                      onChange={e => {
                        const id = e.target.value;
                        setTargetId(id);
                        const item = gradeTargets.find(t => t.id === id);
                        if (item) {
                          setGradeTargetIsTemplate(item.isTemplate);
                          const metricOpts = item.isTemplate
                            ? (options.sessionMetricsByTemplateId[id] ?? [])
                            : (options.sessionMetricsByRoutineId[id] ?? []);
                          const preferred = metricOpts.find(o => o.metricKey === "highest_send_grade" && o.gradeSystem === "BOULDER_V");
                          maybePromoteGradeGoal(preferred?.gradeSystem ?? null);
                        }
                      }}
                      style={formInputStyle}
                    >
                      {gradeTargets.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.label}{t.isTemplate ? " (session type)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div style={emptyStateStyle}>No session metric targets found. Add metrics to a routine or session type first.</div>
                )}

                {sessionMetricOptions.length > 0 ? (
                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Session metric</span>
                    <select
                      value={validSessionMetricId}
                      onChange={e => {
                        const id = e.target.value;
                        setSessionMetricDefinitionId(id);
                        const opt = sessionMetricOptions.find(o => o.id === id);
                        maybePromoteGradeGoal(opt?.gradeSystem ?? null);
                      }}
                      style={formInputStyle}
                    >
                      {sessionMetricOptions.map(o => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>
                    {selectedSessionMetric?.gradeSystem ? "Target grade" : "Metric target"}
                  </span>
                  <input
                    name="sessionMetricTarget"
                    value={sessionMetricTarget}
                    onChange={e => setSessionMetricTarget(e.target.value)}
                    style={formInputStyle}
                    placeholder={
                      selectedSessionMetric?.gradeSystem === "BOULDER_V" ? "e.g. V4, V5, V6" :
                      selectedSessionMetric?.gradeSystem === "YOSEMITE"  ? "e.g. 5.10d, 5.11a" :
                      "Target value"
                    }
                  />
                </label>

                {selectedSessionMetric?.gradeSystem ? (
                  <div style={gradeBadgeStyle}>
                    Grade goals are automatically tracked as one-time performance goals.
                  </div>
                ) : null}
              </>
            ) : (
              /* Standard target picker */
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>{targetTypeLabel}</span>
                <select
                  name="targetId"
                  value={effectiveTargetId}
                  onChange={e => {
                    const id = e.target.value;
                    setTargetId(id);
                    if (effectiveMetricType === "SESSION_METRIC") {
                      const metricOpts = effectiveTargetType === "ROUTINE"
                        ? (options.sessionMetricsByRoutineId[id] ?? [])
                        : (options.sessionMetricsByTemplateId[id] ?? []);
                      const preferred = metricOpts.find(o => o.metricKey === "highest_send_grade" && o.gradeSystem === "BOULDER_V");
                      maybePromoteGradeGoal(preferred?.gradeSystem ?? null);
                    }
                  }}
                  style={formInputStyle}
                >
                  {targetOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                {targetOptions.find(t => t.id === effectiveTargetId)?.subtitle ? (
                  <span style={hintStyle}>{targetOptions.find(t => t.id === effectiveTargetId)?.subtitle}</span>
                ) : null}
              </label>
            )}

            {/* SESSION_METRIC in non-grade VOLUME scope */}
            {isSessionMetric ? (
              <>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Session metric</span>
                  <select
                    value={validSessionMetricId}
                    onChange={e => {
                      const id = e.target.value;
                      setSessionMetricDefinitionId(id);
                      const opt = sessionMetricOptions.find(o => o.id === id);
                      maybePromoteGradeGoal(opt?.gradeSystem ?? null);
                    }}
                    style={formInputStyle}
                  >
                    {sessionMetricOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Metric target</span>
                  <input
                    name="sessionMetricTarget"
                    value={sessionMetricTarget}
                    onChange={e => setSessionMetricTarget(e.target.value)}
                    style={formInputStyle}
                    placeholder={
                      selectedSessionMetric?.gradeSystem === "BOULDER_V" ? "V4, V5, V6" :
                      selectedSessionMetric?.gradeSystem === "YOSEMITE"  ? "5.10d, 5.11a" :
                      "5, 1200"
                    }
                  />
                </label>
              </>
            ) : null}
          </div>

          {/* Metric selector — pills for PERFORMANCE, dropdown for VOLUME */}
          {perfMetricPills.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div style={fieldLabelStyle}>Metric</div>
              <div style={{ ...pillRowStyle, marginTop: 7 }}>
                {perfMetricPills.map(([m, label]) => {
                  const isActive = effectiveMetricType === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetricType(m)}
                      style={{
                        ...scopePillStyle,
                        borderColor: isActive ? accent.border : "rgba(128,128,128,0.28)",
                        background:  isActive ? accent.bg     : "transparent",
                        fontWeight:  isActive ? 900 : 700,
                        color:       isActive ? accent.color  : "inherit",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : goalType === "VOLUME" && filteredMetrics.length > 1 ? (
            <label style={{ ...fieldStyle, marginTop: 16 }}>
              <span style={fieldLabelStyle}>Metric</span>
              <select
                value={effectiveMetricType}
                onChange={e => setMetricType(e.target.value as GoalMetricTypeValue)}
                style={formInputStyle}
              >
                {filteredMetrics.map(m => (
                  <option key={m} value={m}>{GOAL_METRIC_LABELS[m]}</option>
                ))}
              </select>
            </label>
          ) : null}

          {/* Timeframe — pills (hidden for grade scope since it's always one-time) */}
          {!isGradeScope ? (
            <div style={{ marginTop: 16 }}>
              <div style={fieldLabelStyle}>Timeframe</div>
              <div style={{ ...pillRowStyle, marginTop: 7 }}>
                {timeframeOpts.map(([val, label]) => {
                  const isActive = timeframe === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTimeframe(val)}
                      style={{
                        ...scopePillStyle,
                        borderColor: isActive ? accent.border : "rgba(128,128,128,0.28)",
                        background:  isActive ? accent.bg     : "transparent",
                        fontWeight:  isActive ? 900 : 700,
                        color:       isActive ? accent.color  : "inherit",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Target value input */}
          {!isGradeScope && !isSessionMetric ? (
            <div style={{ marginTop: 16 }}>
              {isDuration || isPace ? (
                <div style={fieldGridStyle}>
                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>{isPace ? "Target pace — minutes" : "Target — minutes"}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={durationParts.minutes}
                      onChange={e => setDurationParts(p => ({ ...p, minutes: e.target.value }))}
                      style={formInputStyle}
                      placeholder="25"
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Seconds</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={durationParts.seconds}
                      onChange={e => setDurationParts(p => ({ ...p, seconds: e.target.value }))}
                      style={formInputStyle}
                      placeholder="00"
                    />
                  </label>
                  {isPace ? (
                    <>
                      <label style={fieldStyle}>
                        <span style={fieldLabelStyle}>Benchmark distance (mi)</span>
                        <input
                          name="benchmarkDistanceMi"
                          type="number"
                          min="0"
                          step="0.01"
                          value={benchmarkDistanceMi}
                          onChange={e => setBenchmarkDistanceMi(e.target.value)}
                          style={formInputStyle}
                          placeholder="3.11"
                        />
                      </label>
                      <label style={fieldStyle}>
                        <span style={fieldLabelStyle}>Benchmark label</span>
                        <input
                          name="benchmarkLabel"
                          value={benchmarkLabel}
                          onChange={e => setBenchmarkLabel(e.target.value)}
                          style={formInputStyle}
                          placeholder="5K"
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : (
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>{numMeta.label}</span>
                  <input
                    type="number"
                    min="0"
                    step={numMeta.step}
                    value={rawTargetValue}
                    onChange={e => setRawTargetValue(e.target.value)}
                    style={formInputStyle}
                    placeholder={numMeta.placeholder}
                  />
                </label>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Optional settings ────────────────────────────────────── */}
      <details style={optionalStyle}>
        <summary style={optionalSummaryStyle}>Optional settings</summary>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Start date</span>
              <input name="startDate" type="date" defaultValue={initial.startDate} style={formInputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>End date</span>
              <input name="endDate" type="date" defaultValue={initial.endDate} style={formInputStyle} />
            </label>
          </div>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Notes</span>
            <textarea
              name="notes"
              defaultValue={initial.notes}
              rows={3}
              style={{ ...formInputStyle, resize: "vertical" }}
            />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input name="isActive" type="checkbox" defaultChecked={initial.isActive} style={{ width: 16, height: 16 }} />
            <span style={fieldLabelStyle}>Active</span>
          </label>
        </div>
      </details>

      {/* ── Submit ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" style={submitStyle}>{submitLabel}</button>
      </div>
    </form>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const stepLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  opacity: 0.5,
  marginBottom: 8,
};

const typeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
};

const typeCardStyle: React.CSSProperties = {
  padding: "14px 10px",
  border: "1px solid",
  borderRadius: 14,
  textAlign: "left",
  cursor: "pointer",
  color: "inherit",
};

const typeTaglineStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.62,
  marginTop: 4,
  lineHeight: 1.35,
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const scopePillStyle: React.CSSProperties = {
  padding: "7px 16px",
  border: "1px solid",
  borderRadius: 999,
  fontSize: 13,
  cursor: "pointer",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.62,
  lineHeight: 1.4,
};

const detailCardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.2)",
  borderRadius: 14,
  padding: "16px",
  background: "rgba(128,128,128,0.04)",
  display: "grid",
  gap: 0,
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.72,
};

const gradeBadgeStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgb(251,191,36)",
  background: "rgba(251,191,36,0.1)",
  border: "1px solid rgba(251,191,36,0.28)",
  borderRadius: 8,
  padding: "7px 10px",
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.68,
  padding: "6px 0",
};

const optionalStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.18)",
  borderRadius: 12,
  padding: "12px 14px",
};

const optionalSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  opacity: 0.62,
};

const submitStyle: React.CSSProperties = {
  padding: "11px 24px",
  border: "1px solid rgba(34,197,94,0.5)",
  borderRadius: 12,
  background: "rgba(34,197,94,0.12)",
  color: "inherit",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

const routineChecklistStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.22)",
  borderRadius: 8,
  background: "rgba(128,128,128,0.04)",
  maxHeight: 240,
  overflowY: "auto",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  cursor: "pointer",
};
