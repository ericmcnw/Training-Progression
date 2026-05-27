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
  FormActions,
  FormSection,
  FormStack,
  inputStyle,
  localDateTimeNow,
  textareaStyle,
} from "../log/form-ui";
import {
  isClimbingTemplateKey,
  normalizeSessionMetricText,
  parseSessionMetricNumber,
  templateHasPrimaryLocationMetric,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";
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
import type { ClimbAttemptDraft, ClimbLocationBasic, ClimbLocationType, ClimbProblemBasic, ClimbOutcome } from "@/lib/climb-types";

// Synthesize SessionMetricValueInput from per-climb attempts (backward compat for progress queries)
function synthesizeClimbingMetrics(
  attempts: ClimbAttemptDraft[],
  definitions: SessionMetricDefinitionWithConfig[]
): Array<{ metricDefinitionId: string; numberValue?: number }> {
  const gradeCounts = new Map<string, { flash: number; done: number }>();
  for (const attempt of attempts) {
    const current = gradeCounts.get(attempt.grade) ?? { flash: 0, done: 0 };
    if (attempt.outcome === "FLASH" || attempt.outcome === "ONSIGHT") current.flash++;
    else if (attempt.outcome === "SEND" || attempt.outcome === "REDPOINT") current.done++;
    gradeCounts.set(attempt.grade, current);
  }

  const result: Array<{ metricDefinitionId: string; numberValue?: number }> = [];
  for (const def of definitions) {
    const config = def.config;
    if (!config?.gradeBucket || !config?.climbingColumn) continue;
    const grade = config.gradeBucket as string;
    const column = config.climbingColumn as string;
    const counts = gradeCounts.get(grade);
    if (!counts) continue;
    const value = column === "FLASHED" ? counts.flash : counts.done;
    if (value > 0) result.push({ metricDefinitionId: def.id, numberValue: value });
  }
  return result;
}

// Synthesize ClimbAttempt list from quick-mode grade counts
function synthesizeAttemptsFromQuickValues(
  values: Record<string, SessionMetricDraftValue>,
  quickAttemptedValues: Record<string, string>,
  definitions: SessionMetricDefinitionWithConfig[],
  templateKey: string | null
): ClimbAttemptDraft[] {
  const attempts: ClimbAttemptDraft[] = [];
  const gradeRows = new Map<string, { flashDefId: string | null; sendDefId: string | null; gradeSystem: string }>();
  const discipline = climbingDisciplineForTemplateKey(templateKey);
  const flashOutcome: ClimbOutcome = discipline === "BOULDER" ? "FLASH" : "ONSIGHT";
  const sendOutcome: ClimbOutcome = discipline === "SPORT_LEAD" ? "REDPOINT" : "SEND";

  for (const def of definitions) {
    const config = def.config;
    if (!config?.gradeBucket || !config?.climbingColumn) continue;
    const grade = config.gradeBucket as string;
    const current = gradeRows.get(grade) ?? { flashDefId: null, sendDefId: null, gradeSystem: config.gradeSystem ?? "BOULDER_V" };
    if (config.climbingColumn === "FLASHED") current.flashDefId = def.id;
    else current.sendDefId = def.id;
    gradeRows.set(grade, current);
  }

  let order = 0;
  for (const [grade, row] of gradeRows) {
    const gradeSystem = (row.gradeSystem === "YOSEMITE" ? "YOSEMITE" : "BOULDER_V") as "BOULDER_V" | "YOSEMITE";
    const flashCount = parseInt(values[row.flashDefId ?? ""]?.numberValue ?? "0") || 0;
    const sendCount = parseInt(values[row.sendDefId ?? ""]?.numberValue ?? "0") || 0;
    const projectCount = parseInt(quickAttemptedValues[grade] ?? "0") || 0;

    for (let i = 0; i < flashCount; i++) {
      attempts.push({ localId: `qs-flash-${grade}-${i}`, grade, gradeSystem, outcome: flashOutcome, attemptOrder: order++ });
    }
    for (let i = 0; i < sendCount; i++) {
      attempts.push({ localId: `qs-send-${grade}-${i}`, grade, gradeSystem, outcome: sendOutcome, attemptOrder: order++ });
    }
    // Third column ("Project") = climbs you tried but didn't send. Persisted
    // as PROJECT, matching the per-climb mode's "Project" outcome and the
    // user's intent that every non-send is a project they're working on.
    for (let i = 0; i < projectCount; i++) {
      attempts.push({ localId: `qs-project-${grade}-${i}`, grade, gradeSystem, outcome: "PROJECT", attemptOrder: order++ });
    }
  }
  return attempts;
}

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
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });

  const isClimbing = isClimbingTemplateKey(templateKey);
  const hasLocationMetric = templateHasPrimaryLocationMetric(definitions);
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
  const hasVisibleMetrics = mainDefinitions.filter(
    (d) => !(d.config?.gradeBucket && d.config?.climbingColumn)
  ).length > 0;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [durationMin, setDurationMin] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState(defaultPerformedAtLocal ?? localDateTimeNow());
  const [effortRating, setEffortRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

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
  const [quickAttemptedValues, setQuickAttemptedValues] = useState<Record<string, string>>({});
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
    setDurationMin(draft.durationMin);
    setSessionMetricValues(draft.sessionMetricValues);
    setSelectedClimbingGrades(draft.selectedClimbingGrades);
    setNotes(draft.notes);
    setPerformedAtLocal(draft.performedAtLocal || localDateTimeNow());
    if (draft.climbMode) setClimbMode(draft.climbMode);
    if (draft.climbAttempts) setClimbAttempts(draft.climbAttempts);
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
      durationMin,
      // Free-text location is no longer captured — the picker's spotValue
      // is the canonical record. Empty string for legacy schema compat.
      location: "",
      sessionMetricValues,
      selectedClimbingGrades,
      notes,
      performedAtLocal,
      climbMode,
      climbAttempts,
      spotValue: spotValue ?? undefined,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      contextSaveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMin, sessionMetricValues, selectedClimbingGrades, notes, performedAtLocal,
      climbMode, climbAttempts, spotValue]);

  function markDirty() {
    isDirtyRef.current = true;
    drawer?.markDirty();
  }

  function handleStartFresh() {
    clearDraftFromStorage(routineId);
    contextClearDraft(routineId);
    setDurationMin("");
    setSessionMetricValues({});
    setSelectedClimbingGrades(preferredClimbingGrades);
    setNotes("");
    setPerformedAtLocal(localDateTimeNow());
    setClimbMode("per-climb");
    setClimbAttempts([]);
    setQuickAttemptedValues({});
    setSpotValue(null);
    setSavedProblems([]);
    isDirtyRef.current = false;
    draftStartedAtRef.current = new Date().toISOString();
    setDraftBanner(null);
    drawer?.clearDirty();
  }

  async function onSave() {
    const trimmedDuration = durationMin.trim();
    const parsedDurationMin = trimmedDuration ? Number(trimmedDuration) : null;
    if (parsedDurationMin !== null && (!Number.isFinite(parsedDurationMin) || parsedDurationMin <= 0)) {
      alert("Enter a valid duration in minutes or leave it blank.");
      return;
    }
    const durationSec = parsedDurationMin !== null ? parsedDurationMin * 60 : null;

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
          : synthesizeAttemptsFromQuickValues(sessionMetricValues, quickAttemptedValues, definitions, templateKey);
      sessionMetricValuesToSend = synthesizeClimbingMetrics(activeAttempts, definitions);
    } else {
      for (const definition of definitions) {
        const draft = sessionMetricValues[definition.id] ?? {};
        if (definition.valueType === "INTEGER" || definition.valueType === "DECIMAL") {
          const numberValue = parseSessionMetricNumber(draft.numberValue ?? "", definition.valueType);
          if (definition.isRequired && numberValue === null) throw new Error(`${definition.label} is required.`);
          if (numberValue !== null) sessionMetricValuesToSend.push({ metricDefinitionId: definition.id, numberValue });
          continue;
        }
        if (definition.valueType === "BOOLEAN") {
          if (draft.booleanValue) sessionMetricValuesToSend.push({ metricDefinitionId: definition.id, booleanValue: true });
          continue;
        }
        const textValue = normalizeSessionMetricText(draft.textValue ?? "");
        if (definition.isRequired && !textValue) throw new Error(`${definition.label} is required.`);
        if (textValue) sessionMetricValuesToSend.push({ metricDefinitionId: definition.id, textValue });
      }
    }

    // Build climb attempts for API
    const activeClimbAttempts = isClimbing
      ? climbMode === "per-climb"
        ? climbAttempts.map((a, i) => ({ ...a, attemptOrder: i }))
        : synthesizeAttemptsFromQuickValues(sessionMetricValues, quickAttemptedValues, definitions, templateKey)
      : undefined;

    setSaving(true);
    try {
      const effortPrefix = !isClimbing && effortRating !== null ? `Effort: ${effortRating}/5\n` : "";
      const spotParams = spotParamsForSession(spotValue, isClimbing);
      await logSession({
        routineId,
        durationSec,
        notes: effortPrefix ? `${effortPrefix}${notes}`.trim() : notes,
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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save session.");
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
        <Field label="Duration (minutes, optional)">
          <input
            style={inputStyle}
            value={durationMin}
            onChange={(e) => { markDirty(); setDurationMin(e.target.value); }}
            inputMode="decimal"
            placeholder="e.g. 90"
          />
        </Field>

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

        <DateTimeField
          value={performedAtLocal}
          onChange={(v) => { markDirty(); setPerformedAtLocal(v); }}
        />

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
            definitions={definitions}
            quickValues={sessionMetricValues}
            quickAttemptedValues={quickAttemptedValues}
            selectedGrades={selectedClimbingGrades}
            savedProblems={savedProblems}
            onQuickValuesChange={(id, val) => {
              setSessionMetricValues((current) => ({ ...current, [id]: { ...current[id], ...val } }));
            }}
            onQuickAttemptedChange={(grade, val) => {
              setQuickAttemptedValues((current) => ({ ...current, [grade]: val }));
            }}
            onSelectedGradesChange={(grades) => { markDirty(); setSelectedClimbingGrades(grades); }}
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
          <SessionMetricFields
            definitions={mainDefinitions}
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

      {!isClimbing && (
        <FormSection title="How did it feel?">
          <div style={effortRowStyle}>
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setEffortRating(effortRating === level ? null : level)}
                style={effortBtnStyle(effortRating === level)}
              >
                <span style={{ fontSize: 20 }}>{effortEmoji(level)}</span>
                <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.75 }}>{level}</span>
              </button>
            ))}
          </div>
        </FormSection>
      )}

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

      <FormActions
        primaryLabel={isClimbing ? "Save Session" : "Save Session"}
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

const effortRowStyle: React.CSSProperties = { display: "flex", gap: 8 };

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


function effortBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    padding: "10px 6px",
    border: active ? "1px solid rgba(167,139,250,0.6)" : "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    background: active ? "rgba(167,139,250,0.15)" : "rgba(128,128,128,0.06)",
    color: "inherit", cursor: "pointer", transition: "border-color 120ms, background 120ms",
  };
}

function effortEmoji(level: number) {
  if (level === 1) return "😴";
  if (level === 2) return "🙂";
  if (level === 3) return "💪";
  if (level === 4) return "🔥";
  return "⚡";
}
