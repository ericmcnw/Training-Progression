"use client";

import { useState } from "react";
import { logSession } from "../../actions";
import PostSessionPainCheck, { type PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import SportZoneTagger from "@/app/components/log/SportZoneTagger";
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

// Zones pre-selected for climbing sessions: fingers/hands, forearms, lats (upper-back), traps
const CLIMBING_AUTO_ZONES = [
  { slug: "hands", label: "Fingers / Hands" },
  { slug: "forearm", label: "Forearms" },
  { slug: "upper-back", label: "Lats / Upper Back" },
  { slug: "trapezius", label: "Traps" },
];
const CLIMBING_AUTO_ZONE_SLUGS = CLIMBING_AUTO_ZONES.map((z) => z.slug);

export default function SessionLogForm({
  routineId,
  templateKey,
  templateName,
  definitions,
  preferredClimbingGrades,
  routineName,
  activePainZones = [],
}: {
  routineId: string;
  routineName: string;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  preferredClimbingGrades: string[];
  activePainZones?: PainCheckZone[];
}) {
  // If the template already has a "Session Notes" textarea metric, hide the generic notes section
  const templateHasNotes = definitions.some((d) => d.config?.input === "textarea" && d.valueType === "TEXT");

  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [zoneTagLogId, setZoneTagLogId] = useState<string | null>(null);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);

  const isClimbing = isClimbingTemplateKey(templateKey);

  // Zone tagger step (climbing only) — shown after save, before pain check
  if (zoneTagLogId) {
    return (
      <SportZoneTagger
        zones={CLIMBING_AUTO_ZONES}
        routineLogId={zoneTagLogId}
        label={routineName}
        preSelectedSlugs={CLIMBING_AUTO_ZONE_SLUGS}
        onDone={() => {
          if (activePainZones.length > 0) {
            setPainCheckLogId(zoneTagLogId);
            setZoneTagLogId(null);
          } else {
            window.location.href = "/routines";
          }
        }}
      />
    );
  }

  if (painCheckLogId) {
    return <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={() => { window.location.href = "/routines"; }} />;
  }

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
      const logId = await logSession({
        routineId,
        durationSec,
        location,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        sessionMetricValues: structuredValues,
        preferredClimbingGrades: isClimbing ? selectedClimbingGrades : undefined,
      });
      if (logId && isClimbing) {
        setZoneTagLogId(logId);
        return;
      }
      if (logId && activePainZones.length > 0) {
        setPainCheckLogId(logId);
        return;
      }
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

      {!templateHasNotes && (
        <FormSection title="Notes">
          <Field label="Session notes (optional)">
            <textarea style={textareaStyle} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </FormSection>
      )}

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
