"use client";

import Link from "next/link";
import { useState } from "react";
import { logSession } from "../../actions";

export default function SessionLogForm({ routineId }: { routineId: string }) {
  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [metricName, setMetricName] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const durationSec = Number(durationMin) * 60;
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      alert("Enter a valid duration in minutes.");
      return;
    }

    const metric =
      metricName.trim() && metricValue.trim()
        ? [{ name: metricName, value: Number(metricValue), unit: metricUnit }]
        : [];

    if (metric.length > 0 && !Number.isFinite(metric[0].value)) {
      alert("Metric value must be a number.");
      return;
    }

    setSaving(true);
    try {
      await logSession({
        routineId,
        durationSec,
        location,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        metrics: metric,
      });
      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 580 }}>
      <div>
        <label style={styles.label}>Duration (minutes)</label>
        <input style={styles.input} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
      </div>

      <div>
        <label style={styles.label}>Location (optional)</label>
        <input style={styles.input} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Gym, beach, bouldering wall..." />
      </div>

      <div style={styles.metricCard}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>Optional metric</div>
        <div style={{ marginTop: 8, display: "grid", gap: 8, gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          <input style={styles.input} value={metricName} onChange={(event) => setMetricName(event.target.value)} placeholder="Metric name" />
          <input style={styles.input} value={metricValue} onChange={(event) => setMetricValue(event.target.value)} inputMode="decimal" placeholder="Value" />
          <input style={styles.input} value={metricUnit} onChange={(event) => setMetricUnit(event.target.value)} placeholder="Unit" />
        </div>
      </div>

      <div>
        <label style={styles.label}>Notes (optional)</label>
        <textarea style={{ ...styles.input, minHeight: 90 }} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <details style={styles.details}>
        <summary data-collapsible-summary style={styles.summary}>Log with custom date/time (optional)</summary>
        <div style={{ marginTop: 8 }}>
          <label style={styles.label}>Performed at</label>
          <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
        </div>
      </details>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Session"}
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
  metricCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
};
