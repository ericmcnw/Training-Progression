"use client";

import { useEffect, useMemo, useState } from "react";
import { updateSessionLog } from "../../../actions";
import ClimbSessionLogger from "../ClimbSessionLogger";
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
  isPrimaryLocationMetric,
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";
import {
  climbingDisciplineLabel,
  climbingDisciplineForTemplateKey,
  type ClimbAttemptDraft,
  type ClimbingDiscipline,
  type ClimbLocationType,
  type ClimbProblemBasic,
  type QuickClimbRow,
} from "@/lib/climb-types";
import {
  synthesizeAttemptsFromQuickRows,
  synthesizeClimbingMetrics,
} from "@/lib/climb-session-synth";
import { EffortSlider } from "@/app/components/strain/EffortSlider";
import { predictEffortDefault } from "@/lib/strain";

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

// Walk the saved metric values to reconstruct quick-mode rows when the log
// has no per-climb attempts (legacy quick-only sessions). Groups gradeBucket
// + climbingColumn metrics into one row per grade with flash + send counts.
// Project counts can't be recovered — old quick mode had no project column —
// so they start at 0 and the user can add them back if needed.
function seedQuickRowsFromValues(
  values: Record<string, SessionMetricDraftValue>,
  definitions: SessionMetricDefinitionWithConfig[],
  defaultDiscipline: ClimbingDiscipline
): QuickClimbRow[] {
  const rows = new Map<string, QuickClimbRow>();
  for (const def of definitions) {
    const config = def.config;
    if (!config?.gradeBucket || !config?.climbingColumn) continue;
    const grade = config.gradeBucket as string;
    const column = config.climbingColumn as string;
    const raw = values[def.id]?.numberValue ?? "";
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const row = rows.get(grade) ?? {
      localId: `seed-${grade}`,
      discipline: defaultDiscipline,
      grade,
      gradeSystem:
        defaultDiscipline === "BOULDER" ? ("BOULDER_V" as const) : ("YOSEMITE" as const),
      flashCount: "",
      sendCount: "",
      projectCount: "",
    };
    if (column === "FLASHED") row.flashCount = trimmed;
    else row.sendCount = trimmed;
    rows.set(grade, row);
  }
  return [...rows.values()];
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
  initialClimbAttempts = [],
  climbDefaultDiscipline = null,
  initialEffort = null,
  onComplete,
  onCancel,
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
  initialClimbAttempts?: ClimbAttemptDraft[];
  climbDefaultDiscipline?: ClimbingDiscipline | null;
  initialEffort?: number | null;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const isClimbing = isClimbingTemplateKey(templateKey);
  const isOutdoorClimbing = isClimbing && (templateKey ?? "").startsWith("outdoor-");
  const climbDiscipline = isClimbing
    ? climbDefaultDiscipline ?? climbingDisciplineForTemplateKey(templateKey)
    : null;
  const climbDisciplineLabel = climbDiscipline ? climbingDisciplineLabel(climbDiscipline) : null;
  const climbSectionTitle = isClimbing
    ? `${isOutdoorClimbing ? "Outdoor" : "Indoor"} ${climbDisciplineLabel}`
    : null;

  const [durationMin, setDurationMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [effort, setEffort] = useState<number | null>(initialEffort);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>(initialValues);
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(initialSpot);
  const [recentSpots, setRecentSpots] = useState<Array<{ ref: { kind: "activitySpot" | "climbLocation"; id: string }; name: string; region: string | null }>>([]);
  const [saving, setSaving] = useState(false);

  // ── Climbing per-climb state ────────────────────────────────────────────────
  // Default to per-climb mode when attempts exist (so the user sees the real
  // climbs they logged); fall back to quick mode and reconstruct rows from
  // the stored grade-count metric values for legacy quick-only logs.
  const [climbMode, setClimbMode] = useState<"quick" | "per-climb">(
    initialClimbAttempts.length > 0 ? "per-climb" : "quick"
  );
  const [climbAttempts, setClimbAttempts] = useState<ClimbAttemptDraft[]>(initialClimbAttempts);
  const [quickClimbRows, setQuickClimbRows] = useState<QuickClimbRow[]>(() =>
    initialClimbAttempts.length > 0 || !climbDiscipline
      ? []
      : seedQuickRowsFromValues(initialValues, definitions, climbDiscipline)
  );

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

  // Saved-problem fetch for the per-climb chip row — driven by the selected
  // climb location. Same wiring as the live SessionLogForm.
  const climbLocationId =
    isClimbing && spotValue?.kind === "saved" && spotValue.ref.kind === "climbLocation"
      ? spotValue.ref.id
      : null;
  const [savedProblems, setSavedProblems] = useState<ClimbProblemBasic[]>([]);
  useEffect(() => {
    if (!climbLocationId) { setSavedProblems([]); return; }
    let cancelled = false;
    fetch(`/api/climb-problems?locationId=${climbLocationId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled) setSavedProblems(data); })
      .catch(() => { if (!cancelled) setSavedProblems([]); });
    return () => { cancelled = true; };
  }, [climbLocationId]);

  const templateNotesDefinition = definitions.find((d) => d.key === "template_notes");
  const mainDefinitions = definitions.filter((d) => d.key !== "template_notes");
  const visibleMainDefinitions = showSpotPicker
    ? mainDefinitions.filter((d) => !isPrimaryLocationMetric(d))
    : mainDefinitions;
  // For climbing, the grade-bucket metrics are owned by ClimbSessionLogger —
  // hide them from the generic metric grid so they don't render twice.
  const nonClimbingMetricDefinitions = isClimbing
    ? visibleMainDefinitions.filter((d) => !(d.config?.gradeBucket && d.config?.climbingColumn))
    : visibleMainDefinitions;

  async function onSave() {
    const trimmedDuration = durationMin.trim();
    const parsedDurationMin = trimmedDuration ? Number(trimmedDuration) : null;
    if (parsedDurationMin !== null && (!Number.isFinite(parsedDurationMin) || parsedDurationMin <= 0)) {
      alert("Enter a valid duration in minutes or leave it blank.");
      return;
    }
    const durationSec = parsedDurationMin !== null ? parsedDurationMin * 60 : null;

    let structuredValues: Array<{
      metricDefinitionId: string;
      numberValue?: number;
      textValue?: string;
      booleanValue?: boolean;
    }> = [];
    let attemptsToPersist: ClimbAttemptDraft[] | undefined = undefined;

    if (isClimbing) {
      // Source of truth depends on the active mode — same as the live logger.
      // Quick mode rows expand into individual attempts; per-climb attempts
      // are the rows themselves. Either way we synth grade-count metrics
      // so existing progress queries stay happy.
      attemptsToPersist =
        climbMode === "per-climb"
          ? climbAttempts.map((a, i) => ({ ...a, attemptOrder: i }))
          : synthesizeAttemptsFromQuickRows(quickClimbRows);
      structuredValues = synthesizeClimbingMetrics(attemptsToPersist, definitions);
    } else {
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
        preferredClimbingGrades: isClimbing ? preferredClimbingGrades : undefined,
        climbAttempts: attemptsToPersist,
        activitySlug: activitySlug ?? undefined,
        effort,
        ...spotParams,
      });
      if (onComplete) onComplete();
      else window.location.href = returnTo;
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

      {isClimbing && templateKey ? (
        <FormSection title={climbSectionTitle ?? "Climbing"}>
          <ClimbSessionLogger
            templateKey={templateKey}
            climbMode={climbMode}
            onModeChange={setClimbMode}
            attempts={climbAttempts}
            onAttemptsChange={setClimbAttempts}
            quickClimbRows={quickClimbRows}
            onQuickClimbRowsChange={setQuickClimbRows}
            savedProblems={savedProblems}
            climbLocationId={climbLocationId}
            onMarkDirty={() => {
              /* edit form has no draft autosave — nothing to mark */
            }}
            onUpdateProblemNotes={(id, nextNotes) => {
              setSavedProblems((prev) => prev.map((p) => (p.id === id ? { ...p, notes: nextNotes } : p)));
            }}
          />
        </FormSection>
      ) : null}

      {nonClimbingMetricDefinitions.length > 0 ? (
        <FormSection title="Session metrics">
          <SessionMetricFields
            definitions={nonClimbingMetricDefinitions}
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
      ) : null}

      <FormSection title="Effort">
        <EffortSlider
          value={effort}
          predicted={predictEffortDefault(Number(durationMin) > 0 ? Number(durationMin) : null)}
          onChange={setEffort}
        />
      </FormSection>

      <FormSection title="Notes">
        {templateNotesDefinition ? (
          <SessionMetricFields
            definitions={[templateNotesDefinition]}
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
        ) : (
          <Field label="Session notes">
            <textarea style={textareaStyle} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        )}
      </FormSection>

      <FormActions
        primaryLabel="Save Changes"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref={returnTo}
        onBack={onCancel}
      />
    </FormStack>
  );
}
