"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { logRun } from "../../actions";
import PostSessionPainCheck, { type PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import {
  Field,
  FormActions,
  FormSection,
  FormStack,
  OptionalDateSection,
  textareaStyle,
} from "../log/form-ui";

export default function LogRunForm({
  routineId,
  routineName,
  activePainZones = [],
}: {
  routineId: string;
  routineName: string;
  activePainZones?: PainCheckZone[];
}) {
  const [distanceMi, setDistanceMi] = useState("");
  const [elevationGainFt, setElevationGainFt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [painCheckLogId, setPainCheckLogId] = useState<string | null>(null);

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
        setPainCheckLogId(logId);
        return;
      }
      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      <FormSection title="Cardio details">
        {/* Distance */}
        <Field label="Distance (miles)">
          <input
            style={bigInputStyle}
            value={distanceMi}
            onChange={(e) => setDistanceMi(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>

        {/* Duration row */}
        <div>
          <div style={fieldLabelStyle}>Duration</div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 6 }}>
            <div style={{ flex: 1, display: "grid", gap: 4 }}>
              <div style={unitLabelStyle}>min</div>
              <input
                style={bigInputStyle}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
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
                onChange={(e) => setSeconds(e.target.value)}
                inputMode="numeric"
                placeholder="00"
              />
            </div>
          </div>
        </div>

        {/* Live pace */}
        {pace && (
          <div style={paceBadgeStyle}>
            <span style={{ opacity: 0.65, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>PACE</span>
            <span style={{ fontSize: 22, fontWeight: 900 }}>{pace}</span>
          </div>
        )}

        <Field label="Elevation gain (ft, optional)" hint="Hiking, trail runs, or any climb-heavy cardio.">
          <input
            style={bigInputStyle}
            value={elevationGainFt}
            onChange={(e) => setElevationGainFt(e.target.value)}
            inputMode="numeric"
            placeholder="0"
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

