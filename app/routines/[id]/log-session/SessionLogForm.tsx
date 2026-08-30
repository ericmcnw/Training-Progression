"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { logSession } from "../../actions";
import InlineMusclesWorked, { type LoggableZone } from "@/app/components/log/InlineMusclesWorked";
import InlinePainCheck, { type PainCheckZone } from "@/app/components/log/InlinePainCheck";
import type { PainContext } from "@/generated/prisma";
import SessionMetricFields, { type SessionMetricDraftValue } from "./SessionMetricFields";
import ClimbSessionLogger from "./ClimbSessionLogger";
import SpotPicker, { type SpotPickerValue } from "@/app/components/log/SpotPicker";
import {
  type ActivitySpotConfig,
  type SpotPickerItem,
  getActivitySpotConfig,
} from "@/lib/activity-spots";
import { COLOR } from "@/lib/design-tokens";
import {
  DateTimeField,
  Field,
  HoursMinutesField,
  FormActions,
  FormError,
  FormSection,
  FormStack,
  parseHoursMinutes,
  localDateTimeNow,
  textareaStyle,
} from "../log/form-ui";
import {
  isBasketballTemplateKey,
  isClimbingTemplateKey,
  isPrimaryLocationMetric,
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";
import BasketballSessionStats from "./BasketballSessionStats";
import { climbingDisciplineLabel, climbingDisciplineForTemplateKey } from "@/lib/climb-types";
import {
  type SessionDraft,
  clearDraftFromStorage,
  draftAgeLabel,
  draftIsRecent,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "@/lib/log-draft";
import { useLogDraft } from "@/app/contexts/LogDraftContext";
import { useOptionalLogDrawer } from "@/app/contexts/LogDrawerContext";
import type { ClimbAttemptDraft, ClimbLocationBasic, ClimbLocationType, ClimbProblemBasic, QuickClimbRow } from "@/lib/climb-types";
import {
  synthesizeAttemptsFromQuickRows,
  synthesizeClimbingMetrics,
} from "@/lib/climb-session-synth";

export default function SessionLogForm({
  routineId,
  routineName,
  templateKey,
  templateName,
  definitions,
  preferredClimbingGrades,
  activePainZones = [],
  savedClimbLocations = [],
  activitySlug = null,
  savedSpots = [],
  availableZones = [],
  defaultZoneSlugs = [],
  onComplete,
  onBack,
  defaultPerformedAtLocal,
}: {
  routineId: string;
  routineName: string;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  preferredClimbingGrades: string[];
  activePainZones?: PainCheckZone[];
  savedClimbLocations?: ClimbLocationBasic[];
  activitySlug?: string | null;
  savedSpots?: SpotPickerItem[];
  availableZones?: LoggableZone[];
  defaultZoneSlugs?: string[];
  onComplete?: () => void;
  onBack?: () => void;
  defaultPerformedAtLocal?: string;
}) {
  const { saveDraft: contextSaveDraft, clearDraft: contextClearDraft } = useLogDraft();
  const drawer = useOptionalLogDrawer();
  const finish = onComplete ?? (() => { window.location.href = "/log"; });

  const isClimbing = isClimbingTemplateKey(templateKey);
  const isBasketball = isBasketballTemplateKey(templateKey);
  const isOutdoorClimbing = isClimbing && (templateKey ?? "").startsWith("outdoor-");
  const climbVenueLabel = isOutdoorClimbing ? "Crag" : "Gym";
  const climbDisciplineLabel = isClimbing
    ? climbingDisciplineLabel(climbingDisciplineForTemplateKey(templateKey))
    : null;
  const climbVenueIsIndoor = isClimbing && !isOutdoorClimbing;
  const climbSectionTitle = isClimbing
    ? `${climbVenueIsIndoor ? "Indoor" : "Outdoor"} ${climbDisciplineLabel}`
    : null;

  const templateNotesDefinition = definitions.find((d) => d.key === "template_notes");
  const mainDefinitions = definitions.filter((d) => d.key !== "template_notes");

  // ── Form state ──────────────────────────────────────────────────────────────
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState(defaultPerformedAtLocal ?? localDateTimeNow());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline post-log state — submitted alongside the log instead of via a
  // follow-up screen. Defaults pre-tick the template-derived zones; pain
  // levels stay at 0 unless the user moves a slider.
  const [selectedZoneSlugs, setSelectedZoneSlugs] = useState<string[]>(defaultZoneSlugs);
  const [zoneIntensity, setZoneIntensity] = useState<string>("");
  const [painLevels, setPainLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(activePainZones.map((zone) => [zone.slug, 0])),
  );
  const [painContext, setPainContext] = useState<PainContext>("AFTER_ACTIVITY");

  // Climbing-specific state
  const [climbMode, setClimbMode] = useState<"quick" | "per-climb">("per-climb");
  const [climbAttempts, setClimbAttempts] = useState<ClimbAttemptDraft[]>([]);
  // Quick mode rows — each row carries discipline + grade + counts so a
  // single session can mix disciplines. Replaces the old template-driven
  // selectedGrades + quickAttemptedValues + sessionMetricValues-keyed
  // climbing inputs.
  const [quickClimbRows, setQuickClimbRows] = useState<QuickClimbRow[]>([]);
  // Single SpotPicker value covers both climbing (ClimbLocation) and non-climbing
  // (ActivitySpot) flows — the form maps it to the right action params on save.
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(null);
  const [recentSpots, setRecentSpots] = useState<Array<{ ref: { kind: "activitySpot" | "climbLocation"; id: string }; name: string; region: string | null }>>([]);

  const nonClimbingSpotConfig = activitySlug ? getActivitySpotConfig(activitySlug) : null;
  const climbingSpotConfig: ActivitySpotConfig | null = isClimbing ? buildClimbingSpotConfig(isOutdoorClimbing) : null;
  const spotPickerConfig = isClimbing ? climbingSpotConfig : nonClimbingSpotConfig;
  const spotPickerSlug = isClimbing ? "climbing" : activitySlug;
  const showSpotPicker =
    spotPickerConfig != null &&
    (isClimbing || (activitySlug != null && nonClimbingSpotConfig?.supportsMap === true));

  // Templates predate the structured SpotPicker, so several still carry a
  // free-text "court / trail / course / break / mountain" metric. When the
  // picker is rendering the same information, drop those keys from the
  // generic metric grid to stop the double-entry. Old logs keep their
  // value (existing rows aren't touched).
  const visibleMainDefinitions = showSpotPicker
    ? mainDefinitions.filter((d) => !isPrimaryLocationMetric(d))
    : mainDefinitions;
  const hasVisibleMetrics = visibleMainDefinitions.filter(
    (d) => !(d.config?.gradeBucket && d.config?.climbingColumn)
  ).length > 0;

  // Currently-selected ClimbLocation id — drives saved-problems fetch for
  // per-climb mode. Derived from the picker value (saved climbLocation or
  // no selection).
  const climbLocationId =
    isClimbing && spotValue?.kind === "saved" && spotValue.ref.kind === "climbLocation"
      ? spotValue.ref.id
      : null;
  const [savedProblems, setSavedProblems] = useState<ClimbProblemBasic[]>([]);

  // Saved climb locations come in via prop; merge them into the unified
  // savedSpots list so the picker can surface them under "Your locations"
  // for climbing sessions. Memoized so the picker's downstream useMemo
  // calls don't invalidate on every render.
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

  useEffect(() => {
    if (!spotPickerSlug) { setRecentSpots([]); return; }
    let cancelled = false;
    fetch(`/api/spots/recent?slug=${encodeURIComponent(spotPickerSlug)}&limit=5`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("recent fetch failed"))))
      .then((data) => { if (!cancelled) setRecentSpots(data.recent ?? []); })
      .catch(() => { if (!cancelled) setRecentSpots([]); });
    return () => { cancelled = true; };
  }, [spotPickerSlug]);

  // Draft state
  const [draftBanner, setDraftBanner] = useState<"recent" | "older" | null>(null);
  const isDirtyRef = useRef(false);
  const draftStartedAtRef = useRef(new Date().toISOString());

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraftFromStorage(routineId);
    if (!draft || draft.kind !== "SESSION") return;

    draftStartedAtRef.current = draft.startedAt;
    const storedMinutes = Number(draft.durationMin);
    if (Number.isFinite(storedMinutes) && storedMinutes > 0) {
      setDurationHours(String(Math.floor(storedMinutes / 60)));
      setDurationMinutes(String(storedMinutes % 60));
    }
    setSessionMetricValues(draft.sessionMetricValues);
    setSelectedClimbingGrades(draft.selectedClimbingGrades);
    setNotes(draft.notes);
    setPerformedAtLocal(draft.performedAtLocal || localDateTimeNow());
    if (draft.climbMode) setClimbMode(draft.climbMode);
    if (draft.climbAttempts) setClimbAttempts(draft.climbAttempts);
    if (draft.quickClimbRows) setQuickClimbRows(draft.quickClimbRows);
    // Restore the picker value. Prefer the structured `spotValue` (new
    // format); fall back to the legacy climbLocation* fields for drafts
    // written before this schema bump.
    const restoredSpot = restoreSpotFromDraft(draft, savedClimbLocations);
    if (restoredSpot !== undefined) setSpotValue(restoredSpot);
    isDirtyRef.current = true;
    setDraftBanner(draftIsRecent(draft) ? "recent" : "older");
    contextSaveDraft(draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch saved problems when a known location is selected
  useEffect(() => {
    if (!climbLocationId) { setSavedProblems([]); return; }
    fetch(`/api/climb-problems?locationId=${climbLocationId}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSavedProblems(data))
      .catch(() => setSavedProblems([]));
  }, [climbLocationId]);

  // Auto-save draft on state change
  useEffect(() => {
    if (!isDirtyRef.current) return;
    const draft: SessionDraft = {
      kind: "SESSION",
      routineId,
      routineName,
      startedAt: draftStartedAtRef.current,
      durationMin: String(parseHoursMinutes(durationHours, durationMinutes).minutes ?? ""),
      // Free-text location is no longer captured — the picker's spotValue
      // is the canonical record. Empty string for legacy schema compat.
      location: "",
      sessionMetricValues,
      selectedClimbingGrades,
      notes,
      performedAtLocal,
      climbMode,
      climbAttempts,
      quickClimbRows,
      spotValue: spotValue ?? undefined,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      contextSaveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationHours, durationMinutes, sessionMetricValues, selectedClimbingGrades, notes, performedAtLocal,
      climbMode, climbAttempts, quickClimbRows, spotValue]);

  function markDirty() {
    isDirtyRef.current = true;
    drawer?.markDirty();
  }

  function handleStartFresh() {
    clearDraftFromStorage(routineId);
    contextClearDraft(routineId);
    setDurationHours("");
    setDurationMinutes("");
    setSessionMetricValues({});
    setSelectedClimbingGrades(preferredClimbingGrades);
    setNotes("");
    setPerformedAtLocal(localDateTimeNow());
    setClimbMode("per-climb");
    setClimbAttempts([]);
    setQuickClimbRows([]);
    setSpotValue(null);
    setSavedProblems([]);
    isDirtyRef.current = false;
    draftStartedAtRef.current = new Date().toISOString();
    setDraftBanner(null);
    drawer?.clearDirty();
  }

  async function onSave() {
    const { minutes: parsedDurationMin, valid: durationValid } = parseHoursMinutes(durationHours, durationMinutes);
    if (!durationValid) {
      setError("Enter a valid duration (under 24 hours).");
      return;
    }
    const durationSec = parsedDurationMin != null ? parsedDurationMin * 60 : null;

    // Build metric values
    let sessionMetricValuesToSend: Array<{
      metricDefinitionId: string;
      numberValue?: number;
      textValue?: string;
      booleanValue?: boolean;
    }> = [];

    if (isClimbing) {
      // For climbing: synthesize grade count metrics from whichever mode is active
      const activeAttempts =
        climbMode === "per-climb"
          ? climbAttempts
          : synthesizeAttemptsFromQuickRows(quickClimbRows);
      sessionMetricValuesToSend = synthesizeClimbingMetrics(activeAttempts, definitions);
    } else {
      for (const definition of definitions) {
        const draft = sessionMetricValues[definition.id] ?? {};
        if (definition.valueType === "INTEGER" || definition.valueType === "DECIMAL") {
          const numberValue = parseSessionMetricNumber(draft.numberValue ?? "", definition.valueType);
          if (definition.isRequired && numberValue === null) { setError(`${definition.label} is required.`); return; }
          if (numberValue !== null) sessionMetricValuesToSend.push({ metricDefinitionId: definition.id, numberValue });
          continue;
        }
        if (definition.valueType === "BOOLEAN") {
          if (draft.booleanValue) sessionMetricValuesToSend.push({ metricDefinitionId: definition.id, booleanValue: true });
          continue;
        }
        const textValue = normalizeSessionMetricText(draft.textValue ?? "");
        if (definition.isRequired && !textValue) { setError(`${definition.label} is required.`); return; }
        if (textValue) sessionMetricValuesToSend.push({ metricDefinitionId: definition.id, textValue });
      }
    }

    // Build climb attempts for API
    const activeClimbAttempts = isClimbing
      ? climbMode === "per-climb"
        ? climbAttempts.map((a, i) => ({ ...a, attemptOrder: i }))
        : synthesizeAttemptsFromQuickRows(quickClimbRows)
      : undefined;

    setSaving(true);
    setError(null);
    try {
      const spotParams = spotParamsForSession(spotValue, isClimbing);
      await logSession({
        routineId,
        durationSec,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        sessionMetricValues: sessionMetricValuesToSend,
        preferredClimbingGrades: isClimbing ? selectedClimbingGrades : undefined,
        climbAttempts: activeClimbAttempts,
        activitySlug: activitySlug ?? undefined,
        ...spotParams,
        zoneTags:
          selectedZoneSlugs.length > 0
            ? {
                zoneSlugs: selectedZoneSlugs,
                label: routineName,
                intensity: zoneIntensity || null,
              }
            : undefined,
        painCheck:
          activePainZones.length > 0
            ? {
                context: painContext,
                rows: activePainZones.map((zone) => ({
                  zoneSlug: zone.slug,
                  level: painLevels[zone.slug] ?? 0,
                })),
              }
            : undefined,
      });
      clearDraftFromStorage(routineId);
      contextClearDraft(routineId);
      drawer?.clearDirty();
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save session.");
    } finally {
      setSaving(false);
    }
  }

  const detailsSectionTitle = templateName ?? "Details";

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
        <DateTimeField
          value={performedAtLocal}
          onChange={(v) => { markDirty(); setPerformedAtLocal(v); }}
        />

        <HoursMinutesField
          label="Duration (optional)"
          hours={durationHours}
          minutes={durationMinutes}
          onHours={(v) => { markDirty(); setDurationHours(v); }}
          onMinutes={(v) => { markDirty(); setDurationMinutes(v); }}
        />

        {showSpotPicker && spotPickerConfig ? (
          <SpotPicker
            config={spotPickerConfig}
            spotNoun={isClimbing ? climbVenueLabel.toLowerCase() : spotPickerConfig.spotNoun}
            savedSpots={unifiedSavedSpots}
            recentSpots={recentSpots}
            value={spotValue}
            onChange={(next) => { markDirty(); setSpotValue(next); }}
          />
        ) : null}

        {!templateKey && definitions.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.65, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.3)", background: "rgba(128,128,128,0.06)" }}>
            No template configured — only duration and notes will be saved.{" "}
            <a href={`/routines/${routineId}/edit`} style={{ color: "inherit", opacity: 0.9 }}>Add a template</a>{" "}
            to track structured metrics for this session type.
          </div>
        ) : null}
      </FormSection>

      {/* Climbing section */}
      {isClimbing ? (
        <FormSection title={climbSectionTitle ?? "Climbing"}>
          <ClimbSessionLogger
            templateKey={templateKey!}
            climbMode={climbMode}
            onModeChange={(mode) => { markDirty(); setClimbMode(mode); }}
            attempts={climbAttempts}
            onAttemptsChange={(a) => { setClimbAttempts(a); }}
            quickClimbRows={quickClimbRows}
            onQuickClimbRowsChange={(rows) => { markDirty(); setQuickClimbRows(rows); }}
            savedProblems={savedProblems}
            climbLocationId={climbLocationId}
            onMarkDirty={markDirty}
            onUpdateProblemNotes={(id, notes) => {
              setSavedProblems((prev) => prev.map((p) => p.id === id ? { ...p, notes } : p));
            }}
          />
        </FormSection>
      ) : null}

      {/* Non-climbing metrics section */}
      {!isClimbing && hasVisibleMetrics ? (
        <FormSection title={detailsSectionTitle}>
          {isBasketball && (templateKey === "basketball-pickup" || templateKey === "basketball-shooting") ? (
            <BasketballSessionStats
              templateKey={templateKey}
              definitions={visibleMainDefinitions}
              values={sessionMetricValues}
              onChange={(metricDefinitionId, value) => {
                markDirty();
                setSessionMetricValues((current) => ({
                  ...current,
                  [metricDefinitionId]: { ...current[metricDefinitionId], ...value },
                }));
              }}
            />
          ) : (
            <SessionMetricFields
              definitions={visibleMainDefinitions}
              values={sessionMetricValues}
              onChange={(metricDefinitionId, value) => {
                markDirty();
                setSessionMetricValues((current) => ({
                  ...current,
                  [metricDefinitionId]: { ...current[metricDefinitionId], ...value },
                }));
              }}
            />
          )}
        </FormSection>
      ) : null}

      <FormSection title="Notes">
        {templateNotesDefinition ? (
          <SessionMetricFields
            definitions={[templateNotesDefinition]}
            values={sessionMetricValues}
            onChange={(metricDefinitionId, value) => {
              markDirty();
              setSessionMetricValues((current) => ({
                ...current,
                [metricDefinitionId]: { ...current[metricDefinitionId], ...value },
              }));
            }}
          />
        ) : (
          <Field label="Session notes (optional)">
            <textarea
              style={textareaStyle}
              value={notes}
              onChange={(e) => { markDirty(); setNotes(e.target.value); }}
            />
          </Field>
        )}
      </FormSection>

      {availableZones.length > 0 && (
        <InlineMusclesWorked
          availableZones={availableZones}
          defaultSlugs={defaultZoneSlugs}
          selectedSlugs={selectedZoneSlugs}
          onSelectedSlugsChange={(slugs) => { markDirty(); setSelectedZoneSlugs(slugs); }}
          intensity={zoneIntensity}
          onIntensityChange={(value) => { markDirty(); setZoneIntensity(value); }}
        />
      )}

      {activePainZones.length > 0 && (
        <InlinePainCheck
          zones={activePainZones}
          levels={painLevels}
          onLevelsChange={(next) => { markDirty(); setPainLevels(next); }}
          context={painContext}
          onContextChange={(next) => { markDirty(); setPainContext(next); }}
        />
      )}

      <FormError message={error} />

      <FormActions
        primaryLabel={isClimbing ? "Save Session" : "Save Session"}
        primaryPendingLabel="Saving…"
        saving={saving}
        onPrimary={onSave}
        backHref="/log"
        onBack={onBack}
      />
    </FormStack>
  );
}

const draftBannerGreen: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "10px 14px", borderRadius: 12,
  border: "1px solid rgba(84,203,130,0.4)", background: "rgba(84,203,130,0.08)",
  fontSize: 13, fontWeight: 700,
};

const draftBannerAmber: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "10px 14px", borderRadius: 12,
  border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.07)",
  fontSize: 13, fontWeight: 700,
};

const draftBannerBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.45)",
  background: "rgba(128,128,128,0.12)", color: "inherit", fontWeight: 800, fontSize: 12,
  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};

// Climbing exposes GYM/CRAG as its spot-types, defaulting to whichever
// suits the template (outdoor templates default to CRAG). The picker
// renders this exactly like any other ActivitySpotConfig.
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

// Picker value → action params. Climbing sessions route to climbLocation*
// fields; everything else to activitySpot*. A saved ClimbLocation picked
// on a non-climbing session links via climbLocationId (cross-table).
function spotParamsForSession(value: SpotPickerValue, isClimbing: boolean) {
  if (!value) return {};
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

// Reads the spot value out of a draft. Prefers the structured `spotValue`
// field (new format); falls back to the legacy climbLocation* fields for
// drafts written before the schema bump. Returns `undefined` to mean
// "no spot info in this draft" (so the form keeps its initial state).
function restoreSpotFromDraft(
  draft: SessionDraft,
  savedClimbLocations: Array<{ id: string; name: string; region: string | null }>,
): SpotPickerValue | undefined {
  if (draft.spotValue !== undefined) return draft.spotValue;
  if (draft.climbLocationId) {
    const loc = savedClimbLocations.find((l) => l.id === draft.climbLocationId);
    if (loc) {
      return {
        kind: "saved",
        ref: { kind: "climbLocation", id: loc.id },
        display: { name: loc.name, region: loc.region },
      };
    }
  }
  if (draft.newClimbLocationName) {
    return {
      kind: "new",
      draft: {
        source: "custom",
        name: draft.newClimbLocationName,
        type: draft.newClimbLocationType ?? "GYM",
        region: draft.newClimbLocationRegion ?? null,
        latitude: draft.newClimbLocationLatitude ?? null,
        longitude: draft.newClimbLocationLongitude ?? null,
        osmType: null,
        osmId: null,
      },
    };
  }
  return undefined;
}
