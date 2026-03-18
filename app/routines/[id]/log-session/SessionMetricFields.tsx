"use client";

import { sessionMetricInputMode, sessionMetricUsesTextArea, type SessionMetricDefinitionWithConfig } from "@/lib/session-templates";

export type SessionMetricDraftValue = {
  numberValue?: string;
  textValue?: string;
  booleanValue?: boolean;
};

export default function SessionMetricFields({
  definitions,
  values,
  onChange,
}: {
  definitions: SessionMetricDefinitionWithConfig[];
  values: Record<string, SessionMetricDraftValue>;
  onChange: (metricDefinitionId: string, value: SessionMetricDraftValue) => void;
}) {
  const hasClimbingRows = definitions.some((definition) => definition.config?.gradeBucket && definition.config?.climbingColumn);
  const visibleDefinitions = definitions.filter((definition) => {
    if (definition.config?.gradeBucket && definition.config?.climbingColumn) return false;
    if (hasClimbingRows && definition.config?.input === "grade") return false;
    return true;
  });
  if (visibleDefinitions.length === 0) return null;

  return (
    <div style={sectionStyle}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>Template metrics</div>
      <div style={gridStyle}>
        {visibleDefinitions.map((definition) => {
          const value = values[definition.id] ?? {};
          const label = definition.unit ? `${definition.label} (${definition.unit})` : definition.label;

          if (definition.valueType === "BOOLEAN") {
            return (
              <label key={definition.id} style={{ ...fieldStyle, justifyContent: "center" }}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value.booleanValue)}
                  onChange={(event) => onChange(definition.id, { booleanValue: event.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
              </label>
            );
          }

          if (definition.valueType === "TEXT" && sessionMetricUsesTextArea(definition)) {
            return (
              <label key={definition.id} style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                <span>{label}</span>
                <textarea
                  style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                  value={value.textValue ?? ""}
                  onChange={(event) => onChange(definition.id, { textValue: event.target.value })}
                />
              </label>
            );
          }

          if (definition.valueType === "TEXT") {
            return (
              <label key={definition.id} style={fieldStyle}>
                <span>{label}</span>
                <input
                  style={inputStyle}
                  value={value.textValue ?? ""}
                  onChange={(event) => onChange(definition.id, { textValue: event.target.value })}
                />
              </label>
            );
          }

          return (
            <label key={definition.id} style={fieldStyle}>
              <span>{label}</span>
              <input
                style={inputStyle}
                inputMode={sessionMetricInputMode(definition.valueType)}
                value={value.numberValue ?? ""}
                onChange={(event) => onChange(definition.id, { numberValue: event.target.value })}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  gap: 8,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
};
