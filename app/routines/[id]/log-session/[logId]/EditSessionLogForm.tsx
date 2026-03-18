"use client";

import Link from "next/link";
import { useState } from "react";
import { updateSessionLog } from "../../../actions";
import ClimbingGradeRowsEditor from "../ClimbingGradeRowsEditor";
import SessionMetricFields, { type SessionMetricDraftValue } from "../SessionMetricFields";
import {
  isClimbingTemplateKey,
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditSessionLogForm({
  routineId,
  logId,
  returnTo,
  initialDurationSec,
  initialLocation,
  initialNotes,
  initialPerformedAt,
  templateKey,
  templateName,
  definitions,
  initialValues,
  preferredClimbingGrades,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDurationSec: number;
  initialLocation: string;
  initialNotes: string;
  initialPerformedAt: Date;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  initialValues: Record<string, SessionMetricDraftValue>;
  preferredClimbingGrades: string[];
}) {
  const [durationMin, setDurationMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [location, setLocation] = useState(initialLocation);
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>(initialValues);
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const trimmedDuration = durationMin.trim();
    const parsedDurationMin = trimmedDuration ? Number(trimmedDuration) : null;
    if (parsedDurationMin !== null && (!Number.isFinite(parsedDurationMin) || parsedDurationMin <= 0)) {
      alert("Enter a valid duration in minutes or leave it blank.");
      return;
    }
    const durationSec = parsedDurationMin !== null ? parsedDurationMin * 60 : null;

    const structuredValues: Array<{
      metricDefinitionId: string;
      numberValue?: number;
      textValue?: string;
      booleanValue?: boolean;
    }> = [];
    for (const definition of definitions) {
      const draft = sessionMetricValues[definition.id] ?? {};
      if (definition.valueType === "INTEGER" || definition.valueType === "DECIMAL") {
        const numberValue = parseSessionMetricNumber(draft.numberValue ?? "", definition.valueType);
        if (definition.isRequired && numberValue === null) throw new Error(`${definition.label} is required.`);
        if (numberValue !== null) {
          structuredValues.push({ metricDefinitionId: definition.id, numberValue });
        }
        continue;
      }
      if (definition.valueType === "BOOLEAN") {
        if (draft.booleanValue) {
          structuredValues.push({ metricDefinitionId: definition.id, booleanValue: true });
        }
        continue;
      }
      const textValue = normalizeSessionMetricText(draft.textValue ?? "");
      if (definition.isRequired && !textValue) throw new Error(`${definition.label} is required.`);
      if (textValue) {
        structuredValues.push({ metricDefinitionId: definition.id, textValue });
      }
    }

    setSaving(true);
    try {
      await updateSessionLog({
        routineId,
        logId,
        durationSec,
        location,
        notes,
        performedAtLocal,
        sessionMetricValues: structuredValues,
        preferredClimbingGrades: isClimbingTemplateKey(templateKey) ? selectedClimbingGrades : undefined,
      });
      window.location.href = returnTo;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 580 }}>
      <div>
        <label style={styles.label}>Performed at</label>
        <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
      </div>

      <div>
        <label style={styles.label}>Duration (minutes, optional)</label>
        <input style={styles.input} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
      </div>

      <div>
        <label style={styles.label}>Location</label>
        <input style={styles.input} value={location} onChange={(event) => setLocation(event.target.value)} />
      </div>

      {templateName ? <div style={{ fontSize: 12, opacity: 0.72 }}>Template: {templateName}</div> : null}

      {isClimbingTemplateKey(templateKey) ? (
        <ClimbingGradeRowsEditor
          templateKey={templateKey}
          definitions={definitions}
          values={sessionMetricValues}
          selectedGrades={selectedClimbingGrades}
          onValuesChange={(metricDefinitionId, value) =>
            setSessionMetricValues((current) => ({
              ...current,
              [metricDefinitionId]: {
                ...current[metricDefinitionId],
                ...value,
              },
            }))
          }
          onSelectedGradesChange={setSelectedClimbingGrades}
        />
      ) : null}

      <SessionMetricFields
        definitions={definitions}
        values={sessionMetricValues}
        onChange={(metricDefinitionId, value) =>
          setSessionMetricValues((current) => ({
            ...current,
            [metricDefinitionId]: {
              ...current[metricDefinitionId],
              ...value,
            },
          }))
        }
      />

      <div>
        <label style={styles.label}>Notes</label>
        <textarea style={{ ...styles.input, minHeight: 90 }} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <Link href={returnTo} style={styles.linkBtn}>
          Back
        </Link>
      </div>
    </div>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 10,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  linkBtn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
    textDecoration: "none",
  },
};
