"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { logGuided } from "../../actions";

type Step = {
  id: string;
  title: string;
  durationSec: number | null;
  restSec: number | null;
  sortOrder: number;
};

export default function GuidedLogForm({
  routineId,
  steps,
}: {
  routineId: string;
  steps: Step[];
}) {
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [customDurationMin, setCustomDurationMin] = useState("");
  const [saving, setSaving] = useState(false);
  const defaultDurationSec = useMemo(
    () => steps.reduce((sum, step) => sum + (step.durationSec ?? 0) + (step.restSec ?? 0), 0),
    [steps]
  );

  async function onSave() {
    const customDurationSec = customDurationMin.trim() ? Number(customDurationMin) * 60 : null;
    if (customDurationSec !== null && (!Number.isFinite(customDurationSec) || customDurationSec <= 0)) {
      alert("Duration must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await logGuided({
        routineId,
        durationSec: customDurationSec,
        notes,
        performedAtLocal: performedAtLocal || undefined,
        steps: steps.map((step) => ({
          guidedStepId: step.id,
          title: step.title,
          durationSec: step.durationSec,
          restSec: step.restSec,
          sortOrder: step.sortOrder,
        })),
      });
      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 580 }}>
      <div>
        <label style={styles.label}>Duration override (minutes, optional)</label>
        <input
          style={styles.input}
          value={customDurationMin}
          onChange={(event) => setCustomDurationMin(event.target.value)}
          inputMode="decimal"
          placeholder={defaultDurationSec > 0 ? `Default template total: ${Math.round(defaultDurationSec / 60)} min` : "Leave blank to use step total"}
        />
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

      <div style={styles.templateCard}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>Guided Steps</div>
        {steps.length === 0 && <div style={{ marginTop: 8, opacity: 0.75 }}>No guided steps are saved yet. You can still log total duration and notes.</div>}
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {steps.map((step, index) => (
            <div key={step.id} style={styles.stepRow}>
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
          {saving ? "Saving..." : "Save Guided Log"}
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
