"use client";

import Link from "next/link";
import { useState } from "react";
import { updateGuidedLog } from "../../../actions";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Step = {
  guidedStepId: string | null;
  title: string;
  durationSec: number | null;
  restSec: number | null;
  sortOrder: number;
};

export default function EditGuidedLogForm({
  routineId,
  logId,
  returnTo,
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
  steps,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  steps: Step[];
}) {
  const [durationMin, setDurationMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const durationSec = durationMin.trim() ? Number(durationMin) * 60 : null;
    if (durationSec !== null && (!Number.isFinite(durationSec) || durationSec <= 0)) {
      alert("Duration must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await updateGuidedLog({
        routineId,
        logId,
        durationSec,
        notes,
        performedAtLocal,
        steps,
      });
      window.location.href = returnTo;
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
        <label style={styles.label}>Performed at</label>
        <input type="datetime-local" style={styles.input} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
      </div>

      <div>
        <label style={styles.label}>Notes</label>
        <textarea style={{ ...styles.input, minHeight: 90 }} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div style={styles.templateCard}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>Saved steps</div>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {steps.map((step, index) => (
            <div key={`${step.guidedStepId ?? "step"}-${index}`} style={styles.stepRow}>
              <div style={{ fontWeight: 800 }}>{index + 1}. {step.title}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {step.durationSec ? `${step.durationSec}s work` : "No work time"}
                {step.restSec ? ` | ${step.restSec}s rest` : ""}
              </div>
            </div>
          ))}
        </div>
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
  templateCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
  stepRow: {
    border: "1px solid rgba(128,128,128,0.24)",
    borderRadius: 10,
    padding: 8,
    background: "rgba(128,128,128,0.05)",
  },
};
