"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { WEEKDAY_BITS, formatMaskLabel } from "@/lib/frequency-state";
import { ROUTINE_SUBTYPE_OPTIONS, formatRoutineSubtype } from "@/lib/routines";

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
    weekdayMask?: number | null;
    routineIds: string[];
    /** Substitute routines — count toward streak but render as "covered." */
    substituteRoutineIds?: string[];
    /** "Also count when these appear" — exercise ids that trigger a match
     *  on any log (including quick workouts that aren't enrolled in any
     *  listed routine). */
    triggerExerciseIds?: string[];
    /** "Also count when these appear" — activity-type subtypes that trigger
     *  a match on any log whose routine has that subtype (e.g. CLIMBING). */
    triggerSubtypes?: string[];
    /** Endurance activity type ids — "Run 3x/wk" sets the run type id and
     *  any log explicitly typed Run counts. Exact match. */
    triggerActivityTypeIds?: string[];
    /** Endurance family ids — "Running 3x/wk" covering any Run-family log
     *  (Run + Trail Run + Long Run + …). Broader than triggerActivityTypeIds. */
    triggerActivityFamilyIds?: string[];
    /** Minimum sets of a trigger exercise required in a single log to claim
     *  a session via the exercise-trigger path. Defaults to 1. */
    triggerMinSets?: number;
  };
};

// Activity type / family options for the goal-target picker. Loaded
// server-side by the goals form-data API and passed in via props.
export type GoalActivityTypeOption = {
  id: string;
  slug: string;
  name: string;
  familyId: string;
  familyName: string;
  familySortOrder: number;
  sortOrder: number;
};
export type GoalActivityFamilyOption = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
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
    // Per-routine frequency is set on the routine itself now (Edit Routine →
    // Frequency goal block). The /goals form only handles multi-routine
    // shapes: groups and session-type aggregates.
    { value: "group",       label: "Group",        hint: "Mix of routines counted together — e.g. \"Strength 3× per week\" across Push/Pull/Legs" },
    { value: "sessionType", label: "Session type", hint: "Count logs by sport or activity type — e.g. \"Climb 2× per week\" across any climbing session" },
  ],
  VOLUME: [
    { value: "routine",  label: "Routine",  hint: "Total output from a single routine" },
    { value: "exercise", label: "Exercise", hint: "Reps, sets, or volume on a lift" },
    { value: "cardio",   label: "Endurance", hint: "Distance, elevation, or duration" },
    { value: "group",    label: "Group",    hint: "Combined workload across a training group" },
  ],
  PERFORMANCE: [
    { value: "exercise", label: "Lift / movement",  hint: "Best weight or best-set duration for a lift" },
    { value: "cardio",   label: "Endurance benchmark", hint: "Pace, distance, or elevation milestone" },
    { value: "grade",    label: "Grade / metric",   hint: "Climbing grade, session score, or sport metric" },
  ],
  COMPLETION: [
    { value: "routine", label: "Routine", hint: "Complete a routine N times" },
    { value: "cardio",  label: "Endurance",  hint: "Log endurance sessions" },
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
    // Per-routine FREQUENCY no longer has a scope here — those live on the
    // routine. Default to group for new goals; existing single-routine
    // legacy values fall through to group too.
    if (targetType === "SESSION_TEMPLATE") return "sessionType";
    return "group";
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
  inDrawer = false,
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  groupFrequencyAction?: (formData: FormData) => void | Promise<void>;
  options: GoalFormOptions;
  submitLabel: string;
  initial: GoalFormInitial;
  /** When true the form runs in drawer mode: server action runs without
   *  redirecting and onSuccess is called so the host can close the drawer. */
  inDrawer?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
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
  const [gfWeekdayMask, setGfWeekdayMask]   = useState<number>(initial.groupFrequency?.weekdayMask ?? 0);
  // "Also count when these appear" triggers — both stored as ordered string
  // arrays so we can render chip lists with stable keys.
  const [triggerExerciseIds, setTriggerExerciseIds] = useState<string[]>(
    () => initial.groupFrequency?.triggerExerciseIds ?? []
  );
  const [triggerSubtypes, setTriggerSubtypes] = useState<string[]>(
    () => initial.groupFrequency?.triggerSubtypes ?? []
  );
  const [triggerActivityTypeIds, setTriggerActivityTypeIds] = useState<string[]>(
    () => initial.groupFrequency?.triggerActivityTypeIds ?? []
  );
  const [triggerActivityFamilyIds, setTriggerActivityFamilyIds] = useState<string[]>(
    () => initial.groupFrequency?.triggerActivityFamilyIds ?? []
  );
  // Held as a string so the input behaves naturally (allows clearing while
  // typing). Parser clamps + defaults to 1 if blank/invalid.
  const [triggerMinSets, setTriggerMinSets] = useState<string>(
    () => String(initial.groupFrequency?.triggerMinSets ?? 1)
  );

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

  const baseAction = isGroupFrequency && groupFrequencyAction ? groupFrequencyAction : action;
  const formAction = inDrawer
    ? (formData: FormData) => {
        formData.set("noRedirect", "1");
        startTransition(async () => {
          await baseAction(formData);
          router.refresh();
          onSuccess?.();
        });
      }
    : baseAction;

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
                <div style={cadenceTriRow}>
                  <label style={cadenceCell}>
                    <span style={cadenceCellLabel}>Count</span>
                    <input
                      name="targetCount"
                      type="number"
                      min="1"
                      step="1"
                      value={gfTargetCount}
                      onChange={e => setGfTargetCount(e.target.value)}
                      style={formInputStyle}
                      inputMode="numeric"
                    />
                  </label>
                  <label style={cadenceCell}>
                    <span style={cadenceCellLabel}>Per</span>
                    <input
                      name="targetInterval"
                      type="number"
                      min="1"
                      step="1"
                      value={gfTargetInterval}
                      onChange={e => setGfTargetInterval(e.target.value)}
                      style={formInputStyle}
                      inputMode="numeric"
                    />
                  </label>
                  <label style={cadenceCell}>
                    <span style={cadenceCellLabel}>Unit</span>
                    <select
                      name="targetUnit"
                      value={gfTargetUnit}
                      onChange={e => setGfTargetUnit(e.target.value as "DAY" | "WEEK" | "MONTH")}
                      style={formInputStyle}
                    >
                      <option value="DAY">day(s)</option>
                      <option value="WEEK">week(s)</option>
                      <option value="MONTH">month(s)</option>
                    </select>
                  </label>
                </div>
              </div>

              {gfTargetUnit === "WEEK" ? (
                <WeekdayPicker mask={gfWeekdayMask} onChange={setGfWeekdayMask} />
              ) : null}
            </div>
          </div>

          <div style={detailCardStyle}>
            <div style={stepLabelStyle}>Included</div>
            <div style={{ ...hintStyle, marginBottom: 10 }}>Sessions from any checked sport or routine count toward this goal.</div>
            {(options.sportTargets ?? []).length > 0 ? (
              <div style={sectionStack}>
                <div style={groupSubLabel}>Sports</div>
                <div style={sportTileGrid}>
                  {(options.sportTargets ?? []).map((s) => (
                    <SportCheckboxTile
                      key={`primary-${s.id}`}
                      name="routineIds"
                      value={s.id}
                      label={s.label}
                      eyebrow={s.eyebrow}
                      color={s.color}
                      defaultChecked={initial.groupFrequency?.routineIds.includes(s.id) ?? false}
                      tone="primary"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {options.routines.length > 0 ? (
              <div style={sectionStack}>
                {(options.sportTargets ?? []).length > 0 ? (
                  <div style={groupSubLabel}>Routines</div>
                ) : null}
                <div style={routineCardGrid}>
                  {options.routines.map(r => (
                    <RoutineCheckboxCard
                      key={`primary-${r.id}`}
                      name="routineIds"
                      value={r.id}
                      label={r.label}
                      subtitle={r.subtitle}
                      defaultChecked={initial.groupFrequency?.routineIds.includes(r.id) ?? false}
                      tone="primary"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={detailCardStyle}>
            <div style={stepLabelStyle}>Covered by</div>
            <div style={{ ...hintStyle, marginBottom: 10 }}>
              Days where one of these fires (but no included item does) render as <strong>covered</strong> instead of missed and keep the streak alive — useful when one activity stands in for another.
            </div>
            {(options.sportTargets ?? []).length > 0 ? (
              <div style={sectionStack}>
                <div style={groupSubLabel}>Sports</div>
                <div style={sportTileGrid}>
                  {(options.sportTargets ?? []).map((s) => (
                    <SportCheckboxTile
                      key={`sub-${s.id}`}
                      name="substituteRoutineIds"
                      value={s.id}
                      label={s.label}
                      eyebrow={s.eyebrow}
                      color={s.color}
                      defaultChecked={initial.groupFrequency?.substituteRoutineIds?.includes(s.id) ?? false}
                      tone="substitute"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {options.routines.length > 0 ? (
              <div style={sectionStack}>
                {(options.sportTargets ?? []).length > 0 ? (
                  <div style={groupSubLabel}>Routines</div>
                ) : null}
                <div style={routineCardGrid}>
                  {options.routines.map(r => (
                    <RoutineCheckboxCard
                      key={`sub-${r.id}`}
                      name="substituteRoutineIds"
                      value={r.id}
                      label={r.label}
                      subtitle={r.subtitle}
                      defaultChecked={initial.groupFrequency?.substituteRoutineIds?.includes(r.id) ?? false}
                      tone="substitute"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <TriggerSection
            exerciseOptions={options.exercises}
            activityTypeOptions={options.activityTypes ?? []}
            activityFamilyOptions={options.activityFamilies ?? []}
            triggerExerciseIds={triggerExerciseIds}
            setTriggerExerciseIds={setTriggerExerciseIds}
            triggerSubtypes={triggerSubtypes}
            setTriggerSubtypes={setTriggerSubtypes}
            triggerActivityTypeIds={triggerActivityTypeIds}
            setTriggerActivityTypeIds={setTriggerActivityTypeIds}
            triggerActivityFamilyIds={triggerActivityFamilyIds}
            setTriggerActivityFamilyIds={setTriggerActivityFamilyIds}
            triggerMinSets={triggerMinSets}
            setTriggerMinSets={setTriggerMinSets}
          />
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

// ─── Cadence + routine card subcomponents ─────────────────────────────────

const cadenceTriRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
  gap: 8,
  marginTop: 6,
};

const cadenceCell: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const cadenceCellLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.65,
};

const routineCardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 6,
  maxHeight: 280,
  overflowY: "auto",
  padding: 2,
};

// One card-style checkbox row in either the Included or Covered-by routine
// pickers. Tone changes the accent color: primary = green (real completion),
// substitute = sky (covers a slot).
function RoutineCheckboxCard({
  name,
  value,
  label,
  subtitle,
  defaultChecked,
  tone,
}: {
  name: string;
  value: string;
  label: string;
  subtitle?: string;
  defaultChecked: boolean;
  tone: "primary" | "substitute";
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const palette = tone === "primary" ? primaryPalette : substitutePalette;
  const cardStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 10,
    border: `1px solid ${checked ? palette.borderActive : "rgba(128,128,128,0.3)"}`,
    background: checked ? palette.bgActive : "rgba(255,255,255,0.018)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    minWidth: 0,
  };
  return (
    <label style={cardStyle}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={(e) => setChecked(e.target.checked)}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${checked ? palette.checkBorder : "rgba(128,128,128,0.5)"}`,
          background: checked ? palette.checkBg : "transparent",
          color: palette.checkColor,
          fontSize: 12,
          fontWeight: 900,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={{ flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {subtitle ? (
          <span style={{ display: "block", fontSize: 11, opacity: 0.55, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
        ) : null}
      </span>
    </label>
  );
}

const sectionStack: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
};

const groupSubLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
  paddingLeft: 2,
};

const sportTileGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 6,
};

// Sport-flavored variant of RoutineCheckboxCard — same checkbox
// semantics (renders into routineIds / substituteRoutineIds form
// fields), different visual treatment: sport accent stripe + label
// in the sport's color so the picker reads like /log's SPORT tiles.
function SportCheckboxTile({
  name,
  value,
  label,
  eyebrow,
  color,
  defaultChecked,
  tone,
}: {
  name: string;
  value: string;
  label: string;
  eyebrow: string;
  color: string;
  defaultChecked: boolean;
  tone: "primary" | "substitute";
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const palette = tone === "primary" ? primaryPalette : substitutePalette;
  const tileStyle: React.CSSProperties = {
    display: "grid",
    gap: 3,
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    // Set the full border first, THEN override just the left side —
    // otherwise the `border` shorthand resets `borderLeft` and the
    // accent stripe disappears.
    border: `1px solid ${checked ? palette.borderActive : "rgba(128,128,128,0.3)"}`,
    borderLeftWidth: 3,
    borderLeftColor: color,
    background: checked ? palette.bgActive : "rgba(255,255,255,0.018)",
    cursor: "pointer",
    minWidth: 0,
    minHeight: 54,
  };
  return (
    <label style={tileStyle}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={(e) => setChecked(e.target.checked)}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.6 }}>
          {eyebrow}
        </span>
        {checked ? (
          <span aria-hidden style={{ fontSize: 11, fontWeight: 900, color: palette.checkColor }}>✓</span>
        ) : null}
      </span>
      <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </label>
  );
}

const primaryPalette = {
  borderActive: "rgba(74,222,128,0.55)",
  bgActive: "rgba(74,222,128,0.07)",
  checkBorder: "rgba(74,222,128,0.85)",
  checkBg: "rgba(74,222,128,0.18)",
  checkColor: "rgba(180,242,200,1)",
};

const substitutePalette = {
  borderActive: "rgba(132,204,255,0.55)",
  bgActive: "rgba(132,204,255,0.07)",
  checkBorder: "rgba(132,204,255,0.85)",
  checkBg: "rgba(132,204,255,0.18)",
  checkColor: "rgba(199,228,255,1)",
};

// ─── Weekday picker ─────────────────────────────────────────────────────────
// Renders 7 toggle buttons + a row of preset shortcuts (Daily / Weekdays /
// Weekends / M·W·F). Backs the form with a hidden <input name="weekday">
// per checked bit so the server-side parser (parseFrequencyGoalFields) can
// read them via formData.getAll("weekday").
//
// A null/zero mask means "any day counts" — the row of toggles is shown
// unselected with an explanatory hint.

const PRESETS: Array<{ label: string; mask: number }> = [
  { label: "Any day",  mask: 0 },
  { label: "Daily",    mask: 0b1111111 },
  { label: "Weekdays", mask: 0b0111110 },
  { label: "Weekends", mask: 0b1000001 },
  { label: "M·W·F",    mask: 0b0101010 },
  { label: "T·Th",     mask: 0b0010100 },
];

function WeekdayPicker({ mask, onChange }: { mask: number; onChange: (next: number) => void }) {
  const isAnyDay = mask === 0;
  const label = isAnyDay
    ? "Any day counts — flexible weekly target"
    : (formatMaskLabel(mask) ?? "");

  function toggleBit(bit: number) {
    onChange(mask ^ bit);
  }

  return (
    <div style={weekdayBlockStyle}>
      <div style={weekdayHeaderRow}>
        <span style={weekdayLabelStyle}>On these days</span>
        <span style={weekdayHintStyle}>{label}</span>
      </div>

      <div style={weekdayPresetRow}>
        {PRESETS.map((p) => {
          const active = mask === p.mask;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.mask)}
              style={{ ...weekdayPresetBtn, ...(active ? weekdayPresetBtnActive : null) }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div style={weekdayToggleRow}>
        {WEEKDAY_BITS.map((day) => {
          const active = (mask & day.bit) !== 0;
          return (
            <button
              key={day.bit}
              type="button"
              onClick={() => toggleBit(day.bit)}
              aria-pressed={active}
              aria-label={day.full}
              title={day.full}
              style={{ ...weekdayToggleBtn, ...(active ? weekdayToggleBtnActive : null) }}
            >
              {day.short}
            </button>
          );
        })}
      </div>

      {/* Hidden inputs serialize the mask to formData. We post one value per
          set bit (1, 2, 4, ...) so the server parser can OR them back. */}
      {WEEKDAY_BITS.map((day) =>
        (mask & day.bit) !== 0 ? (
          <input key={day.bit} type="hidden" name="weekday" value={day.bit} />
        ) : null
      )}
    </div>
  );
}

const weekdayBlockStyle: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px dashed rgba(129,140,248,0.32)",
  background: "rgba(129,140,248,0.04)",
};

const weekdayHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
};

const weekdayLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.75,
};

const weekdayHintStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  opacity: 0.65,
};

const weekdayPresetRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const weekdayPresetBtn: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  cursor: "pointer",
};

const weekdayPresetBtnActive: React.CSSProperties = {
  borderColor: "rgba(129,140,248,0.6)",
  background: "rgba(129,140,248,0.18)",
  color: "rgb(199,210,254)",
};

const weekdayToggleRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const weekdayToggleBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  padding: "8px 0",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.02)",
  color: "rgba(255,255,255,0.62)",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const weekdayToggleBtnActive: React.CSSProperties = {
  borderColor: "rgba(129,140,248,0.55)",
  background: "rgba(129,140,248,0.18)",
  color: "rgb(224,231,255)",
  boxShadow: "0 0 0 1px rgba(129,140,248,0.18) inset",
};

// ─── "Also count when these appear" trigger picker ──────────────────────────
// Optional broaden-the-net config below the routine pickers. Collapsed by
// default so default users don't see it; power users open once and add a
// few exercises or activity types. Both selectors are search-and-chip
// patterns to keep long libraries scannable on a phone.
//
// Activity-type options come from ROUTINE_SUBTYPE_OPTIONS — same vocabulary
// the user already sees in the routine create/edit form. We flatten the
// per-kind buckets and tag each option with its kind so the user knows
// "Climbing (Session)" from "Climbing" alone.

const ACTIVITY_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string; kindLabel: string }> = (() => {
  const seen = new Set<string>();
  const rows: Array<{ value: string; label: string; kindLabel: string }> = [];
  for (const [kindKey, subtypes] of Object.entries(ROUTINE_SUBTYPE_OPTIONS)) {
    const kindLabel = kindKey.charAt(0) + kindKey.slice(1).toLowerCase();
    for (const subtype of subtypes) {
      // Skip super-generic ones — they'd match everything by accident.
      if (subtype === "OTHER") continue;
      const key = subtype;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ value: subtype, label: formatRoutineSubtype(subtype), kindLabel });
    }
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
})();

type TriggerExerciseOption = { id: string; label: string; subtitle?: string };

function TriggerSection({
  exerciseOptions,
  activityTypeOptions,
  activityFamilyOptions,
  triggerExerciseIds,
  setTriggerExerciseIds,
  triggerSubtypes,
  setTriggerSubtypes,
  triggerActivityTypeIds,
  setTriggerActivityTypeIds,
  triggerActivityFamilyIds,
  setTriggerActivityFamilyIds,
  triggerMinSets,
  setTriggerMinSets,
}: {
  exerciseOptions: TriggerExerciseOption[];
  activityTypeOptions: GoalActivityTypeOption[];
  activityFamilyOptions: GoalActivityFamilyOption[];
  triggerExerciseIds: string[];
  setTriggerExerciseIds: (ids: string[]) => void;
  triggerSubtypes: string[];
  setTriggerSubtypes: (subtypes: string[]) => void;
  triggerActivityTypeIds: string[];
  setTriggerActivityTypeIds: (ids: string[]) => void;
  triggerActivityFamilyIds: string[];
  setTriggerActivityFamilyIds: (ids: string[]) => void;
  triggerMinSets: string;
  setTriggerMinSets: (value: string) => void;
}) {
  const totalCount =
    triggerExerciseIds.length +
    triggerSubtypes.length +
    triggerActivityTypeIds.length +
    triggerActivityFamilyIds.length;
  const exerciseById = useMemo(() => {
    const map = new Map<string, TriggerExerciseOption>();
    for (const e of exerciseOptions) map.set(e.id, e);
    return map;
  }, [exerciseOptions]);

  // Min sets only matters when there's at least one trigger exercise —
  // subtype matches are routine-level and don't have a per-set semantic.
  const showMinSets = triggerExerciseIds.length > 0;

  return (
    <details
      style={{ ...detailCardStyle, gap: 0, padding: "12px 14px" }}
      open={totalCount > 0}
    >
      <summary style={triggerSummaryStyle}>
        <span style={triggerSummaryTitleStyle}>Also count when these appear</span>
        <span style={triggerSummaryBadgeStyle}>
          {totalCount === 0 ? "Optional" : `${totalCount} added`}
        </span>
      </summary>

      <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
        <div style={{ ...hintStyle, lineHeight: 1.45 }}>
          Sessions matching any selected exercise <em>or</em> activity type also count toward this goal — including quick workouts that aren&apos;t part of any listed routine.
        </div>

        {/* Hidden form fields — chips serialize into multi-value POSTs that
            parseFrequencyGoalFields reads via formData.getAll(...). */}
        {triggerExerciseIds.map((id) => (
          <input key={`tex-${id}`} type="hidden" name="triggerExerciseIds" value={id} />
        ))}
        {triggerSubtypes.map((subtype) => (
          <input key={`tsub-${subtype}`} type="hidden" name="triggerSubtypes" value={subtype} />
        ))}
        {triggerActivityTypeIds.map((id) => (
          <input key={`tat-${id}`} type="hidden" name="triggerActivityTypeIds" value={id} />
        ))}
        {triggerActivityFamilyIds.map((id) => (
          <input key={`taf-${id}`} type="hidden" name="triggerActivityFamilyIds" value={id} />
        ))}

        <TriggerExercisePicker
          options={exerciseOptions}
          selectedIds={triggerExerciseIds}
          onChange={setTriggerExerciseIds}
          exerciseById={exerciseById}
        />

        {/* Endurance type + family picker — present whenever the seed has
            run (activity families exist). Lets the user create
            "Run 3x/wk" (family) or "Trail Run 2x/wk" (specific type)
            goals without having to wire them to a routine first. */}
        {activityFamilyOptions.length > 0 && (
          <EndurancePicker
            typeOptions={activityTypeOptions}
            familyOptions={activityFamilyOptions}
            selectedTypeIds={triggerActivityTypeIds}
            selectedFamilyIds={triggerActivityFamilyIds}
            onChangeTypes={setTriggerActivityTypeIds}
            onChangeFamilies={setTriggerActivityFamilyIds}
          />
        )}

        {showMinSets ? (
          <div style={minSetsRowStyle}>
            <label style={minSetsLabelStyle} htmlFor="goalTriggerMinSets">
              Minimum sets to claim a session
            </label>
            <div style={minSetsControlRowStyle}>
              <input
                id="goalTriggerMinSets"
                name="triggerMinSets"
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                value={triggerMinSets}
                onChange={(e) => setTriggerMinSets(e.target.value)}
                style={minSetsInputStyle}
              />
              <span style={minSetsHintStyle}>
                A log needs at least this many sets of the listed exercises before it counts.
                Default 1 — any rep claims the session. Use 2&ndash;3 to ignore quick warmups.
              </span>
            </div>
          </div>
        ) : (
          // Submit the existing value so it's preserved even when no
          // exercises are listed yet (user might add some later).
          <input type="hidden" name="triggerMinSets" value={triggerMinSets} />
        )}

        <TriggerActivityTypePicker
          selected={triggerSubtypes}
          onChange={setTriggerSubtypes}
        />
      </div>
    </details>
  );
}

function TriggerExercisePicker({
  options,
  selectedIds,
  onChange,
  exerciseById,
}: {
  options: TriggerExerciseOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  exerciseById: Map<string, TriggerExerciseOption>;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as TriggerExerciseOption[];
    return options
      .filter((o) => !selectedSet.has(o.id))
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, query, selectedSet]);

  function add(id: string) {
    if (selectedSet.has(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  }
  function remove(id: string) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  return (
    <div style={triggerFieldBlockStyle}>
      <div style={triggerFieldHeaderStyle}>
        <span style={triggerFieldLabelStyle}>Exercises</span>
        <span style={triggerFieldCountStyle}>
          {selectedIds.length === 0 ? "None" : `${selectedIds.length} selected`}
        </span>
      </div>

      {selectedIds.length > 0 ? (
        <div style={chipRowStyle}>
          {selectedIds.map((id) => {
            const option = exerciseById.get(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => remove(id)}
                style={triggerChipStyle}
                aria-label={`Remove ${option?.label ?? id}`}
              >
                <span>{option?.label ?? id}</span>
                <span style={chipRemoveStyle} aria-hidden>×</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div style={{ position: "relative" }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises to add..."
          style={formInputStyle}
        />
        {matches.length > 0 ? (
          <div style={comboPopoverStyle}>
            {matches.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => add(option.id)}
                style={comboOptionStyle}
              >
                <span>{option.label}</span>
                {option.subtitle ? <span style={comboOptionSubtitleStyle}>{option.subtitle}</span> : null}
              </button>
            ))}
          </div>
        ) : query.trim().length > 0 ? (
          <div style={{ ...comboPopoverStyle, padding: "10px 12px", fontSize: 12, opacity: 0.6 }}>
            No matching exercises.
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Endurance type + family picker. Two parallel pill rows so the user can
// pick at either grain — family ("Running 3x/wk" catches every run type)
// or specific type ("Trail Run 2x/wk" matches exactly). Both can be
// combined; the goal rollup ORs them with all other triggers.
//
// Layout matches the existing TriggerActivityTypePicker chip style for
// visual consistency in the goal builder.
function EndurancePicker({
  typeOptions,
  familyOptions,
  selectedTypeIds,
  selectedFamilyIds,
  onChangeTypes,
  onChangeFamilies,
}: {
  typeOptions: GoalActivityTypeOption[];
  familyOptions: GoalActivityFamilyOption[];
  selectedTypeIds: string[];
  selectedFamilyIds: string[];
  onChangeTypes: (ids: string[]) => void;
  onChangeFamilies: (ids: string[]) => void;
}) {
  const selectedFamilySet = useMemo(() => new Set(selectedFamilyIds), [selectedFamilyIds]);
  const selectedTypeSet = useMemo(() => new Set(selectedTypeIds), [selectedTypeIds]);
  // Group types under their family heading for the picker so users see
  // the hierarchy at-a-glance.
  const grouped = useMemo(() => {
    const byFamily = new Map<string, { familyId: string; familyName: string; familySortOrder: number; types: GoalActivityTypeOption[] }>();
    for (const t of typeOptions) {
      const cur = byFamily.get(t.familyId) ?? {
        familyId: t.familyId,
        familyName: t.familyName,
        familySortOrder: t.familySortOrder,
        types: [],
      };
      cur.types.push(t);
      byFamily.set(t.familyId, cur);
    }
    return [...byFamily.values()].sort((a, b) => a.familySortOrder - b.familySortOrder);
  }, [typeOptions]);

  function toggleFamily(id: string) {
    if (selectedFamilySet.has(id)) onChangeFamilies(selectedFamilyIds.filter((x) => x !== id));
    else onChangeFamilies([...selectedFamilyIds, id]);
  }
  function toggleType(id: string) {
    if (selectedTypeSet.has(id)) onChangeTypes(selectedTypeIds.filter((x) => x !== id));
    else onChangeTypes([...selectedTypeIds, id]);
  }

  return (
    <div style={endurancePickerBlockStyle}>
      <div style={endurancePickerHeaderStyle}>Endurance activity</div>

      {/* Family row — broader rollup target */}
      <div style={enduranceSubLabelStyle}>Family (any type within counts)</div>
      <div style={endurancePillRowStyle}>
        {familyOptions
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((fam) => {
            const active = selectedFamilySet.has(fam.id);
            return (
              <button
                key={fam.id}
                type="button"
                onClick={() => toggleFamily(fam.id)}
                style={active ? endurancePillActive : endurancePill}
                aria-pressed={active}
              >
                {fam.name}
              </button>
            );
          })}
      </div>

      {/* Type row — specific match per family */}
      {grouped.length > 0 && (
        <>
          <div style={enduranceSubLabelStyle}>Specific type (exact match only)</div>
          <div style={{ display: "grid", gap: 8 }}>
            {grouped.map((g) => (
              <div key={g.familyId} style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 10.5, opacity: 0.55, fontWeight: 800, letterSpacing: 0.4 }}>{g.familyName}</div>
                <div style={endurancePillRowStyle}>
                  {g.types.map((t) => {
                    const active = selectedTypeSet.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleType(t.id)}
                        style={active ? endurancePillActive : endurancePill}
                        aria-pressed={active}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const endurancePickerBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderRadius: 10,
  background: "rgba(78,148,255,0.04)",
  border: "1px solid rgba(78,148,255,0.18)",
};

const endurancePickerHeaderStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  color: "rgba(191,219,254,0.95)",
};

const enduranceSubLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};

const endurancePillRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
};

const endurancePill: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  // Long-hand so `endurancePillActive` can override `borderColor`
  // without React's mixed-shorthand rerender warning.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const endurancePillActive: React.CSSProperties = {
  ...endurancePill,
  background: "rgba(78,148,255,0.18)",
  borderColor: "rgba(78,148,255,0.55)",
  color: "rgba(191,219,254,0.98)",
};

function TriggerActivityTypePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (subtypes: string[]) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }
  return (
    <div style={triggerFieldBlockStyle}>
      <div style={triggerFieldHeaderStyle}>
        <span style={triggerFieldLabelStyle}>Activity types</span>
        <span style={triggerFieldCountStyle}>
          {selected.length === 0 ? "None" : `${selected.length} selected`}
        </span>
      </div>
      <div style={activityTypeGridStyle}>
        {ACTIVITY_TYPE_OPTIONS.map((option) => {
          const isActive = selectedSet.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              style={{
                ...activityTypeChipStyle,
                ...(isActive ? activityTypeChipActiveStyle : null),
              }}
              aria-pressed={isActive}
            >
              <span style={{ fontWeight: 800 }}>{option.label}</span>
              <span style={activityTypeKindStyle}>{option.kindLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const triggerSummaryStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  listStyle: "none",
};

const triggerSummaryTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  opacity: 0.7,
};

const triggerSummaryBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.55,
};

const triggerFieldBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const triggerFieldHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
};

const triggerFieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.78,
};

const triggerFieldCountStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.55,
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const triggerChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(129,140,248,0.42)",
  background: "rgba(129,140,248,0.13)",
  color: "rgb(224,231,255)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const chipRemoveStyle: React.CSSProperties = {
  opacity: 0.7,
  fontSize: 14,
  lineHeight: 1,
};

const comboPopoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 5,
  background: "rgb(20,24,32)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
  maxHeight: 240,
  overflowY: "auto",
  display: "grid",
};

const comboOptionStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "9px 12px",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  fontSize: 13,
};

const comboOptionSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
};

const activityTypeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 6,
};

const activityTypeChipStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.04)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 13,
};

const activityTypeChipActiveStyle: React.CSSProperties = {
  borderColor: "rgba(129,140,248,0.55)",
  background: "rgba(129,140,248,0.16)",
  color: "rgb(224,231,255)",
};

const activityTypeKindStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  fontWeight: 700,
};

const minSetsRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px dashed rgba(129,140,248,0.32)",
  background: "rgba(129,140,248,0.04)",
};

const minSetsLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.78,
};

const minSetsControlRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const minSetsInputStyle: React.CSSProperties = {
  width: 72,
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.55)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
  fontFamily: "inherit",
  fontWeight: 800,
  textAlign: "center",
  boxSizing: "border-box",
  flexShrink: 0,
};

const minSetsHintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.62,
  lineHeight: 1.4,
  flex: "1 1 220px",
  minWidth: 0,
};
