import type { Prisma, SessionMetricDefinition, SessionMetricValueType } from "@/generated/prisma";

export const SESSION_TEMPLATE_KEYS = [
  "indoor-bouldering",
  "indoor-rope-climbing",
  "hiking",
  "surfing",
  "snowboarding",
] as const;

export type SessionTemplateKey = (typeof SESSION_TEMPLATE_KEYS)[number];

export type SessionMetricConfig = {
  input?: "grade" | "textarea";
  gradeSystem?: "BOULDER_V" | "YOSEMITE";
};

export type SessionMetricDefinitionWithConfig = SessionMetricDefinition & {
  config: SessionMetricConfig | null;
};

export function asSessionMetricConfig(value: Prisma.JsonValue | null | undefined): SessionMetricConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const input = record.input === "grade" || record.input === "textarea" ? record.input : undefined;
  const gradeSystem =
    record.gradeSystem === "BOULDER_V" || record.gradeSystem === "YOSEMITE" ? record.gradeSystem : undefined;
  return {
    ...(input ? { input } : {}),
    ...(gradeSystem ? { gradeSystem } : {}),
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
