import type {
  GoalMetricTypeValue,
  GoalTargetTypeValue,
  GoalTimeframeValue,
  GoalTypeValue,
} from "@/lib/goals-config";

export type GoalTemplateKey =
  | "ROUTINE_FREQUENCY"
  | "SESSION_TEMPLATE_FREQUENCY"
  | "SESSION_TEMPLATE_METRIC"
  | "EXERCISE_STRENGTH"
  | "EXERCISE_VOLUME"
  | "CARDIO_DISTANCE"
  | "CARDIO_PACE"
  | "GROUP_VOLUME";

export type GoalTemplate = {
  key: GoalTemplateKey;
  label: string;
  description: string;
  goalType: GoalTypeValue;
  targetType: GoalTargetTypeValue;
  metricType: GoalMetricTypeValue;
  timeframe: GoalTimeframeValue;
  targetValue: number;
  benchmarkDistanceMi?: number;
  benchmarkLabel?: string;
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    key: "ROUTINE_FREQUENCY",
    label: "Routine weekly frequency",
    description: "Track how often a routine gets done each week.",
    goalType: "FREQUENCY",
    targetType: "ROUTINE",
    metricType: "SESSIONS",
    timeframe: "WEEK",
    targetValue: 3,
  },
  {
    key: "SESSION_TEMPLATE_FREQUENCY",
    label: "Session template frequency",
    description: "Track how often a specific sport or activity template gets logged each week.",
    goalType: "FREQUENCY",
    targetType: "SESSION_TEMPLATE",
    metricType: "SESSIONS",
    timeframe: "WEEK",
    targetValue: 2,
  },
  {
    key: "SESSION_TEMPLATE_METRIC",
    label: "Session template metric",
    description: "Target a climbing, hiking, surfing, or snowboarding metric defined by the template.",
    goalType: "VOLUME",
    targetType: "SESSION_TEMPLATE",
    metricType: "SESSION_METRIC",
    timeframe: "WEEK",
    targetValue: 5,
  },
  {
    key: "EXERCISE_STRENGTH",
    label: "Exercise top weight",
    description: "Push a lift or weighted movement to a higher best set.",
    goalType: "PERFORMANCE",
    targetType: "EXERCISE",
    metricType: "MAX_WEIGHT",
    timeframe: "ONE_TIME",
    targetValue: 225,
  },
  {
    key: "EXERCISE_VOLUME",
    label: "Exercise workload",
    description: "Accumulate weekly reps, sets, volume, or duration for an exercise.",
    goalType: "VOLUME",
    targetType: "EXERCISE",
    metricType: "VOLUME",
    timeframe: "WEEK",
    targetValue: 5000,
  },
  {
    key: "CARDIO_DISTANCE",
    label: "Cardio weekly distance",
    description: "Build total weekly distance for running, walking, biking, or similar cardio.",
    goalType: "VOLUME",
    targetType: "CARDIO",
    metricType: "DISTANCE",
    timeframe: "WEEK",
    targetValue: 20,
  },
  {
    key: "CARDIO_PACE",
    label: "Cardio pace benchmark",
    description: "Target a pace benchmark like a 5K or mile effort.",
    goalType: "PERFORMANCE",
    targetType: "CARDIO",
    metricType: "PACE",
    timeframe: "ONE_TIME",
    targetValue: 1500,
    benchmarkDistanceMi: 3.11,
    benchmarkLabel: "5K",
  },
  {
    key: "GROUP_VOLUME",
    label: "Group workload",
    description: "Track workload for a broader training group like Push, Legs, Mobility, or Running.",
    goalType: "VOLUME",
    targetType: "GROUP",
    metricType: "VOLUME",
    timeframe: "WEEK",
    targetValue: 8000,
  },
];

export function getGoalTemplate(key: string | null | undefined) {
  return GOAL_TEMPLATES.find((template) => template.key === key) ?? GOAL_TEMPLATES[0];
}
