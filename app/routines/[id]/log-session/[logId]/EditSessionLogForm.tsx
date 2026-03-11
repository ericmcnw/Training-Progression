"use client";

import Link from "next/link";
import { useState } from "react";
import { updateSessionLog } from "../../../actions";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditSessionLogForm({
  routineId,
  logId,
  returnTo,
  initialDurationSec,
  initialLocation,
  initialNotes,
  initialPerformedAt,
  initialMetric,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDurationSec: number;
  initialLocation: string;
  initialNotes: string;
  initialPerformedAt: Date;
  initialMetric?: { name: string; value: number; unit: string | null } | null;
}) {
  const [durationMin, setDurationMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [location, setLocation] = useState(initialLocation);
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [metricName, setMetricName] = useState(initialMetric?.name ?? "");
  const [metricValue, setMetricValue] = useState(initialMetric ? String(initialMetric.value) : "");
  const [metricUnit, setMetricUnit] = useState(initialMetric?.unit ?? "");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const durationSec = Number(durationMin) * 60;
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      alert("Duration must be greater than 0.");
      return;
    }

    const metrics =
      metricName.trim() && metricValue.trim()
        ? [{ name: metricName, value: Number(metricValue), unit: metricUnit }]
        : [];
    if (metrics.length > 0 && !Number.isFinite(metrics[0].value)) {
      alert("Metric value must be a number.");
      return;
    }

    setSaving(true);
    try {
      await updateSessionLog({
        routineId,
        logId,
        durationSec,
        location,
        notes,
        performedAtLocal,
        metrics,
      });
      window.location.href = returnTo;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 580 }}>
      <div>
        <label style={styles.label}>Performed at</label>
        <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
      </div>

      <div>
        <label style={styles.label}>Duration (minutes)</label>
        <input style={styles.input} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
      </div>

      <div>
        <label style={styles.label}>Location</label>
        <input style={styles.input} value={location} onChange={(event) => setLocation(event.target.value)} />
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
        <label style={styles.label}>Notes</label>
        <textarea style={{ ...styles.input, minHeight: 90 }} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
  metricCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
};
