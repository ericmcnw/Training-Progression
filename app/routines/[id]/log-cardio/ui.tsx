"use client";

import { useState } from "react";
import { logRun } from "../../actions";
import PostSessionPainCheck, { type PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import SportZoneTagger from "@/app/components/log/SportZoneTagger";
import {
  Field,
  FieldGrid,
  FormActions,
  FormSection,
  FormStack,
  OptionalDateSection,
  inputStyle,
  textareaStyle,
} from "../log/form-ui";

export default function LogRunForm({
  routineId,
  routineName,
  activePainZones = [],
  bodyZones = [],
}: {
  routineId: string;
  routineName: string;
  activePainZones?: PainCheckZone[];
  bodyZones?: PainCheckZone[];
}) {
  const [distanceMi, setDistanceMi] = useState("");
  const [elevationGainFt, setElevationGainFt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);
  const [sportTagLogId, setSportTagLogId] = useState<string | null>(null);

  if (sportTagLogId) {
    return (
      <SportZoneTagger
        zones={bodyZones}
        routineLogId={sportTagLogId}
        label={routineName}
        onDone={() => {
          const logId = sportTagLogId;
          setSportTagLogId(null);
          if (activePainZones.length > 0) setPainCheckLogId(logId);
          else window.location.href = "/routines";
        }}
      />
    );
  }

  if (painCheckLogId) {
    return <PostSessionPainCheck zones={activePainZones} routineLogId={painCheckLogId} onDone={() => { window.location.href = "/routines"; }} />;
  }

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
      const logId = await logRun({
        routineId,
        distanceMi: distance,
        durationSec,
        elevationGainFt: elevation,
        notes,
        performedAtLocal: performedAtLocal || undefined,
      });
      if (logId && activePainZones.length > 0) {
        setSportTagLogId(logId);
        return;
      }
      if (logId && bodyZones.length > 0) {
        setSportTagLogId(logId);
        return;
      }

      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      <FormSection title="Cardio details" description="Capture the session first. Timing and notes stay in the same places as the other routine logs.">
        <Field label="Distance (miles)">
          <input
            style={inputStyle}
            value={distanceMi}
            onChange={(e) => setDistanceMi(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 4.25"
          />
        </Field>

        <FieldGrid>
          <Field label="Minutes">
            <input
              style={inputStyle}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 38"
            />
          </Field>

          <Field label="Seconds">
            <input
              style={inputStyle}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 15"
            />
          </Field>
        </FieldGrid>

        <Field label="Elevation gain (ft, optional)" hint="Useful for hiking, trail runs, stairs, or any climb-heavy cardio.">
          <input
            style={inputStyle}
            value={elevationGainFt}
            onChange={(e) => setElevationGainFt(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 1200"
          />
        </Field>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes (optional)" hint="Use this for feel, route, weather, or anything you want to review later.">
          <textarea
            style={textareaStyle}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did cardio feel?"
          />
        </Field>
      </FormSection>

      <OptionalDateSection value={performedAtLocal} onChange={setPerformedAtLocal} />

      <FormActions
        primaryLabel="Save Cardio"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref="/routines"
      />
    </FormStack>
  );
}

