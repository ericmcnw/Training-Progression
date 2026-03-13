export const GOAL_TYPE_VALUES = ["FREQUENCY", "VOLUME", "PERFORMANCE", "COMPLETION"] as const;
export const GOAL_TARGET_TYPE_VALUES = ["ROUTINE", "EXERCISE", "CARDIO", "GROUP"] as const;
export const GOAL_TIMEFRAME_VALUES = ["DAY", "WEEK", "MONTH", "ONE_TIME"] as const;
export const GOAL_METRIC_TYPE_VALUES = [
  "SESSIONS",
  "DISTANCE",
  "DURATION",
  "VOLUME",
  "REPS",
  "SETS",
  "MAX_WEIGHT",
  "MAX_DURATION",
  "PACE",
  "COMPLETED",
] as const;

export type GoalTypeValue = (typeof GOAL_TYPE_VALUES)[number];
export type GoalTargetTypeValue = (typeof GOAL_TARGET_TYPE_VALUES)[number];
export type GoalTimeframeValue = (typeof GOAL_TIMEFRAME_VALUES)[number];
export type GoalMetricTypeValue = (typeof GOAL_METRIC_TYPE_VALUES)[number];

export const GOAL_TYPE_LABELS: Record<GoalTypeValue, string> = {
  FREQUENCY: "Frequency",
  VOLUME: "Volume",
  PERFORMANCE: "Performance",
  COMPLETION: "Completion",
};

export const GOAL_TARGET_TYPE_LABELS: Record<GoalTargetTypeValue, string> = {
  ROUTINE: "Routine",
  EXERCISE: "Exercise",
  CARDIO: "Cardio target",
  GROUP: "Metadata group",
};

export const GOAL_TIMEFRAME_LABELS: Record<GoalTimeframeValue, string> = {
  DAY: "Daily",
  WEEK: "Weekly",
  MONTH: "Monthly",
  ONE_TIME: "One-time",
};

export const GOAL_METRIC_LABELS: Record<GoalMetricTypeValue, string> = {
  SESSIONS: "Sessions",
  DISTANCE: "Distance",
  DURATION: "Duration",
  VOLUME: "Volume",
  REPS: "Reps",
  SETS: "Sets",
  MAX_WEIGHT: "Top weight",
  MAX_DURATION: "Best duration",
  PACE: "Pace",
  COMPLETED: "Completed",
};

const METRICS_BY_COMBINATION: Record<GoalTypeValue, Partial<Record<GoalTargetTypeValue, GoalMetricTypeValue[]>>> = {
  FREQUENCY: {
    ROUTINE: ["SESSIONS"],
    EXERCISE: ["SESSIONS"],
    CARDIO: ["SESSIONS"],
    GROUP: ["SESSIONS"],
  },
  VOLUME: {
    ROUTINE: ["DISTANCE", "DURATION", "REPS", "SETS", "VOLUME"],
    EXERCISE: ["REPS", "SETS", "VOLUME", "DURATION"],
    CARDIO: ["DISTANCE", "DURATION"],
    GROUP: ["DISTANCE", "DURATION", "REPS", "SETS", "VOLUME"],
  },
  PERFORMANCE: {
    ROUTINE: ["DISTANCE", "MAX_DURATION"],
    EXERCISE: ["MAX_WEIGHT", "MAX_DURATION"],
    CARDIO: ["DISTANCE", "PACE"],
    GROUP: [],
  },
  COMPLETION: {
    ROUTINE: ["COMPLETED"],
    CARDIO: ["COMPLETED"],
    GROUP: ["COMPLETED"],
  },
};

export function getAllowedMetricTypes(goalType: GoalTypeValue, targetType: GoalTargetTypeValue) {
  return METRICS_BY_COMBINATION[goalType]?.[targetType] ?? [];
}

export function isGoalTypeValue(value: string): value is GoalTypeValue {
  return GOAL_TYPE_VALUES.includes(value as GoalTypeValue);
}

export function isGoalTargetTypeValue(value: string): value is GoalTargetTypeValue {
  return GOAL_TARGET_TYPE_VALUES.includes(value as GoalTargetTypeValue);
}

export function isGoalTimeframeValue(value: string): value is GoalTimeframeValue {
  return GOAL_TIMEFRAME_VALUES.includes(value as GoalTimeframeValue);
}

export function isGoalMetricTypeValue(value: string): value is GoalMetricTypeValue {
  return GOAL_METRIC_TYPE_VALUES.includes(value as GoalMetricTypeValue);
}

export function metricUsesDurationInput(metricType: GoalMetricTypeValue) {
  return metricType === "DURATION" || metricType === "MAX_DURATION";
}

export function metricUsesPaceInput(metricType: GoalMetricTypeValue) {
  return metricType === "PACE";
}

export function metricIsLowerBetter(metricType: GoalMetricTypeValue) {
  return metricType === "PACE";
}
