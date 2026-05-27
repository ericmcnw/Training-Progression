"use client";

import { useEffect, useState } from "react";
import { updateRunLog } from "../../../actions";
import { Field, FieldGrid, FormActions, FormSection, FormStack, inputStyle, textareaStyle } from "../../log/form-ui";
import SpotPicker, { type SpotPickerValue } from "@/app/components/log/SpotPicker";
import {
  type SpotPickerItem,
  getActivitySpotConfig,
} from "@/lib/activity-spots";

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

export default function EditRunLogForm({
  routineId,
  logId,
  returnTo,
  initialDistanceMi,
  initialElevationGainFt,
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
  activitySlug = null,
  savedSpots = [],
  initialSpot = null,
  onComplete,
  onCancel,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDistanceMi: number;
  initialElevationGainFt: number | null;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  activitySlug?: string | null;
  savedSpots?: SpotPickerItem[];
  initialSpot?: SpotPickerValue;
  // When provided (drawer-mounted edit), called after a successful save
  // instead of navigating to `returnTo`. Lets the drawer close + refresh
  // the page in place.
  onComplete?: () => void;
  // When provided, the Back button calls this instead of navigating.
  onCancel?: () => void;
}) {
  const [distanceMi, setDistanceMi] = useState(String(initialDistanceMi));
  const [elevationGainFt, setElevationGainFt] = useState(
    initialElevationGainFt !== null && initialElevationGainFt !== undefined ? String(initialElevationGainFt) : ""
  );
  const [minutes, setMinutes] = useState(String(Math.floor(initialDurationSec / 60)));
  const [seconds, setSeconds] = useState(String(initialDurationSec % 60));
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(initialSpot);
  const [recentSpots, setRecentSpots] = useState<Array<{ ref: { kind: "activitySpot" | "climbLocation"; id: string }; name: string; region: string | null }>>([]);
  const [saving, setSaving] = useState(false);

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
    const distance = Number(distanceMi);
    const elevation =
      elevationGainFt.trim().length > 0
        ? Number(elevationGainFt)
        : null;
    const mins = Number(minutes || "0");
    const secs = Number(seconds || "0");
    const durationSec = mins * 60 + secs;
    if (!Number.isFinite(distance) || distance <= 0) {
      alert("Enter a valid distance in miles.");
      return;
    }
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      alert("Enter a valid duration.");
      return;
    }
    if (elevation !== null && (!Number.isFinite(elevation) || elevation < 0)) {
      alert("Enter a valid elevation gain in feet.");
      return;
    }

    setSaving(true);
    try {
      const spotParams = spotParamsForUpdate(spotValue, initialSpot !== null);
      await updateRunLog({
        routineId,
        logId,
        distanceMi: distance,
        durationSec,
        elevationGainFt: elevation,
        notes,
        performedAtLocal,
        activitySlug: activitySlug ?? undefined,
        ...spotParams,
      });
      if (onComplete) onComplete();
      else window.location.href = returnTo;
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      <FormSection title="Cardio">
        <FieldGrid>
          <Field label="Distance (miles)">
            <input style={inputStyle} value={distanceMi} onChange={(e) => setDistanceMi(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Elevation gain (ft, optional)">
            <input style={inputStyle} value={elevationGainFt} onChange={(e) => setElevationGainFt(e.target.value)} inputMode="numeric" />
          </Field>
        </FieldGrid>

        <FieldGrid>
          <Field label="Minutes">
            <input style={inputStyle} value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Seconds">
            <input style={inputStyle} value={seconds} onChange={(e) => setSeconds(e.target.value)} inputMode="numeric" />
          </Field>
        </FieldGrid>

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

        <Field label="Performed at">
          <input type="datetime-local" style={inputStyle} value={performedAtLocal} onChange={(e) => setPerformedAtLocal(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes">
          <textarea style={textareaStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
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
