"use client";

import { useState } from "react";
import { logSession } from "../../actions";
import ClimbingGradeRowsEditor from "./ClimbingGradeRowsEditor";
import SessionMetricFields, { type SessionMetricDraftValue } from "./SessionMetricFields";
import {
  Field,
  FormActions,
  FormSection,
  FormStack,
  OptionalDateSection,
  helperTextStyle,
  inputStyle,
  textareaStyle,
} from "../log/form-ui";
import {
  isClimbingTemplateKey,
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";

export default function SessionLogForm({
  routineId,
  templateKey,
  templateName,
  definitions,
  preferredClimbingGrades,
}: {
  routineId: string;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  preferredClimbingGrades: string[];
}) {
  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
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
      await logSession({
        routineId,
        durationSec,
        location,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        sessionMetricValues: structuredValues,
        preferredClimbingGrades: isClimbingTemplateKey(templateKey) ? selectedClimbingGrades : undefined,
      });
      window.location.href = "/routines";
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={640}>
      <FormSection title="Session details" description="Use the same review-friendly structure as the other routine logs, then fill in only the fields that matter for this session type.">
        <Field label="Duration (minutes, optional)">
          <input style={inputStyle} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
        </Field>

        <Field label="Location (optional)">
          <input style={inputStyle} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Gym, beach, bouldering wall..." />
        </Field>

        {templateName ? <div style={helperTextStyle}>Template: {templateName}</div> : null}
        {!templateKey && definitions.length === 0 ? (
          <div style={{ ...helperTextStyle, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.3)", background: "rgba(128,128,128,0.06)" }}>
            No template configured — only duration and notes will be saved.{" "}
            <a href={`/routines/${routineId}/edit`} style={{ color: "inherit", opacity: 0.9 }}>
              Add a template
            </a>{" "}
            to track structured metrics for this session type.
          </div>
        ) : null}
      </FormSection>

      {isClimbingTemplateKey(templateKey) ? (
        <FormSection title="Climbing details" description="Preferred grades stay grouped with the rest of the session metrics for easier mobile editing.">
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
        </FormSection>
      ) : null}

      <FormSection title="Session metrics" description="Structured metrics stay here so every session-type routine follows the same scan pattern.">
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
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes (optional)">
          <textarea style={textareaStyle} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FormSection>

      <OptionalDateSection value={performedAtLocal} onChange={setPerformedAtLocal} />

      <FormActions
        primaryLabel="Save Session"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref="/routines"
      />
    </FormStack>
  );
}
