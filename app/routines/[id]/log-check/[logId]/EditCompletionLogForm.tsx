"use client";

import Link from "next/link";
import { useState } from "react";
import { updateCompletionLog } from "../../../actions";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function EditCompletionLogForm({
  routineId,
  logId,
  returnTo,
  initialCompletionCount,
  initialNotes,
  initialPerformedAt,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialCompletionCount: number | null;
  initialNotes: string;
  initialPerformedAt: Date;
}) {
  const [completionCount, setCompletionCount] = useState(initialCompletionCount ? String(initialCompletionCount) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const parsedCount = completionCount.trim() ? Number(completionCount) : null;
    if (parsedCount !== null && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      alert("Count must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await updateCompletionLog({
        routineId,
        logId,
        notes,
        completionCount: parsedCount,
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
