import type { SessionMetricDefinition, SessionMetricValueType } from "@/generated/prisma";
import { formatAppDate } from "@/lib/dates";
import { fillWeeklySeries, incrementWeekMap, weekKey, type ProgressRange, type SeriesPoint } from "@/lib/progress-v2";
import {
  asSessionMetricConfig,
  sessionMetricGoalValueLabel,
  sessionMetricNumericValue,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";

export type SessionMetricValueWithDefinition = {
  numberValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  metricDefinition: SessionMetricDefinitionWithConfig;
};

export type SessionMetricLogLike = {
  performedAt: Date;
  sessionMetricValues: SessionMetricValueWithDefinition[];
};

export function withConfiguredSessionMetricDefinition<T extends SessionMetricDefinition & { config: unknown }>(definition: T) {
  return {
    ...definition,
    config: asSessionMetricConfig(definition.config as never),
  };
}

export function findSessionMetricValue(
  log: SessionMetricLogLike,
  metricDefinitionId: string
) {
  return log.sessionMetricValues.find((value) => value.metricDefinition.id === metricDefinitionId) ?? null;
}

export function getSessionMetricNumericValue(log: SessionMetricLogLike, metricDefinitionId: string) {
  const value = findSessionMetricValue(log, metricDefinitionId);
  if (!value) return null;
  return sessionMetricNumericValue(value.metricDefinition, value);
}

export function aggregateSessionMetricHistory(
  logs: SessionMetricLogLike[],
  metricDefinitionId: string,
  range: ProgressRange,
  mode: "sum" | "max"
) {
  const weekly = new Map<string, number>();

  for (const log of logs) {
    const numericValue = getSessionMetricNumericValue(log, metricDefinitionId);
    if (numericValue === null) continue;
    if (mode === "max") {
      const key = weekKey(log.performedAt);
      weekly.set(key, Math.max(weekly.get(key) ?? 0, numericValue));
      continue;
    }
    incrementWeekMap(weekly, log.performedAt, numericValue);
  }

  return fillWeeklySeries(weekly, range);
}

export function sessionMetricPerformanceSeries(
  logs: SessionMetricLogLike[],
  metricDefinition: Pick<SessionMetricDefinitionWithConfig, "id" | "label" | "unit" | "valueType" | "config">
) {
  const points: SeriesPoint[] = [];

  for (const log of logs) {
    const metricValue = findSessionMetricValue(log, metricDefinition.id);
    if (!metricValue) continue;
    const numericValue = sessionMetricNumericValue(metricDefinition, metricValue);
    if (numericValue === null) continue;
    points.push({
      label: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
      value: numericValue,
      detailLines:
        metricDefinition.valueType === "TEXT"
          ? [sessionMetricGoalValueLabel(metricDefinition, numericValue, metricValue.textValue)]
          : undefined,
    });
  }

  return points;
}

export function sessionMetricInputStep(valueType: SessionMetricValueType) {
  return valueType === "DECIMAL" ? "0.1" : "1";
}
