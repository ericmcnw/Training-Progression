"use client";

import { useState } from "react";
import { updateSessionLog } from "../../../actions";
import ClimbingGradeRowsEditor from "../ClimbingGradeRowsEditor";
import SessionMetricFields, { type SessionMetricDraftValue } from "../SessionMetricFields";
import {
  Field,
  FormActions,
  FormSection,
  FormStack,
  helperTextStyle,
  inputStyle,
  textareaStyle,
} from "../../log/form-ui";
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
    <FormStack maxWidth={640}>
      <FormSection title="Session details">
        <Field label="Performed at">
          <input type="datetime-local" style={inputStyle} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
        </Field>

        <Field label="Duration (minutes, optional)">
          <input style={inputStyle} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
        </Field>

        <Field label="Location">
          <input style={inputStyle} value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>

        {templateName ? <div style={helperTextStyle}>Template: {templateName}</div> : null}
      </FormSection>

      {isClimbingTemplateKey(templateKey) ? (
        <FormSection title="Climbing details">
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

      <FormSection title="Session metrics">
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
        <Field label="Session notes">
          <textarea style={textareaStyle} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FormSection>

      <FormActions
        primaryLabel="Save Changes"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref={returnTo}
      />
    </FormStack>
  );
}
