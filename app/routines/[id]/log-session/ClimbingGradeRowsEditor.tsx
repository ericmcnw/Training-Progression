"use client";

import { useMemo } from "react";
import type { SessionMetricDraftValue } from "./SessionMetricFields";
import {
  climbingGradeOptions,
  climbingGradeRowDefinitions,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";

export default function ClimbingGradeRowsEditor({
  templateKey,
  definitions,
  values,
  selectedGrades,
  onValuesChange,
  onSelectedGradesChange,
}: {
  templateKey: string;
  definitions: SessionMetricDefinitionWithConfig[];
  values: Record<string, SessionMetricDraftValue>;
  selectedGrades: string[];
  onValuesChange: (metricDefinitionId: string, value: SessionMetricDraftValue) => void;
  onSelectedGradesChange: (grades: string[]) => void;
}) {
  const gradeRows = useMemo(() => climbingGradeRowDefinitions(definitions), [definitions]);
  const availableGrades = useMemo(
    () => climbingGradeOptions(templateKey).filter((grade) => !selectedGrades.includes(grade)),
    [selectedGrades, templateKey]
  );
  const visibleRows = gradeRows.filter((row) => selectedGrades.includes(row.grade));

  const climbingSummary = useMemo(() => {
    let totalSends = 0;
    let totalFlashes = 0;
    for (const row of visibleRows) {
      totalSends += Number(values[row.doneDefinition?.id ?? ""]?.numberValue ?? 0) || 0;
      totalFlashes += Number(values[row.flashedDefinition?.id ?? ""]?.numberValue ?? 0) || 0;
    }
    return { totalSends, totalFlashes };
  }, [values, visibleRows]);

  if (gradeRows.length === 0) return null;

  return (
    <div style={sectionStyle}>
      <div style={headerStyle}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Grades</div>
          <div style={helpStyle}>Add only the grades you used. Each row tracks done and flashed counts.</div>
        </div>
        <div style={addRowStyle}>
          <select
            value=""
            onChange={(event) => {
              const nextGrade = event.target.value;
              if (!nextGrade) return;
              onSelectedGradesChange(Array.from(new Set([...selectedGrades, nextGrade])));
            }}
            style={selectStyle}
          >
            <option value="">Add grade...</option>
            {availableGrades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div style={helpStyle}>No grades selected yet.</div>
      ) : (
        <>
          <div style={tableStyle}>
            <div style={tableHeaderStyle}>Grade</div>
            <div style={tableHeaderStyle}>Done</div>
            <div style={tableHeaderStyle}>Flashed</div>
            <div style={tableHeaderStyle}>Remove</div>
            {visibleRows.map((row) => (
              <GradeRow
                key={row.grade}
                row={row}
                values={values}
                onValuesChange={onValuesChange}
                onRemove={() => onSelectedGradesChange(selectedGrades.filter((grade) => grade !== row.grade))}
              />
            ))}
          </div>
          {(climbingSummary.totalSends > 0 || climbingSummary.totalFlashes > 0) && (
            <div style={summaryBarStyle}>
              <span style={summaryChipStyle}>
                <span style={{ opacity: 0.65, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>SENDS</span>
                <span style={{ fontSize: 18, fontWeight: 900 }}>{climbingSummary.totalSends}</span>
              </span>
              <span style={summaryChipStyle}>
                <span style={{ opacity: 0.65, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>FLASHED</span>
                <span style={{ fontSize: 18, fontWeight: 900 }}>{climbingSummary.totalFlashes}</span>
              </span>
              <span style={summaryChipStyle}>
                <span style={{ opacity: 0.65, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>TOTAL</span>
                <span style={{ fontSize: 18, fontWeight: 900 }}>{climbingSummary.totalSends + climbingSummary.totalFlashes}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GradeRow({
  row,
  values,
  onValuesChange,
  onRemove,
}: {
  row: ReturnType<typeof climbingGradeRowDefinitions>[number];
  values: Record<string, SessionMetricDraftValue>;
  onValuesChange: (metricDefinitionId: string, value: SessionMetricDraftValue) => void;
  onRemove: () => void;
}) {
  const doneValue = row.doneDefinition ? values[row.doneDefinition.id]?.numberValue ?? "" : "";
  const flashedValue = row.flashedDefinition ? values[row.flashedDefinition.id]?.numberValue ?? "" : "";

  return (
    <>
      <div style={cellLabelStyle}>{row.grade}</div>
      <input
        style={inputStyle}
        inputMode="numeric"
        value={doneValue}
        onChange={(event) => {
          if (row.doneDefinition) onValuesChange(row.doneDefinition.id, { numberValue: event.target.value });
        }}
      />
      <input
        style={inputStyle}
        inputMode="numeric"
        value={flashedValue}
        onChange={(event) => {
          if (row.flashedDefinition) onValuesChange(row.flashedDefinition.id, { numberValue: event.target.value });
        }}
      />
      <button type="button" onClick={onRemove} style={removeButtonStyle}>
        -
      </button>
    </>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  gap: 10,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

const addRowStyle: React.CSSProperties = {
  minWidth: 180,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
};

const tableStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(80px, 1fr) minmax(80px, 110px) minmax(80px, 110px) 48px",
  gap: 8,
  alignItems: "center",
};

const tableHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
};

const cellLabelStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 8px",
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
};

const removeButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontWeight: 900,
  fontSize: 20,
  lineHeight: 1,
};

const summaryBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  paddingTop: 4,
};

const summaryChipStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  flex: 1,
  padding: "8px 10px",
  border: "1px solid rgba(34,197,94,0.25)",
  borderRadius: 10,
  background: "rgba(34,197,94,0.06)",
};
