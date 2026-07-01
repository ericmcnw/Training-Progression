"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { logRun } from "../../actions";
import InlinePainCheck, { type PainCheckZone } from "@/app/components/log/InlinePainCheck";
import type { PainContext } from "@/generated/prisma";
import {
  DateTimeField,
  Field,
  FormActions,
  FormError,
  FormSection,
  FormStack,
  inputStyle,
  localDateTimeNow,
  textareaStyle,
} from "../log/form-ui";
import { useOptionalLogDrawer } from "@/app/contexts/LogDrawerContext";
import { useOptionalLogDraft } from "@/app/contexts/LogDraftContext";
import {
  type CardioDraft,
  clearDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "@/lib/log-draft";
import SpotPicker, { type SpotPickerValue } from "@/app/components/log/SpotPicker";
import GearPicker from "@/app/components/log/GearPicker";
import { gearToPickInput, type GearPick } from "@/lib/gear-pick-types";
import {
  type SpotPickerItem,
  getActivitySpotConfig,
} from "@/lib/activity-spots";
import { TYPE_SLUG_TO_REGISTRY_SLUG } from "@/lib/activities/endurance-palette";
import { loadSportLogContext, type SportLogContext } from "@/app/log/sport-actions";
import type { ActivityTypeOption } from "@/app/components/LogDrawer";

export default function LogRunForm({
  routineId,
  routineName,
  activePainZones = [],
  activitySlug = null,
  savedSpots = [],
  activityTypes = [],
  initialActivityTypeId = null,
  routineIsSynthetic = false,
  onComplete,
  onBack,
  defaultPerformedAtLocal,
}: {
  routineId: string;
  routineName: string;
  activePainZones?: PainCheckZone[];
  activitySlug?: string | null;
  /** Combined picker items: own-activity ActivitySpots + cross-activity
   *  ActivitySpots + (when applicable) ClimbLocations. The form maps the
   *  selected item's `kind` to the right FK on save. */
  savedSpots?: SpotPickerItem[];
  /** Available activity types (Run, Trail Run, …) for the dropdown.
   *  Sorted by family then sortOrder by the API. */
  activityTypes?: ActivityTypeOption[];
  /** Routine's stored activityTypeId, used as the default selection for
   *  legacy endurance routines. Null for the synthetic routine and for
   *  routines without a mapped type. */
  initialActivityTypeId?: string | null;
  /** True when logging through the synthetic Endurance routine — the
   *  type picker is required (no default). Legacy routines preselect. */
  routineIsSynthetic?: boolean;
  onComplete?: () => void;
  onBack?: () => void;
  defaultPerformedAtLocal?: string;
}) {
  const drawer = useOptionalLogDrawer();
  const draftCtx = useOptionalLogDraft();
  const [distanceMi, setDistanceMi] = useState("");
  const [elevationGainFt, setElevationGainFt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState(defaultPerformedAtLocal ?? localDateTimeNow());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(null);
  const [gear, setGear] = useState<GearPick[]>([]);
  // Active activity type. Defaults to whatever the legacy routine maps to;
  // null for synthetic routine (user must pick). Drives form field
  // visibility (elevation hidden when !hasElevation) and goes through to
  // the log row on save.
  const [activityTypeId, setActivityTypeId] = useState<string | null>(initialActivityTypeId);
  const activeType = activityTypes.find((t) => t.id === activityTypeId) ?? null;
  // Interval-style structured input — surfaced when the active type sets
  // usesIntervals (currently Interval Run + Sprint). Values held as
  // strings to play nicely with controlled inputs; parsed at save time.
  const [intervalReps, setIntervalReps] = useState("");
  const [intervalWorkDistanceM, setIntervalWorkDistanceM] = useState("");
  const [intervalWorkMin, setIntervalWorkMin] = useState("");
  const [intervalWorkSec, setIntervalWorkSec] = useState("");
  const [intervalRestMin, setIntervalRestMin] = useState("");
  const [intervalRestSec, setIntervalRestSec] = useState("");
  const [recentSpots, setRecentSpots] = useState<Array<{ ref: { kind: "activitySpot" | "climbLocation"; id: string }; name: string; region: string | null }>>([]);
  const [painLevels, setPainLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(activePainZones.map((zone) => [zone.slug, 0])),
  );
  const [painContext, setPainContext] = useState<PainContext>("AFTER_ACTIVITY");

  // For the synthetic Endurance routine the prop `activitySlug` is null
  // (the routine has no metadata tags or subtype, so the server can't
  // resolve a single slug at load time). Derive it dynamically from
  // the selected activity type — picking "Trail Run" yields slug
  // "trail-running", which the SpotPicker reads to surface the right
  // saved spots + map. Legacy routines pre-resolve via the prop, so
  // we prefer the prop when it's set.
  const derivedActivitySlug = useMemo(() => {
    if (activitySlug) return activitySlug;
    if (activeType?.slug) {
      return TYPE_SLUG_TO_REGISTRY_SLUG[activeType.slug] ?? null;
    }
    return null;
  }, [activitySlug, activeType?.slug]);
  const spotConfig = derivedActivitySlug ? getActivitySpotConfig(derivedActivitySlug) : null;
  const showSpotPicker = derivedActivitySlug != null && spotConfig?.supportsMap === true;

  // When the resolved activity slug changes — either because the
  // form mounted on a legacy routine OR the user just picked a type
  // on the synthetic routine — fetch saved/recent spots for THAT
  // slug. The prop `savedSpots` is the initial pool from the server
  // (legacy routines pre-fill it); dynamicSavedSpots overrides when
  // we've fetched fresh context for a different slug.
  const [dynamicSavedSpots, setDynamicSavedSpots] = useState<SpotPickerItem[] | null>(null);
  useEffect(() => {
    if (!derivedActivitySlug || activitySlug) {
      // Legacy routine path — keep the prop savedSpots, no extra fetch.
      setDynamicSavedSpots(null);
      return;
    }
    let cancelled = false;
    loadSportLogContext(derivedActivitySlug)
      .then((ctx: SportLogContext) => {
        if (cancelled) return;
        setDynamicSavedSpots(ctx.savedSpots);
        setRecentSpots(ctx.recentSpots);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [derivedActivitySlug, activitySlug]);

  useEffect(() => {
    if (!activitySlug) { setRecentSpots([]); return; }
    let cancelled = false;
    fetch(`/api/spots/recent?slug=${encodeURIComponent(activitySlug)}&limit=5`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("recent fetch failed"))))
      .then((data) => { if (!cancelled) setRecentSpots(data.recent ?? []); })
      .catch(() => { if (!cancelled) setRecentSpots([]); });
    return () => { cancelled = true; };
  }, [activitySlug]);

  // Draft autosave + restore so cardio gets the same chip-strip presence and
  // refresh-survival as workout/session logs.
  const isDirtyRef = useRef(false);
  const draftStartedAtRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    const stored = loadDraftFromStorage(routineId);
    if (!stored || stored.kind !== "CARDIO") return;
    setDistanceMi(stored.distanceMi);
    setElevationGainFt(stored.elevationGainFt);
    setMinutes(stored.minutes);
    setSeconds(stored.seconds);
    setNotes(stored.notes);
    setPerformedAtLocal(stored.performedAtLocal || localDateTimeNow());
    // Restore the structured spot pick — preserves OSM identity + coords
    // across browser refreshes. Drafts written before this schema bump
    // won't have spotValue and silently skip this step.
    if (stored.spotValue !== undefined) setSpotValue(stored.spotValue);
    // Restore the saved activity type pick — keeps the typed-endurance
    // draft chip labeled correctly across refreshes. Older drafts won't
    // have this field; the form falls back to initialActivityTypeId.
    if (stored.activityTypeId !== undefined) setActivityTypeId(stored.activityTypeId);
    if (stored.gear !== undefined) setGear(stored.gear);
    draftStartedAtRef.current = stored.startedAt;
    isDirtyRef.current = true;
    draftCtx?.saveDraft(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDirtyRef.current) return;
    // Type-aware draft label so the ActiveSessionTray chip shows the
    // activity type ("Run", "Hike") instead of the synthetic Endurance
    // routine name. For legacy routines and non-endurance, falls back
    // to the routine's own name.
    const activeTypeName = activeType?.name ?? null;
    const draftRoutineName =
      activeTypeName && routineIsSynthetic ? activeTypeName : routineName;
    const draft: CardioDraft = {
      kind: "CARDIO",
      routineId,
      routineName: draftRoutineName,
      startedAt: draftStartedAtRef.current,
      notes,
      performedAtLocal,
      distanceMi,
      elevationGainFt,
      minutes,
      seconds,
      activityTypeId: activityTypeId ?? null,
      activityTypeName: activeTypeName,
      // Location is now structured-only via SpotPicker. The legacy
      // free-text field stays in the draft schema for back-compat but
      // is always empty on new logs.
      location: "",
      spotValue: spotValue ?? undefined,
      gear,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      draftCtx?.saveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distanceMi, elevationGainFt, minutes, seconds, notes, performedAtLocal, spotValue, activityTypeId, gear]);

  const pace = useMemo(() => {
    const dist = Number(distanceMi);
    const mins = Number(minutes || "0");
    const secs = Number(seconds || "0");
    const totalMinutes = mins + secs / 60;
    if (!Number.isFinite(dist) || dist <= 0 || totalMinutes <= 0) return null;
    const paceMinPerMile = totalMinutes / dist;
    const paceMins = Math.floor(paceMinPerMile);
    const paceSecs = Math.round((paceMinPerMile - paceMins) * 60);
    return `${paceMins}:${String(paceSecs).padStart(2, "0")} /mi`;
  }, [distanceMi, minutes, seconds]);

  const finish = onComplete ?? (() => { window.location.href = "/log"; });

  function markDirty() {
    isDirtyRef.current = true;
    drawer?.markDirty();
  }

  async function onSave() {
    const distanceProvided = distanceMi.trim().length > 0;
    const distance = distanceProvided ? Number(distanceMi) : null;
    const elevation =
      elevationGainFt.trim().length > 0
        ? Number(elevationGainFt)
        : null;
    const mins = Number(minutes || "0");
    const secs = Number(seconds || "0");
    const durationSec = mins * 60 + secs;

    // Synthetic routine requires a type pick — otherwise the log lands
    // against the synthetic Endurance routine with no type, which would
    // disappear from family rollups.
    if (routineIsSynthetic && !activityTypeId) {
      setError("Pick an activity type first (Run, Hike, Bike, etc.).");
      return;
    }

    const hasDistance = distance !== null && Number.isFinite(distance) && distance > 0;
    const hasDuration = Number.isFinite(durationSec) && durationSec > 0;

    // Distance is optional (a walk is often logged by time only) — but if
    // they typed something, it has to be a real number.
    if (distanceProvided && !hasDistance) {
      setError("Enter a valid distance in miles, or leave it blank.");
      return;
    }
    // Need at least one of distance / duration so the log means something.
    if (!hasDistance && !hasDuration) {
      setError("Add a distance or a duration.");
      return;
    }
    if (elevation !== null && (!Number.isFinite(elevation) || elevation < 0)) {
      setError("Enter a valid elevation gain in feet.");
      return;
    }

    // Build the intervals payload when the type opts into structure.
    // Each field is independently optional — user might know reps + work
    // distance but not rest, or vice versa. Empty block sends null.
    let intervalsConfig: {
      reps: number | null;
      workDistanceM: number | null;
      workDurationSec: number | null;
      restSec: number | null;
    } | null = null;
    if (activeType?.usesIntervals) {
      const reps = intervalReps.trim() ? Math.max(0, Math.floor(Number(intervalReps))) : null;
      const workDistanceM = intervalWorkDistanceM.trim() ? Math.max(0, Number(intervalWorkDistanceM)) : null;
      const workMins = Number(intervalWorkMin || "0");
      const workSecs = Number(intervalWorkSec || "0");
      const workDurationSec = workMins * 60 + workSecs > 0 ? workMins * 60 + workSecs : null;
      const restMins = Number(intervalRestMin || "0");
      const restSecs = Number(intervalRestSec || "0");
      const restSec = restMins * 60 + restSecs > 0 ? restMins * 60 + restSecs : null;
      // Only persist when at least one structured field has a real value.
      if (reps !== null || workDistanceM !== null || workDurationSec !== null || restSec !== null) {
        intervalsConfig = { reps, workDistanceM, workDurationSec, restSec };
      }
    }

    setSaving(true);
    setError(null);
    try {
      // Map the picker's value to action params. Cardio activities use
      // the ActivitySpot table; cross-activity ClimbLocation picks are
      // routed via climbLocationId so we link to the existing record.
      const spotParams = spotParamsForCardio(spotValue);
      await logRun({
        routineId,
        distanceMi: distance,
        durationSec,
        elevationGainFt: elevation,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        // Use the derived slug, not the prop: the synthetic Endurance routine
        // passes a null prop, so the spot resolver needs the slug derived from
        // the picked activity type (e.g. Walk → "walking") to know which spot
        // library to file a new location under. Sending the null prop made
        // resolveActivitySpotId throw whenever a spot was attached.
        activitySlug: derivedActivitySlug ?? undefined,
        activityTypeId: activityTypeId ?? undefined,
        intervalsConfig: intervalsConfig ?? undefined,
        gearPicks: gearToPickInput(gear),
        ...spotParams,
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
      draftCtx?.clearDraft(routineId);
      drawer?.clearDirty();
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this cardio log. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      {/* Activity type picker — present for every CARDIO log. Hidden only
          if the API didn't return any types (legacy/error state). Selecting
          a type retunes the elevation field's visibility immediately. */}
      {activityTypes.length > 0 && (
        <FormSection title="Activity">
          <Field
            label="Activity type"
            hint={routineIsSynthetic ? "Pick what kind of endurance you're logging." : undefined}
          >
            <ActivityTypeSelect
              value={activityTypeId}
              types={activityTypes}
              required={routineIsSynthetic}
              onChange={(next) => { markDirty(); setActivityTypeId(next); }}
            />
          </Field>
        </FormSection>
      )}

      <FormSection title="Cardio">
        <Field label="Distance (miles)">
          <input
            style={bigInputStyle}
            value={distanceMi}
            onChange={(e) => { markDirty(); setDistanceMi(e.target.value); }}
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>

        <div>
          <div style={fieldLabelStyle}>Duration</div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 6 }}>
            <div style={{ flex: 1, display: "grid", gap: 4 }}>
              <div style={unitLabelStyle}>min</div>
              <input
                style={bigInputStyle}
                value={minutes}
                onChange={(e) => { markDirty(); setMinutes(e.target.value); }}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", paddingTop: 20, fontSize: 22, fontWeight: 900, opacity: 0.5 }}>:</div>
            <div style={{ flex: 1, display: "grid", gap: 4 }}>
              <div style={unitLabelStyle}>sec</div>
              <input
                style={bigInputStyle}
                value={seconds}
                onChange={(e) => { markDirty(); setSeconds(e.target.value); }}
                inputMode="numeric"
                placeholder="00"
              />
            </div>
          </div>
        </div>

        {pace && (
          <div style={paceBadgeStyle}>
            <span style={{ opacity: 0.65, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>PACE</span>
            <span style={{ fontSize: 22, fontWeight: 900 }}>{pace}</span>
          </div>
        )}

        {/* Elevation gain — hidden when the active type doesn't track it
            (e.g. pool swim, erg row). Stays visible whenever no type is
            picked yet (synthetic flow before user selects), since hiding
            on null would feel wrong before the picker decision is made. */}
        {(activeType?.hasElevation ?? true) && (
          <Field label="Elevation gain (ft, optional)" hint="Hiking, trail runs, or any climb-heavy cardio.">
            <input
              style={bigInputStyle}
              value={elevationGainFt}
              onChange={(e) => { markDirty(); setElevationGainFt(e.target.value); }}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
        )}

        {/* Interval / Sprint block — surfaces structured rep data for
            types that opt into usesIntervals. Distance + duration above
            stay as user-entered totals (intervals + warmup + cooldown). */}
        {activeType?.usesIntervals && (
          <div style={intervalsBlockStyle}>
            <div style={intervalsHeaderStyle}>
              {activeType.slug === "sprint" ? "Sprint structure" : "Interval structure"}
            </div>
            <Field label="Reps" hint={`e.g. 5 (for 5 × 400m)`}>
              <input
                style={bigInputStyle}
                value={intervalReps}
                onChange={(e) => { markDirty(); setIntervalReps(e.target.value); }}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>

            <Field
              label="Work distance (m, optional)"
              hint={activeType.slug === "sprint" ? "Common: 60, 100, 200, 400" : "Common: 200, 400, 800, 1600"}
            >
              <input
                style={bigInputStyle}
                value={intervalWorkDistanceM}
                onChange={(e) => { markDirty(); setIntervalWorkDistanceM(e.target.value); }}
                inputMode="numeric"
                placeholder="400"
              />
            </Field>

            <div>
              <div style={fieldLabelStyle}>Work time per rep (optional)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 6 }}>
                <div style={{ flex: 1, display: "grid", gap: 4 }}>
                  <div style={unitLabelStyle}>min</div>
                  <input
                    style={bigInputStyle}
                    value={intervalWorkMin}
                    onChange={(e) => { markDirty(); setIntervalWorkMin(e.target.value); }}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingTop: 20, fontSize: 22, fontWeight: 900, opacity: 0.5 }}>:</div>
                <div style={{ flex: 1, display: "grid", gap: 4 }}>
                  <div style={unitLabelStyle}>sec</div>
                  <input
                    style={bigInputStyle}
                    value={intervalWorkSec}
                    onChange={(e) => { markDirty(); setIntervalWorkSec(e.target.value); }}
                    inputMode="numeric"
                    placeholder="00"
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={fieldLabelStyle}>Rest between reps (optional)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 6 }}>
                <div style={{ flex: 1, display: "grid", gap: 4 }}>
                  <div style={unitLabelStyle}>min</div>
                  <input
                    style={bigInputStyle}
                    value={intervalRestMin}
                    onChange={(e) => { markDirty(); setIntervalRestMin(e.target.value); }}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingTop: 20, fontSize: 22, fontWeight: 900, opacity: 0.5 }}>:</div>
                <div style={{ flex: 1, display: "grid", gap: 4 }}>
                  <div style={unitLabelStyle}>sec</div>
                  <input
                    style={bigInputStyle}
                    value={intervalRestSec}
                    onChange={(e) => { markDirty(); setIntervalRestSec(e.target.value); }}
                    inputMode="numeric"
                    placeholder="00"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {showSpotPicker && spotConfig ? (
          <SpotPicker
            config={spotConfig}
            spotNoun={spotConfig.spotNoun}
            savedSpots={dynamicSavedSpots ?? savedSpots}
            recentSpots={recentSpots}
            value={spotValue}
            onChange={(next) => { markDirty(); setSpotValue(next); }}
          />
        ) : null}

        <DateTimeField
          value={performedAtLocal}
          onChange={(v) => { markDirty(); setPerformedAtLocal(v); }}
        />
      </FormSection>

      <FormSection title="Gear">
        <GearPicker
          activitySlug={derivedActivitySlug ?? "running"}
          value={gear}
          onChange={(g) => { markDirty(); setGear(g); }}
          showWeight={false}
          showConsumable={false}
          showQuantity={false}
        />
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes (optional)" hint="Feel, weather, conditions, or anything to review later.">
          <textarea
            style={textareaStyle}
            value={notes}
            onChange={(e) => { markDirty(); setNotes(e.target.value); }}
            placeholder="How did it go?"
          />
        </Field>
      </FormSection>

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
        primaryLabel="Save Cardio"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref="/log"
        onBack={onBack}
      />
    </FormStack>
  );
}

function capitalize(value: string) {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

// Activity-type picker. Native <select> with options grouped by family so
// the user sees "Running ▸ Run / Trail Run / Long Run / …" structure
// without managing a custom dropdown. Native control means the OS picker
// renders nicely on iOS / Android (touch wheel) and on desktop.
function ActivityTypeSelect({
  value,
  types,
  required,
  onChange,
}: {
  value: string | null;
  types: ActivityTypeOption[];
  required: boolean;
  onChange: (next: string | null) => void;
}) {
  // Group by family while preserving sort order.
  const byFamily = new Map<string, { name: string; sortOrder: number; types: ActivityTypeOption[] }>();
  for (const t of types) {
    const cur = byFamily.get(t.familyId) ?? { name: t.familyName, sortOrder: t.familySortOrder, types: [] };
    cur.types.push(t);
    byFamily.set(t.familyId, cur);
  }
  const families = [...byFamily.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <select
      style={bigInputStyle}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{required ? "— Pick an activity —" : "No type"}</option>
      {families.map((fam) => (
        <optgroup key={fam.name} label={fam.name}>
          {fam.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// Translates a picker value into the param shape `logCardio` expects.
// Saved ClimbLocation picks route to `climbLocationId` (cross-table link);
// saved ActivitySpot picks route to `activitySpotId`; new spots ship via
// the `newActivitySpot*` fields so the server upserts a row.
function spotParamsForCardio(value: SpotPickerValue) {
  if (!value) return {};
  if (value.kind === "saved") {
    return value.ref.kind === "climbLocation"
      ? { climbLocationId: value.ref.id }
      : { activitySpotId: value.ref.id };
  }
  const d = value.draft;
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

const bigInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 12,
  background: "#111827",
  color: "#ffffff",
  fontSize: 20,
  fontWeight: 700,
  textAlign: "center",
};

const fieldLabelStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
};

// Interval/sprint block — soft blue tint matches the endurance picker
// elsewhere in the app so the structured-workout section reads as
// "type-driven" content.
const intervalsBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 14,
  borderRadius: 12,
  background: "rgba(78,148,255,0.05)",
  border: "1px solid rgba(78,148,255,0.22)",
};

const intervalsHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(191,219,254,0.95)",
};

const unitLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.6,
  letterSpacing: 0.5,
  textAlign: "center",
};

const paceBadgeStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "10px 16px",
  border: "1px solid rgba(115,220,152,0.35)",
  borderRadius: 12,
  background: "rgba(115,220,152,0.07)",
};
