"use client";

import Link from "next/link";
import { useState } from "react";
import { updateRunLog } from "../../../actions";

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
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDistanceMi: number;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
}) {
  const [distanceMi, setDistanceMi] = useState(String(initialDistanceMi));
  const [minutes, setMinutes] = useState(String(Math.floor(initialDurationSec / 60)));
  const [seconds, setSeconds] = useState(String(initialDurationSec % 60));
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const distance = Number(distanceMi);
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

    setSaving(true);
    try {
      await updateRunLog({
        routineId,
        logId,
        distanceMi: distance,
        durationSec,
        notes,
        performedAtLocal,
      });
      window.location.href = returnTo;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <div>
        <label style={styles.label}>Performed at</label>
        <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(e) => setPerformedAtLocal(e.target.value)} />
      </div>

      <div>
        <label style={styles.label}>Distance (miles)</label>
        <input style={styles.input} value={distanceMi} onChange={(e) => setDistanceMi(e.target.value)} inputMode="decimal" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={styles.label}>Minutes</label>
          <input style={styles.input} value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label style={styles.label}>Seconds</label>
          <input style={styles.input} value={seconds} onChange={(e) => setSeconds(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      <div>
        <label style={styles.label}>Notes</label>
        <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <Link href={returnTo} style={styles.linkBtn}>
          Back
        </Link>
      </div>
    </div>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 10,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  linkBtn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
    textDecoration: "none",
  },
};
