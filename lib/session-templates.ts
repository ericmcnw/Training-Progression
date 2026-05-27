import type { Prisma, SessionMetricDefinition, SessionMetricValueType } from "@/generated/prisma";

export const SESSION_TEMPLATE_KEYS = [
  "indoor-bouldering",
  "indoor-rope-climbing",
  "indoor-sport-climbing",
  "outdoor-bouldering",
  "outdoor-top-rope",
  "outdoor-sport-climbing",
  "outdoor-trad-climbing",
  "hiking",
  "surfing",
  "snowboarding",
  "basketball-pickup",
  "basketball-shooting",
  "golf",
] as const;

export type SessionTemplateKey = (typeof SESSION_TEMPLATE_KEYS)[number];

export type SessionMetricConfig = {
  input?: "grade" | "textarea";
  gradeSystem?: "BOULDER_V" | "YOSEMITE";
  gradeBucket?: string;
  climbingColumn?: "DONE" | "FLASHED";
};

// Grade lists include "+" variants between every integer (V) or letter (YDS)
// rung — V2 < V2+ < V3, 5.10a < 5.10a+ < 5.10b. The plus slot is useful for
// gyms / outdoor problems that feel between two grades. gradeSort in
// lib/climb-types treats "+" as +0.5 so ordering just works.
const BOULDER_GRADE_OPTIONS = [
  "V0", "V0+",
  "V1", "V1+",
  "V2", "V2+",
  "V3", "V3+",
  "V4", "V4+",
  "V5", "V5+",
  "V6", "V6+",
  "V7", "V7+",
  "V8", "V8+",
  "V9", "V9+",
  "V10", "V10+",
] as const;
const YOSEMITE_GRADE_OPTIONS = [
  "5.6", "5.6+",
  "5.7", "5.7+",
  "5.8", "5.8+",
  "5.9", "5.9+",
  "5.10a", "5.10a+",
  "5.10b", "5.10b+",
  "5.10c", "5.10c+",
  "5.10d", "5.10d+",
  "5.11a", "5.11a+",
  "5.11b", "5.11b+",
  "5.11c", "5.11c+",
  "5.11d", "5.11d+",
  "5.12a", "5.12a+",
  "5.12b", "5.12b+",
  "5.12c", "5.12c+",
  "5.12d", "5.12d+",
  "5.13a", "5.13a+",
  "5.13b", "5.13b+",
  "5.13c", "5.13c+",
  "5.13d", "5.13d+",
] as const;

export type SessionMetricDefinitionWithConfig = SessionMetricDefinition & {
  config: SessionMetricConfig | null;
};

export function asSessionMetricConfig(value: Prisma.JsonValue | null | undefined): SessionMetricConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const input = record.input === "grade" || record.input === "textarea" ? record.input : undefined;
  const gradeSystem =
    record.gradeSystem === "BOULDER_V" || record.gradeSystem === "YOSEMITE" ? record.gradeSystem : undefined;
  const gradeBucket = typeof record.gradeBucket === "string" && record.gradeBucket.trim().length > 0 ? record.gradeBucket.trim() : undefined;
  const climbingColumn =
    record.climbingColumn === "DONE" || record.climbingColumn === "FLASHED" ? record.climbingColumn : undefined;
  return {
    ...(input ? { input } : {}),
    ...(gradeSystem ? { gradeSystem } : {}),
    ...(gradeBucket ? { gradeBucket } : {}),
    ...(climbingColumn ? { climbingColumn } : {}),
  };
}

export function withSessionMetricConfig<T extends { config: Prisma.JsonValue | null }>(definition: T) {
  return {
    ...definition,
    config: asSessionMetricConfig(definition.config),
  };
}

export function sessionMetricUsesTextInput(definition: Pick<SessionMetricDefinitionWithConfig, "valueType" | "config">) {
  return definition.valueType === "TEXT";
}

export function sessionMetricUsesTextArea(definition: Pick<SessionMetricDefinitionWithConfig, "config">) {
  return definition.config?.input === "textarea";
}

export function sessionMetricUsesGradeInput(definition: Pick<SessionMetricDefinitionWithConfig, "config">) {
  return definition.config?.input === "grade";
}

export function isClimbingTemplateKey(templateKey: string | null | undefined) {
  return (
    templateKey === "indoor-bouldering" ||
    templateKey === "indoor-rope-climbing" ||
    templateKey === "indoor-sport-climbing" ||
    templateKey === "outdoor-bouldering" ||
    templateKey === "outdoor-top-rope" ||
    templateKey === "outdoor-sport-climbing" ||
    templateKey === "outdoor-trad-climbing"
  );
}

export function climbingGradeOptions(templateKey: string | null | undefined) {
  if (templateKey === "indoor-bouldering" || templateKey === "outdoor-bouldering") return [...BOULDER_GRADE_OPTIONS];
  if (
    templateKey === "indoor-rope-climbing" ||
    templateKey === "indoor-sport-climbing" ||
    templateKey === "outdoor-top-rope" ||
    templateKey === "outdoor-sport-climbing" ||
    templateKey === "outdoor-trad-climbing"
  ) {
    return [...YOSEMITE_GRADE_OPTIONS];
  }
  return [];
}

export type ClimbingGradeRowDefinition = {
  grade: string;
  doneDefinition: SessionMetricDefinitionWithConfig | null;
  flashedDefinition: SessionMetricDefinitionWithConfig | null;
};

export function climbingGradeRowDefinitions(definitions: SessionMetricDefinitionWithConfig[]) {
  const gradeMap = new Map<string, ClimbingGradeRowDefinition>();
  for (const definition of definitions) {
    const gradeBucket = definition.config?.gradeBucket;
    const climbingColumn = definition.config?.climbingColumn;
    if (!gradeBucket || !climbingColumn) continue;
    const current = gradeMap.get(gradeBucket) ?? {
      grade: gradeBucket,
      doneDefinition: null,
      flashedDefinition: null,
    };
    if (climbingColumn === "DONE") current.doneDefinition = definition;
    if (climbingColumn === "FLASHED") current.flashedDefinition = definition;
    gradeMap.set(gradeBucket, current);
  }
  return Array.from(gradeMap.values()).sort((a, b) => {
    const aValue = parseSessionGradeValue(a.grade, a.doneDefinition?.config?.gradeSystem ?? a.flashedDefinition?.config?.gradeSystem ?? undefined) ?? 0;
    const bValue = parseSessionGradeValue(b.grade, b.doneDefinition?.config?.gradeSystem ?? b.flashedDefinition?.config?.gradeSystem ?? undefined) ?? 0;
    return aValue - bValue;
  });
}

// Metric keys whose job is "where did this happen?" — kept around for back-
// compat with logs that pre-date the structured SpotPicker. New sessions
// should record location via the picker, so the form filters these out
// when the picker is active to avoid double-entry.
export const PRIMARY_LOCATION_METRIC_KEYS = new Set([
  "break_name",
  "trail_name",
  "court_name",
  "course_name",
  "mountain_name",
]);

export function templateHasPrimaryLocationMetric(definitions: SessionMetricDefinitionWithConfig[]): boolean {
  return definitions.some((d) => PRIMARY_LOCATION_METRIC_KEYS.has(d.key));
}

export function isPrimaryLocationMetric(definition: { key: string }): boolean {
  return PRIMARY_LOCATION_METRIC_KEYS.has(definition.key);
}

export function isBasketballTemplateKey(key: string | null): boolean {
  return key === "basketball-pickup" || key === "basketball-shooting";
}

export function sessionMetricInputMode(valueType: SessionMetricValueType) {
  if (valueType === "INTEGER") return "numeric";
  if (valueType === "DECIMAL") return "decimal";
  return undefined;
}

export function parseSessionMetricNumber(value: string, valueType: SessionMetricValueType) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return valueType === "INTEGER" ? Math.round(parsed) : parsed;
}

export function normalizeSessionMetricText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBoulderingGrade(raw: string) {
  const match = raw.trim().toUpperCase().match(/^V(\d+)(?:\+)?$/);
  if (!match) return null;
  return Number(match[1]);
}

function parseYosemiteGrade(raw: string) {
  const match = raw.trim().toLowerCase().match(/^5\.(\d{1,2})([abcd+\-]?)$/);
  if (!match) return null;
  const base = Number(match[1]);
  const suffix = match[2];
  const suffixScore = suffix === "-" ? 0.05 : suffix === "a" ? 0.1 : suffix === "b" ? 0.2 : suffix === "c" ? 0.3 : suffix === "d" || suffix === "+" ? 0.4 : 0;
  return base + suffixScore;
}

export function parseSessionGradeValue(raw: string, gradeSystem: SessionMetricConfig["gradeSystem"]) {
  if (gradeSystem === "BOULDER_V") return parseBoulderingGrade(raw);
  if (gradeSystem === "YOSEMITE") return parseYosemiteGrade(raw);
  return null;
}

export function parseSessionMetricGoalTarget(
  definition: Pick<SessionMetricDefinitionWithConfig, "valueType" | "label" | "config">,
  rawValue: string
) {
  if (sessionMetricUsesGradeInput(definition)) {
    const parsed = parseSessionGradeValue(rawValue, definition.config?.gradeSystem);
    if (parsed === null) {
      throw new Error(`${definition.label} target is invalid.`);
    }
    return {
      targetValue: parsed,
      displayValue: rawValue.trim(),
    };
  }

  if (definition.valueType === "INTEGER" || definition.valueType === "DECIMAL") {
    const parsed = parseSessionMetricNumber(rawValue, definition.valueType);
    if (parsed === null || parsed <= 0) {
      throw new Error(`${definition.label} target must be greater than 0.`);
    }
    return {
      targetValue: parsed,
      displayValue: rawValue.trim(),
    };
  }

  throw new Error(`${definition.label} cannot be used as a goal metric.`);
}

export function formatSessionMetricValue(
  definition: Pick<SessionMetricDefinitionWithConfig, "valueType" | "unit" | "config">,
  value: { numberValue?: number | null; textValue?: string | null; booleanValue?: boolean | null } | number
) {
  if (typeof value === "number") {
    if (sessionMetricUsesGradeInput(definition)) return definition.unit ? `${value} ${definition.unit}` : String(value);
    if (definition.valueType === "INTEGER") return `${Math.round(value)}${definition.unit ? ` ${definition.unit}` : ""}`;
    if (definition.valueType === "DECIMAL") return `${value.toFixed(1)}${definition.unit ? ` ${definition.unit}` : ""}`;
    return String(value);
  }

  if (definition.valueType === "BOOLEAN") return value.booleanValue ? "Yes" : "No";
  if (definition.valueType === "TEXT") return value.textValue ?? "";
  if (definition.valueType === "INTEGER") return value.numberValue !== null && value.numberValue !== undefined ? `${Math.round(value.numberValue)}${definition.unit ? ` ${definition.unit}` : ""}` : "";
  if (definition.valueType === "DECIMAL") return value.numberValue !== null && value.numberValue !== undefined ? `${value.numberValue.toFixed(1)}${definition.unit ? ` ${definition.unit}` : ""}` : "";
  return "";
}

export function sessionMetricNumericValue(
  definition: Pick<SessionMetricDefinitionWithConfig, "valueType" | "config">,
  value: { numberValue?: number | null; textValue?: string | null; booleanValue?: boolean | null }
) {
  if (definition.valueType === "INTEGER" || definition.valueType === "DECIMAL") return value.numberValue ?? null;
  if (definition.valueType === "BOOLEAN") return value.booleanValue ? 1 : 0;
  if (sessionMetricUsesGradeInput(definition) && value.textValue) {
    return parseSessionGradeValue(value.textValue, definition.config?.gradeSystem);
  }
  return null;
}

export function sessionMetricGoalValueLabel(
  definition: Pick<SessionMetricDefinitionWithConfig, "valueType" | "unit" | "config">,
  value: number,
  rawLabel?: string | null
) {
  if (sessionMetricUsesGradeInput(definition)) return rawLabel?.trim() || String(value);
  if (definition.valueType === "INTEGER") return `${Math.round(value)}${definition.unit ? ` ${definition.unit}` : ""}`;
  if (definition.valueType === "DECIMAL") return `${value.toFixed(1)}${definition.unit ? ` ${definition.unit}` : ""}`;
  return String(value);
}
