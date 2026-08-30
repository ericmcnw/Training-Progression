"use client";

import { useEffect, useState } from "react";
import { updateRunLog } from "../../../actions";
import { DateTimeField, Field, FieldGrid, FormActions, FormError, FormSection, FormStack, inputStyle, textareaStyle } from "../../log/form-ui";
import SpotPicker, { type SpotPickerValue } from "@/app/components/log/SpotPicker";
import GearPicker from "@/app/components/log/GearPicker";
import {
  gearToPickInput,
  gramsFromLb,
  lbFromGrams,
  summarizePackWeight,
  type GearPick,
} from "@/lib/gear-pick-types";
import {
  type SpotPickerItem,
  getActivitySpotConfig,
} from "@/lib/activity-spots";
import { isPoolSwimType } from "@/lib/activity-types";
import { normalizePoolSwimData, poolSwimTotals, type PoolSwimData } from "@/lib/pool-swim";
import PoolSwimSets, {
  emptyPoolSwimFormState,
  poolSwimDataToForm,
  poolSwimFormToData,
  type PoolSwimFormState,
} from "../PoolSwimSets";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

// Mirrors the session edit form's mapper. Saved climbLocation picks
// route to climbLocationId (cross-table link); new spots go through
// the ActivitySpot path since cardio routines aren't climbing.
function spotParamsForUpdate(value: SpotPickerValue, hadInitialSpot: boolean) {
  if (!value) return hadInitialSpot ? { clearSpot: true } : {};
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

export type EditCardioTypeOption = {
  id: string;
  slug: string;
  name: string;
  familyId: string;
  familyName: string;
  familySortOrder: number;
  sortOrder: number;
  hasElevation: boolean;
  usesIntervals: boolean;
};

export default function EditRunLogForm({
  routineId,
  logId,
  returnTo,
  initialDistanceMi,
  initialElevationGainFt,
  initialPackWeightGrams = null,
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
  activitySlug = null,
  savedSpots = [],
  initialSpot = null,
  availableActivityTypes = [],
  initialActivityTypeId = null,
  initialIntervals = null,
  initialGear = [],
  initialPoolSwim = null,
  onComplete,
  onCancel,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDistanceMi: number | null;
  initialElevationGainFt: number | null;
  initialPackWeightGrams?: number | null;
  initialDurationSec: number | null;
  initialNotes: string;
  initialPerformedAt: Date;
  activitySlug?: string | null;
  savedSpots?: SpotPickerItem[];
  initialSpot?: SpotPickerValue;
  /** Activity type picker options + initial selection — surfaces a
   *  "change type" affordance on the edit screen (logged a Trail Run
   *  but should have been Long Run? switch here). */
  availableActivityTypes?: EditCardioTypeOption[];
  initialActivityTypeId?: string | null;
  initialIntervals?: {
    reps: number | null;
    workDistanceM: number | null;
    workDurationSec: number | null;
    restSec: number | null;
  } | null;
  initialGear?: GearPick[];
  /** Stored pool-swim payload off RoutineLog.sportData. Null for every
   *  non-pool cardio log. */
  initialPoolSwim?: PoolSwimData | null;
  // When provided (drawer-mounted edit), called after a successful save
  // instead of navigating to `returnTo`. Lets the drawer close + refresh
  // the page in place.
  onComplete?: () => void;
  // When provided, the Back button calls this instead of navigating.
  onCancel?: () => void;
}) {
  const [distanceMi, setDistanceMi] = useState(initialDistanceMi != null ? String(initialDistanceMi) : "");
  const [elevationGainFt, setElevationGainFt] = useState(
    initialElevationGainFt !== null && initialElevationGainFt !== undefined ? String(initialElevationGainFt) : ""
  );
  const [minutes, setMinutes] = useState(initialDurationSec != null ? String(Math.floor(initialDurationSec / 60)) : "");
  const [seconds, setSeconds] = useState(initialDurationSec != null ? String(initialDurationSec % 60) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(initialSpot);
  const [gear, setGear] = useState<GearPick[]>(initialGear);
  // Blank = fall back to what the linked gear weighs; typed = override.
  const [packWeightLb, setPackWeightLb] = useState(
    initialPackWeightGrams != null ? String(lbFromGrams(initialPackWeightGrams)) : ""
  );
  const packSummary = summarizePackWeight(gear);
  const gearPackGrams = packSummary.grams;
  // Show the arithmetic rather than an unexplained number — which items were
  // counted, which were skipped and why.
  const packHint = (() => {
    const skipped: string[] = [];
    if (packSummary.wornSkipped.length > 0) skipped.push(`skipped as worn: ${packSummary.wornSkipped.join(", ")}`);
    if (packSummary.unweighed.length > 0) skipped.push(`no weight on file: ${packSummary.unweighed.join(", ")}`);
    if (gearPackGrams > 0) {
      const n = packSummary.counted.length;
      const head = `${lbFromGrams(gearPackGrams)} lb from ${n} carried item${n === 1 ? "" : "s"} — leave blank to use it.`;
      return skipped.length > 0 ? `${head} (${skipped.join("; ")})` : head;
    }
    if (skipped.length > 0) return `Nothing carried counted yet — ${skipped.join("; ")}.`;
    return "Pack, pads, water. Weigh your gear above and this fills itself in; worn things like shoes don't count.";
  })();
  const [recentSpots, setRecentSpots] = useState<Array<{ ref: { kind: "activitySpot" | "climbLocation"; id: string }; name: string; region: string | null }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Activity type — switchable via the dropdown below so a mis-categorized
  // log (Trail Run that should be Long Run, e.g.) can be fixed in place.
  const [activityTypeId, setActivityTypeId] = useState<string | null>(initialActivityTypeId);
  const activeType = availableActivityTypes.find((t) => t.id === activityTypeId) ?? null;
  // Interval inputs — pre-filled from the stored payload. Empty strings
  // when null so the inputs read clean (placeholder shows).
  const [intervalReps, setIntervalReps] = useState(initialIntervals?.reps != null ? String(initialIntervals.reps) : "");
  const [intervalWorkDistanceM, setIntervalWorkDistanceM] = useState(
    initialIntervals?.workDistanceM != null ? String(initialIntervals.workDistanceM) : ""
  );
  const [intervalWorkMin, setIntervalWorkMin] = useState(
    initialIntervals?.workDurationSec != null ? String(Math.floor(initialIntervals.workDurationSec / 60)) : ""
  );
  const [intervalWorkSec, setIntervalWorkSec] = useState(
    initialIntervals?.workDurationSec != null ? String(initialIntervals.workDurationSec % 60) : ""
  );
  const [intervalRestMin, setIntervalRestMin] = useState(
    initialIntervals?.restSec != null ? String(Math.floor(initialIntervals.restSec / 60)) : ""
  );
  const [intervalRestSec, setIntervalRestSec] = useState(
    initialIntervals?.restSec != null ? String(initialIntervals.restSec % 60) : ""
  );

  const isPoolSwim = isPoolSwimType(activeType?.slug);
  const [poolSwim, setPoolSwim] = useState<PoolSwimFormState>(() =>
    initialPoolSwim ? poolSwimDataToForm(initialPoolSwim) : emptyPoolSwimFormState(),
  );
  const liveDurationSec = Number(minutes || "0") * 60 + Number(seconds || "0");

  const spotConfig = activitySlug ? getActivitySpotConfig(activitySlug) : null;
  const showSpotPicker = activitySlug != null && spotConfig?.supportsMap === true;

  useEffect(() => {
    if (!activitySlug) { setRecentSpots([]); return; }
    let cancelled = false;
    fetch(`/api/spots/recent?slug=${encodeURIComponent(activitySlug)}&limit=5`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("recent fetch failed"))))
      .then((data) => { if (!cancelled) setRecentSpots(data.recent ?? []); })
      .catch(() => { if (!cancelled) setRecentSpots([]); });
    return () => { cancelled = true; };
  }, [activitySlug]);

  async function onSave() {
    const mins = Number(minutes || "0");
    const secs = Number(seconds || "0");
    const durationSec = mins * 60 + secs;

    // Same derivation as the create form: the set list owns the distance on
    // a pool swim, and distanceMi is computed from it.
    const poolData = isPoolSwim ? normalizePoolSwimData(poolSwimFormToData(poolSwim)) : null;
    const poolTotals = poolData ? poolSwimTotals(poolData, durationSec) : null;

    const distanceProvided = isPoolSwim ? poolTotals !== null : distanceMi.trim().length > 0;
    const distance = isPoolSwim
      ? poolTotals?.distanceMi ?? null
      : distanceProvided
        ? Number(distanceMi)
        : null;
    const elevation =
      elevationGainFt.trim().length > 0
        ? Number(elevationGainFt)
        : null;

    const hasDistance = distance !== null && Number.isFinite(distance) && distance > 0;
    const hasDuration = Number.isFinite(durationSec) && durationSec > 0;
    if (distanceProvided && !hasDistance) {
      setError("Enter a valid distance in miles, or leave it blank.");
      return;
    }
    if (!hasDistance && !hasDuration) {
      setError(
        isPoolSwim
          ? "Add at least one set (reps × distance), or a duration."
          : "Add a distance or a duration.",
      );
      return;
    }
    if (elevation !== null && (!Number.isFinite(elevation) || elevation < 0)) {
      setError("Enter a valid elevation gain in feet.");
      return;
    }
    const packOverride = packWeightLb.trim();
    if (packOverride !== "" && (!Number.isFinite(Number(packOverride)) || Number(packOverride) < 0)) {
      setError("Enter a valid carried load in pounds.");
      return;
    }

    // Build the intervals payload from the form state. When the active
    // type doesn't use intervals OR no field has a meaningful value, we
    // send null to clear any prior structure on this log.
    let intervalsConfig:
      | { reps: number | null; workDistanceM: number | null; workDurationSec: number | null; restSec: number | null }
      | null = null;
    if (activeType?.usesIntervals) {
      const reps = intervalReps.trim() ? Math.max(0, Math.floor(Number(intervalReps))) : null;
      const workDistanceM = intervalWorkDistanceM.trim() ? Math.max(0, Number(intervalWorkDistanceM)) : null;
      const workMins = Number(intervalWorkMin || "0");
      const workSecs = Number(intervalWorkSec || "0");
      const workDurationSec = workMins * 60 + workSecs > 0 ? workMins * 60 + workSecs : null;
      const restMins = Number(intervalRestMin || "0");
      const restSecs = Number(intervalRestSec || "0");
      const restSec = restMins * 60 + restSecs > 0 ? restMins * 60 + restSecs : null;
      if (reps !== null || workDistanceM !== null || workDurationSec !== null || restSec !== null) {
        intervalsConfig = { reps, workDistanceM, workDurationSec, restSec };
      }
    }

    setSaving(true);
    setError(null);
    try {
      const spotParams = spotParamsForUpdate(spotValue, initialSpot !== null);
      await updateRunLog({
        routineId,
        logId,
        distanceMi: distance,
        durationSec,
        elevationGainFt: elevation,
        packWeightGrams:
          packOverride === "" ? (gearPackGrams > 0 ? gearPackGrams : null) : gramsFromLb(Number(packOverride)),
        notes,
        performedAtLocal,
        activitySlug: activitySlug ?? undefined,
        // Pass the (possibly changed) activity type + intervals payload
        // through to the action. Server overwrites both atomically.
        activityTypeId: activityTypeId ?? null,
        intervalsConfig,
        sportData: poolData,
        gearPicks: gearToPickInput(gear),
        ...spotParams,
      });
      if (onComplete) onComplete();
      else window.location.href = returnTo;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Group the type options by family so the dropdown reads
  // "Running ▸ Run / Trail Run / …" — same UX as the create form.
  const groupedTypes = (() => {
    const byFamily = new Map<string, { name: string; sortOrder: number; types: EditCardioTypeOption[] }>();
    for (const t of availableActivityTypes) {
      const cur = byFamily.get(t.familyId) ?? { name: t.familyName, sortOrder: t.familySortOrder, types: [] };
      cur.types.push(t);
      byFamily.set(t.familyId, cur);
    }
    return [...byFamily.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  })();

  return (
    <FormStack maxWidth={560}>
      <DateTimeField value={performedAtLocal} onChange={setPerformedAtLocal} />

      {/* Activity type picker — visible whenever the API returns options.
          Switches the elevation field's visibility + the interval block
          to match the new type. Soft tint matches the new-log form. */}
      {availableActivityTypes.length > 0 && (
        <FormSection title="Activity">
          <Field label="Activity type" hint="Switch the type if this log was mis-categorized.">
            <select
              style={inputStyle as React.CSSProperties}
              value={activityTypeId ?? ""}
              onChange={(e) => setActivityTypeId(e.target.value || null)}
            >
              <option value="">No type</option>
              {groupedTypes.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </FormSection>
      )}

      <FormSection title="Cardio">
        <FieldGrid>
          {!isPoolSwim && (
            <Field label="Distance (miles)">
              <input style={inputStyle} value={distanceMi} onChange={(e) => setDistanceMi(e.target.value)} inputMode="decimal" />
            </Field>
          )}
          {/* Hide elevation only when the active type explicitly opts out
              (pool swim, erg row). Default visible for any unknown / no-
              type log so we don't accidentally drop existing data. */}
          {(activeType?.hasElevation ?? true) && (
            <Field label="Elevation gain (ft, optional)">
              <input style={inputStyle} value={elevationGainFt} onChange={(e) => setElevationGainFt(e.target.value)} inputMode="numeric" />
            </Field>
          )}
        </FieldGrid>

        <FieldGrid>
          <Field label="Minutes">
            <input style={inputStyle} value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Seconds">
            <input style={inputStyle} value={seconds} onChange={(e) => setSeconds(e.target.value)} inputMode="numeric" />
          </Field>
        </FieldGrid>

        {/* Structured interval block — shown when the active type uses
            intervals (Sprint, Interval Run). Mirrors the create form. */}
        {isPoolSwim && (
          <PoolSwimSets value={poolSwim} onChange={setPoolSwim} durationSec={liveDurationSec} />
        )}

        {activeType?.usesIntervals && (
          <div style={editIntervalsBlockStyle}>
            <div style={editIntervalsHeaderStyle}>
              {activeType.slug === "sprint" ? "Sprint structure" : "Interval structure"}
            </div>
            <FieldGrid>
              <Field label="Reps">
                <input style={inputStyle} value={intervalReps} onChange={(e) => setIntervalReps(e.target.value)} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Work distance (m, optional)">
                <input style={inputStyle} value={intervalWorkDistanceM} onChange={(e) => setIntervalWorkDistanceM(e.target.value)} inputMode="numeric" placeholder="400" />
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Field label="Work min">
                <input style={inputStyle} value={intervalWorkMin} onChange={(e) => setIntervalWorkMin(e.target.value)} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Work sec">
                <input style={inputStyle} value={intervalWorkSec} onChange={(e) => setIntervalWorkSec(e.target.value)} inputMode="numeric" placeholder="00" />
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Field label="Rest min">
                <input style={inputStyle} value={intervalRestMin} onChange={(e) => setIntervalRestMin(e.target.value)} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Rest sec">
                <input style={inputStyle} value={intervalRestSec} onChange={(e) => setIntervalRestSec(e.target.value)} inputMode="numeric" placeholder="00" />
              </Field>
            </FieldGrid>
          </div>
        )}

        {showSpotPicker && spotConfig ? (
          <SpotPicker
            config={spotConfig}
            spotNoun={spotConfig.spotNoun}
            savedSpots={savedSpots}
            recentSpots={recentSpots}
            value={spotValue}
            onChange={setSpotValue}
          />
        ) : null}

      </FormSection>

      <FormSection title="Gear">
        <GearPicker
          activitySlug={activitySlug ?? "running"}
          value={gear}
          onChange={setGear}
          showConsumable={false}
        />
        <Field
          label="Carried load (lb, optional)"
          hint={packHint}
        >
          <input
            style={inputStyle}
            value={packWeightLb}
            onChange={(e) => setPackWeightLb(e.target.value)}
            inputMode="decimal"
            placeholder={gearPackGrams > 0 ? String(lbFromGrams(gearPackGrams)) : "0"}
          />
        </Field>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes">
          <textarea style={textareaStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </FormSection>

      <FormError message={error} />

      <FormActions
        primaryLabel="Save Changes"
        primaryPendingLabel="Saving…"
        saving={saving}
        onPrimary={onSave}
        backHref={returnTo}
        onBack={onCancel}
      />
    </FormStack>
  );
}

// Local soft-blue tint for the structured workout block — matches the
// create-log form and the schedule-picker endurance shortcut so type-
// driven content reads consistently across surfaces.
const editIntervalsBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 14,
  borderRadius: 12,
  background: "rgba(78,148,255,0.05)",
  border: "1px solid rgba(78,148,255,0.22)",
};

const editIntervalsHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(191,219,254,0.95)",
};
