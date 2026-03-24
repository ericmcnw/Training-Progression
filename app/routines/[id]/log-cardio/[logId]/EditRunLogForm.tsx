"use client";

import { useState } from "react";
import { updateRunLog } from "../../../actions";
import { Field, FieldGrid, FormActions, FormSection, FormStack, inputStyle, textareaStyle } from "../../log/form-ui";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
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
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDistanceMi: number;
  initialElevationGainFt: number | null;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
}) {
  const [distanceMi, setDistanceMi] = useState(String(initialDistanceMi));
  const [elevationGainFt, setElevationGainFt] = useState(
    initialElevationGainFt !== null && initialElevationGainFt !== undefined ? String(initialElevationGainFt) : ""
  );
  const [minutes, setMinutes] = useState(String(Math.floor(initialDurationSec / 60)));
  const [seconds, setSeconds] = useState(String(initialDurationSec % 60));
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);

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
      await updateRunLog({
        routineId,
        logId,
        distanceMi: distance,
        durationSec,
        elevationGainFt: elevation,
        notes,
        performedAtLocal,
      });
      window.location.href = returnTo;
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      <FormSection title="Cardio details">
        <Field label="Performed at">
          <input type="datetime-local" style={inputStyle} value={performedAtLocal} onChange={(e) => setPerformedAtLocal(e.target.value)} />
        </Field>

        <Field label="Distance (miles)">
          <input style={inputStyle} value={distanceMi} onChange={(e) => setDistanceMi(e.target.value)} inputMode="decimal" />
        </Field>

        <FieldGrid>
          <Field label="Minutes">
            <input style={inputStyle} value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Seconds">
            <input style={inputStyle} value={seconds} onChange={(e) => setSeconds(e.target.value)} inputMode="numeric" />
          </Field>
        </FieldGrid>

        <Field label="Elevation gain (ft, optional)">
          <input
            style={inputStyle}
            value={elevationGainFt}
            onChange={(e) => setElevationGainFt(e.target.value)}
            inputMode="numeric"
          />
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
      />
    </FormStack>
  );
}
