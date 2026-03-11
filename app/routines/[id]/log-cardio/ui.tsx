"use client";

import Link from "next/link";
import { useState } from "react";
import { logRun } from "../../actions";

export default function LogRunForm({ routineId }: { routineId: string }) {
  const [distanceMi, setDistanceMi] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
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
      await logRun({
        routineId,
        distanceMi: distance,
        durationSec,
        notes,
        performedAtLocal: performedAtLocal || undefined,
      });

      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <div>
        <label style={styles.label}>Distance (miles)</label>
        <input
          style={styles.input}
          value={distanceMi}
          onChange={(e) => setDistanceMi(e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 4.25"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={styles.label}>Minutes</label>
          <input
            style={styles.input}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 38"
          />
        </div>

        <div>
          <label style={styles.label}>Seconds</label>
          <input
            style={styles.input}
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 15"
          />
        </div>
      </div>

      <div>
        <label style={styles.label}>Notes (optional)</label>
        <textarea
          style={{ ...styles.input, minHeight: 90, resize: "vertical" as const }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did cardio feel?"
        />
      </div>

      <details style={styles.details}>
        <summary data-collapsible-summary style={styles.summary}>Log with custom date/time (optional)</summary>
        <div style={{ marginTop: 8 }}>
          <label style={styles.label}>Performed at</label>
          <input
            type="datetime-local"
            style={styles.input}
            value={performedAtLocal}
            onChange={(e) => setPerformedAtLocal(e.target.value)}
          />
        </div>
      </details>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Cardio"}
        </button>
        <Link href="/routines" style={styles.linkBtn}>
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
  details: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(128,128,128,0.06)",
  },
  summary: {
    cursor: "pointer",
    fontWeight: 800 as const,
    fontSize: 13,
  },
};

