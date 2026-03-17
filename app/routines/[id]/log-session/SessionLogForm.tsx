"use client";

import Link from "next/link";
import { useState } from "react";
import { logSession } from "../../actions";
import SessionMetricFields, { type SessionMetricDraftValue } from "./SessionMetricFields";
import {
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";

export default function SessionLogForm({
  routineId,
  templateName,
  definitions,
}: {
  routineId: string;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
}) {
  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const durationSec = Number(durationMin) * 60;
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      alert("Enter a valid duration in minutes.");
      return;
    }

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
      await logSession({
        routineId,
        durationSec,
        location,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        sessionMetricValues: structuredValues,
      });
      window.location.href = "/routines";
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 580 }}>
      <div>
        <label style={styles.label}>Duration (minutes)</label>
        <input style={styles.input} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
      </div>

      <div>
        <label style={styles.label}>Location (optional)</label>
        <input style={styles.input} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Gym, beach, bouldering wall..." />
      </div>

      {templateName ? <div style={styles.help}>Template: {templateName}</div> : null}

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
        <label style={styles.label}>Notes (optional)</label>
        <textarea style={{ ...styles.input, minHeight: 90 }} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <details style={styles.details}>
        <summary data-collapsible-summary style={styles.summary}>Log with custom date/time (optional)</summary>
        <div style={{ marginTop: 8 }}>
          <label style={styles.label}>Performed at</label>
          <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
        </div>
      </details>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Session"}
        </button>
        <Link href="/routines" style={styles.linkBtn}>
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
  details: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(128,128,128,0.06)",
  },
  summary: {
    cursor: "pointer",
    fontWeight: 800 as const,
    fontSize: 13,
  },
  help: {
    fontSize: 12,
    opacity: 0.72,
  },
};
