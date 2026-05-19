"use client";

import { useEffect, useMemo, useState } from "react";
import { updateSessionLog } from "../../../actions";
import ClimbingGradeRowsEditor from "../ClimbingGradeRowsEditor";
import SessionMetricFields, { type SessionMetricDraftValue } from "../SessionMetricFields";
import SpotPicker, { type SpotPickerValue } from "@/app/components/log/SpotPicker";
import {
  type ActivitySpotConfig,
  type SpotPickerItem,
  getActivitySpotConfig,
} from "@/lib/activity-spots";
import { COLOR } from "@/lib/design-tokens";
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
import type { ClimbLocationType } from "@/lib/climb-types";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Climbing-spot config (GYM/CRAG) lives here too — mirrors SessionLogForm.
// Defaults to gym for indoor templates, crag for outdoor.
function buildClimbingSpotConfig(isOutdoor: boolean): ActivitySpotConfig {
  const gym = { value: "GYM", label: "Gym", emoji: "🏠", pinColor: COLOR.blue };
  const crag = { value: "CRAG", label: "Crag", emoji: "🪨", pinColor: COLOR.green };
  return {
    supportsMap: true,
    spotTypes: isOutdoor ? [crag, gym] : [gym, crag],
    defaultPinColor: COLOR.orange,
    spotNoun: isOutdoor ? "crag" : "gym",
  };
}

// Maps the picker's current value to the action's spot params.
//   - value=null with no initial spot → omit all spot params (no change)
//   - value=null with an initial spot → user explicitly cleared, send clearSpot
//   - value=saved or new → send the corresponding spot fields
// The `hadInitialSpot` distinction prevents an idle save from clobbering a
// concurrent spot edit on a different tab/process.
function spotParamsForUpdate(value: SpotPickerValue, isClimbing: boolean, hadInitialSpot: boolean) {
  if (!value) return hadInitialSpot ? { clearSpot: true } : {};
  if (value.kind === "saved") {
    return value.ref.kind === "climbLocation"
      ? { climbLocationId: value.ref.id }
      : { activitySpotId: value.ref.id };
  }
  const d = value.draft;
  if (isClimbing) {
    const type: ClimbLocationType = d.type === "CRAG" ? "CRAG" : "GYM";
    return {
      newClimbLocationName: d.name,
      newClimbLocationType: type,
      newClimbLocationRegion: d.region ?? undefined,
      newClimbLocationLatitude: d.latitude ?? undefined,
      newClimbLocationLongitude: d.longitude ?? undefined,
      newClimbLocationOsmType: d.osmType ?? undefined,
      newClimbLocationOsmId: d.osmId ?? undefined,
    };
  }
  return {
    newActivitySpotName: d.name,
    newActivitySpotType: d.type,
    newActivitySpotRegion: d.region,
    newActivitySpotLatitude: d.latitude,
    newActivitySpotLongitude: d.longitude,
    newActivitySpotOsmType: d.osmType,
    newActivitySpotOsmId: d.osmId,
  };
}

export default function EditSessionLogForm({
  routineId,
  logId,
  returnTo,
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
  templateKey,
  templateName,
  definitions,
  initialValues,
  preferredClimbingGrades,
  activitySlug = null,
  savedSpots = [],
  savedClimbLocations = [],
  initialSpot = null,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  initialValues: Record<string, SessionMetricDraftValue>;
  preferredClimbingGrades: string[];
  activitySlug?: string | null;
  savedSpots?: SpotPickerItem[];
  savedClimbLocations?: Array<{ id: string; name: string; type: "GYM" | "CRAG"; region: string | null; osmType: string | null; osmId: string | null }>;
  initialSpot?: SpotPickerValue;
}) {
  const isClimbing = isClimbingTemplateKey(templateKey);
  const isOutdoorClimbing = isClimbing && (templateKey ?? "").startsWith("outdoor-");

  const [durationMin, setDurationMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>(initialValues);
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(initialSpot);
  const [recentSpots, setRecentSpots] = useState<Array<{ ref: { kind: "activitySpot" | "climbLocation"; id: string }; name: string; region: string | null }>>([]);
  const [saving, setSaving] = useState(false);

  // Picker config — climbing uses GYM/CRAG; everything else uses the
  // activity registry's spot config.
  const nonClimbingSpotConfig = activitySlug ? getActivitySpotConfig(activitySlug) : null;
  const climbingSpotConfig = isClimbing ? buildClimbingSpotConfig(isOutdoorClimbing) : null;
  const spotPickerConfig = isClimbing ? climbingSpotConfig : nonClimbingSpotConfig;
  const spotNoun = isClimbing ? (isOutdoorClimbing ? "crag" : "gym") : spotPickerConfig?.spotNoun ?? "spot";
  const showSpotPicker =
    spotPickerConfig != null &&
    (isClimbing || (activitySlug != null && nonClimbingSpotConfig?.supportsMap === true));

  // Unify climbing's saved-location list under the same SpotPickerItem shape
  // so the picker's dropdown matches the create-log behavior. Memoized to
  // keep the picker's downstream useMemo calls stable.
  const unifiedSavedSpots = useMemo<SpotPickerItem[]>(() => {
    if (!isClimbing) return savedSpots;
    return savedClimbLocations.map((loc) => ({
      id: loc.id,
      kind: "climbLocation" as const,
      name: loc.name,
      region: loc.region,
      type: loc.type,
      originSlug: "climbing",
      originLabel: "Climbing",
      isOwnActivity: true,
      osmType: loc.osmType,
      osmId: loc.osmId,
    }));
  }, [isClimbing, savedClimbLocations, savedSpots]);

  const spotPickerSlug = isClimbing ? "climbing" : activitySlug;
  useEffect(() => {
    if (!spotPickerSlug) { setRecentSpots([]); return; }
    let cancelled = false;
    fetch(`/api/spots/recent?slug=${encodeURIComponent(spotPickerSlug)}&limit=5`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("recent fetch failed"))))
      .then((data) => { if (!cancelled) setRecentSpots(data.recent ?? []); })
      .catch(() => { if (!cancelled) setRecentSpots([]); });
    return () => { cancelled = true; };
  }, [spotPickerSlug]);

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
      const spotParams = spotParamsForUpdate(spotValue, isClimbing, initialSpot !== null);
      await updateSessionLog({
        routineId,
        logId,
        durationSec,
        notes,
        performedAtLocal,
        sessionMetricValues: structuredValues,
        preferredClimbingGrades: isClimbingTemplateKey(templateKey) ? selectedClimbingGrades : undefined,
        activitySlug: activitySlug ?? undefined,
        ...spotParams,
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

        {showSpotPicker && spotPickerConfig ? (
          <SpotPicker
            config={spotPickerConfig}
            spotNoun={spotNoun}
            savedSpots={unifiedSavedSpots}
            recentSpots={recentSpots}
            value={spotValue}
            onChange={setSpotValue}
          />
        ) : null}

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
