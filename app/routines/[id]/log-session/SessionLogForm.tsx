"use client";

import { useEffect, useRef, useState } from "react";
import { logSession } from "../../actions";
import PostSessionPainCheck, { type PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import SportZoneTagger from "@/app/components/log/SportZoneTagger";
import SessionMetricFields, { type SessionMetricDraftValue } from "./SessionMetricFields";
import ClimbSessionLogger from "./ClimbSessionLogger";
import ClimbLocationPicker from "./ClimbLocationPicker";
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

const CLIMBING_AUTO_ZONES = [
  { slug: "hands", label: "Fingers / Hands" },
  { slug: "forearm", label: "Forearms" },
  { slug: "upper-back", label: "Lats / Upper Back" },
  { slug: "trapezius", label: "Traps" },
];
const CLIMBING_AUTO_ZONE_SLUGS = CLIMBING_AUTO_ZONES.map((z) => z.slug);

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
    const fellCount = parseInt(quickAttemptedValues[grade] ?? "0") || 0;

    for (let i = 0; i < flashCount; i++) {
      attempts.push({ localId: `qs-flash-${grade}-${i}`, grade, gradeSystem, outcome: flashOutcome, attemptOrder: order++ });
    }
    for (let i = 0; i < sendCount; i++) {
      attempts.push({ localId: `qs-send-${grade}-${i}`, grade, gradeSystem, outcome: sendOutcome, attemptOrder: order++ });
    }
    for (let i = 0; i < fellCount; i++) {
      attempts.push({ localId: `qs-fell-${grade}-${i}`, grade, gradeSystem, outcome: "FELL", attemptOrder: order++ });
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
  savedClimbLocations?: ClimbLocationBasic[];
  onComplete?: () => void;
  onBack?: () => void;
}) {
  const { saveDraft: contextSaveDraft, clearDraft: contextClearDraft } = useLogDraft();
  const drawer = useOptionalLogDrawer();
  const finish = onComplete ?? (() => { window.location.href = "/routines"; });

  const isClimbing = isClimbingTemplateKey(templateKey);
  const hasLocationMetric = templateHasPrimaryLocationMetric(definitions);
  const isOutdoorClimbing = isClimbing && (templateKey ?? "").startsWith("outdoor-");
  const climbVenueLabel = isOutdoorClimbing ? "Crag" : "Gym";
  const climbLocationLabel = "Location";
  const climbLocationPlaceholder = isOutdoorClimbing
    ? "e.g. Red Rock Canyon, Joshua Tree NP…"
    : "e.g. Denver CO, Boulder, San Francisco…";
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
  const [location, setLocation] = useState("");
  const [sessionMetricValues, setSessionMetricValues] = useState<Record<string, SessionMetricDraftValue>>({});
  const [selectedClimbingGrades, setSelectedClimbingGrades] = useState(preferredClimbingGrades);
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState(localDateTimeNow);
  const [effortRating, setEffortRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoneTagLogId, setZoneTagLogId] = useState<string | null>(null);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);

  // Climbing-specific state
  const [climbMode, setClimbMode] = useState<"quick" | "per-climb">("per-climb");
  const [climbAttempts, setClimbAttempts] = useState<ClimbAttemptDraft[]>([]);
  const [quickAttemptedValues, setQuickAttemptedValues] = useState<Record<string, string>>({});
  const [climbLocationId, setClimbLocationId] = useState<string | null>(null);
  const [newClimbLocation, setNewClimbLocation] = useState<{ name: string; type: ClimbLocationType } | null>(null);
  const [savedProblems, setSavedProblems] = useState<ClimbProblemBasic[]>([]);

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
    setPerformedAtLocal(draft.performedAtLocal || localDateTimeNow());
    if (draft.climbMode) setClimbMode(draft.climbMode);
    if (draft.climbAttempts) setClimbAttempts(draft.climbAttempts);
    if (draft.climbLocationId !== undefined) setClimbLocationId(draft.climbLocationId ?? null);
    if (draft.newClimbLocationName) {
      setNewClimbLocation({
        name: draft.newClimbLocationName,
        type: draft.newClimbLocationType ?? "GYM",
      });
    }
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
      location,
      sessionMetricValues,
      selectedClimbingGrades,
      notes,
      performedAtLocal,
      climbMode,
      climbAttempts,
      climbLocationId,
      newClimbLocationName: newClimbLocation?.name,
      newClimbLocationType: newClimbLocation?.type,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      contextSaveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMin, location, sessionMetricValues, selectedClimbingGrades, notes, performedAtLocal,
      climbMode, climbAttempts, climbLocationId, newClimbLocation]);

  function markDirty() {
    isDirtyRef.current = true;
    drawer?.markDirty();
  }

  function handleStartFresh() {
    clearDraftFromStorage(routineId);
    contextClearDraft(routineId);
    setDurationMin("");
    setLocation("");
    setSessionMetricValues({});
    setSelectedClimbingGrades(preferredClimbingGrades);
    setNotes("");
    setPerformedAtLocal(localDateTimeNow());
    setClimbMode("per-climb");
    setClimbAttempts([]);
    setQuickAttemptedValues({});
    setClimbLocationId(null);
    setNewClimbLocation(null);
    setSavedProblems([]);
    isDirtyRef.current = false;
    draftStartedAtRef.current = new Date().toISOString();
    setDraftBanner(null);
    drawer?.clearDirty();
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
    return (
      <div className="painCheckEnter">
        <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={finish} />
      </div>
    );
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
      const logId = await logSession({
        routineId,
        durationSec,
        location: location.trim() || undefined,
        notes: effortPrefix ? `${effortPrefix}${notes}`.trim() : notes,
        performedAtLocal: performedAtLocal || undefined,
        sessionMetricValues: sessionMetricValuesToSend,
        preferredClimbingGrades: isClimbing ? selectedClimbingGrades : undefined,
        climbAttempts: activeClimbAttempts,
        climbLocationId: climbLocationId ?? undefined,
        newClimbLocationName: newClimbLocation?.name?.trim() || undefined,
        newClimbLocationType: newClimbLocation?.type,
      });
      clearDraftFromStorage(routineId);
      contextClearDraft(routineId);
      drawer?.clearDirty();
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

        {isClimbing ? (
          <>
            <Field label={`${climbLocationLabel} (optional)`} hint={isOutdoorClimbing ? "Broader area or region you climbed in." : "City or region — helpful when you climb at multiple gyms."}>
              <input
                style={inputStyle}
                value={location}
                onChange={(e) => { markDirty(); setLocation(e.target.value); }}
                placeholder={climbLocationPlaceholder}
              />
            </Field>
            <Field label={`${climbVenueLabel} (optional)`}>
              <ClimbLocationPicker
                savedLocations={savedClimbLocations}
                selectedId={climbLocationId}
                onSelectId={(id) => { markDirty(); setClimbLocationId(id); }}
                newLocation={newClimbLocation}
                onNewLocation={(loc) => { markDirty(); setNewClimbLocation(loc); }}
              />
            </Field>
          </>
        ) : !hasLocationMetric ? (
          <Field label="Location (optional)">
            <input
              style={inputStyle}
              value={location}
              onChange={(e) => { markDirty(); setLocation(e.target.value); }}
              placeholder="Gym, crag, trail…"
            />
          </Field>
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
