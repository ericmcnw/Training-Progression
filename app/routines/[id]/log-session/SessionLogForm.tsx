"use client";

import { useEffect, useRef, useState } from "react";
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
  inputStyle,
  textareaStyle,
} from "../log/form-ui";
import {
  isClimbingTemplateKey,
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";
import {
  type SessionDraft,
  clearDraftFromStorage,
  draftAgeLabel,
  draftIsRecent,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "@/lib/log-draft";
import { useLogDraft } from "@/app/contexts/LogDraftContext";

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
  onComplete,
  onBack,
}: {
  routineId: string;
  routineName: string;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  preferredClimbingGrades: string[];
  activePainZones?: PainCheckZone[];
  onComplete?: () => void;
  onBack?: () => void;
}) {
  const { saveDraft: contextSaveDraft, clearDraft: contextClearDraft } = useLogDraft();
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });

  const templateHasNotes = definitions.some((d) => d.config?.input === "textarea" && d.valueType === "TEXT");
  const isClimbing = isClimbingTemplateKey(templateKey);

  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [zoneTagLogId, setZoneTagLogId] = useState<string | null>(null);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);

  // Draft state
  const [draftBanner, setDraftBanner] = useState<"recent" | "older" | null>(null);
  const isDirtyRef = useRef(false);
  const draftStartedAtRef = useRef(new Date().toISOString());

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraftFromStorage(routineId);
    if (!draft || draft.kind !== "SESSION") return;

    draftStartedAtRef.current = draft.startedAt;
    setDurationMin(draft.durationMin);
    setLocation(draft.location);
    setSessionMetricValues(draft.sessionMetricValues);
    setSelectedClimbingGrades(draft.selectedClimbingGrades);
    setNotes(draft.notes);
    setPerformedAtLocal(draft.performedAtLocal);
    isDirtyRef.current = true;
    setDraftBanner(draftIsRecent(draft) ? "recent" : "older");
    contextSaveDraft(draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft on any state change
  useEffect(() => {
    if (!isDirtyRef.current) return;
    const draft: SessionDraft = {
      kind: "SESSION",
      routineId,
      routineName,
      startedAt: draftStartedAtRef.current,
      durationMin,
      location,
      sessionMetricValues,
      selectedClimbingGrades,
      notes,
      performedAtLocal,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      contextSaveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMin, location, sessionMetricValues, selectedClimbingGrades, notes, performedAtLocal]);

  function markDirty() {
    isDirtyRef.current = true;
  }

  function handleStartFresh() {
    clearDraftFromStorage(routineId);
    contextClearDraft(routineId);
    setDurationMin("");
    setLocation("");
    setSessionMetricValues({});
    setSelectedClimbingGrades(preferredClimbingGrades);
    setNotes("");
    setPerformedAtLocal("");
    isDirtyRef.current = false;
    draftStartedAtRef.current = new Date().toISOString();
    setDraftBanner(null);
  }

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
            finish();
          }
        }}
      />
    );
  }

  if (painCheckLogId) {
    return <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={finish} />;
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
      clearDraftFromStorage(routineId);
      contextClearDraft(routineId);
      if (logId && isClimbing) {
        setZoneTagLogId(logId);
        return;
      }
      if (logId && activePainZones.length > 0) {
        setPainCheckLogId(logId);
        return;
      }
      finish();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save session.");
    } finally {
      setSaving(false);
    }
  }

  const hasVisibleMetrics = definitions.filter(
    (d) => !(d.config?.gradeBucket && d.config?.climbingColumn)
  ).length > 0;

  return (
    <FormStack maxWidth={640}>

      {/* Draft banners */}
      {draftBanner === "recent" && (
        <div style={draftBannerGreen}>
          <span>In-progress session restored · {draftAgeLabel({ startedAt: draftStartedAtRef.current } as SessionDraft)}</span>
          <button type="button" onClick={handleStartFresh} style={draftBannerBtnStyle}>Start fresh</button>
        </div>
      )}
      {draftBanner === "older" && (
        <div style={draftBannerAmber}>
          <span>Unfinished session from {draftAgeLabel({ startedAt: draftStartedAtRef.current } as SessionDraft)} — continuing from draft</span>
          <button type="button" onClick={handleStartFresh} style={draftBannerBtnStyle}>Start fresh</button>
        </div>
      )}

      <FormSection title="Overview">
        <Field label="Duration (minutes, optional)">
          <input
            style={inputStyle}
            value={durationMin}
            onChange={(e) => { markDirty(); setDurationMin(e.target.value); }}
            inputMode="decimal"
            placeholder="e.g. 90"
          />
        </Field>

        <Field label="Location (optional)">
          <input
            style={inputStyle}
            value={location}
            onChange={(e) => { markDirty(); setLocation(e.target.value); }}
            placeholder="Gym, crag, trail…"
          />
        </Field>

        <Field label="Performed at (leave blank for now)">
          <input
            type="datetime-local"
            style={inputStyle}
            value={performedAtLocal}
            onChange={(e) => { markDirty(); setPerformedAtLocal(e.target.value); }}
          />
        </Field>

        {templateName ? (
          <div style={{ fontSize: 12, opacity: 0.65 }}>Template: {templateName}</div>
        ) : null}
        {!templateKey && definitions.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.65, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.3)", background: "rgba(128,128,128,0.06)" }}>
            No template configured — only duration and notes will be saved.{" "}
            <a href={`/routines/${routineId}/edit`} style={{ color: "inherit", opacity: 0.9 }}>
              Add a template
            </a>{" "}
            to track structured metrics for this session type.
          </div>
        ) : null}
      </FormSection>

      {isClimbing ? (
        <FormSection title="Climbing">
          <ClimbingGradeRowsEditor
            templateKey={templateKey!}
            definitions={definitions}
            values={sessionMetricValues}
            selectedGrades={selectedClimbingGrades}
            onValuesChange={(metricDefinitionId, value) => {
              markDirty();
              setSessionMetricValues((current) => ({
                ...current,
                [metricDefinitionId]: { ...current[metricDefinitionId], ...value },
              }));
            }}
            onSelectedGradesChange={(grades) => { markDirty(); setSelectedClimbingGrades(grades); }}
          />
        </FormSection>
      ) : null}

      {hasVisibleMetrics ? (
        <FormSection title="Metrics">
          <SessionMetricFields
            definitions={definitions}
            values={sessionMetricValues}
            onChange={(metricDefinitionId, value) => {
              markDirty();
              setSessionMetricValues((current) => ({
                ...current,
                [metricDefinitionId]: { ...current[metricDefinitionId], ...value },
              }));
            }}
          />
        </FormSection>
      ) : null}

      {!templateHasNotes && (
        <FormSection title="Notes">
          <Field label="Session notes (optional)">
            <textarea
              style={textareaStyle}
              value={notes}
              onChange={(e) => { markDirty(); setNotes(e.target.value); }}
            />
          </Field>
        </FormSection>
      )}

      <FormActions
        primaryLabel="Save Session"
        primaryPendingLabel="Saving…"
        saving={saving}
        onPrimary={onSave}
        backHref="/routines"
        onBack={onBack}
      />
    </FormStack>
  );
}

const draftBannerGreen: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(84,203,130,0.4)",
  background: "rgba(84,203,130,0.08)",
  fontSize: 13,
  fontWeight: 700,
};

const draftBannerAmber: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(251,191,36,0.4)",
  background: "rgba(251,191,36,0.07)",
  fontSize: 13,
  fontWeight: 700,
};

const draftBannerBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.45)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};
