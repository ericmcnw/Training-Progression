"use client";

import Link from "next/link";
import { useState } from "react";
import { createCompletionLog } from "../../actions";

export default function CompletionLogForm({ routineId }: { routineId: string }) {
  const [completionCount, setCompletionCount] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const parsedCount = completionCount.trim() ? Number(completionCount) : null;
    if (parsedCount !== null && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      alert("Count must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await createCompletionLog({
        routineId,
        completionCount: parsedCount,
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
        <label style={styles.label}>Count (optional)</label>
        <input
          style={styles.input}
          value={completionCount}
          onChange={(event) => setCompletionCount(event.target.value)}
          inputMode="numeric"
          placeholder="Leave blank for a simple done log"
        />
      </div>

      <div>
        <label style={styles.label}>Notes (optional)</label>
        <textarea
          style={{ ...styles.input, minHeight: 90, resize: "vertical" as const }}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any context worth keeping?"
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
            onChange={(event) => setPerformedAtLocal(event.target.value)}
          />
        </div>
      </details>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={styles.btn}>
          {saving ? "Saving..." : "Save Completion"}
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
