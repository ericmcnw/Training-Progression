"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { logSportAction } from "@/app/log/sport-actions";

// One row in the SPORT section, representing a user's selected sport.
// Tap → log sheet with date / duration / notes. Per-sport rich schemas
// (climbing per-attempt entry, golf range/course modes) come in later
// phases.

export type SportRowData = {
  slug: string;
  label: string;
  eyebrow: string;
  /** Full-alpha accent color, used as the row's left stripe so the
   *  visual identity matches the chart palette on /activities/sports. */
  color: string;
};

export default function SportQuickLogRow({ sport }: { sport: SportRowData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...rowStyle, borderLeft: `3px solid ${sport.color}` }}
      >
        <span style={textCol}>
          <span style={rowLabel}>{sport.label}</span>
          <span style={rowEyebrow}>{sport.eyebrow}</span>
        </span>
        <span style={rowAction}>Log →</span>
      </button>
      {open ? <LogSheet sport={sport} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LogSheet({ sport, onClose }: { sport: SportRowData; onClose: () => void }) {
  const [performedAt, setPerformedAt] = useState(() => formatLocalDateTime(new Date()));
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const ms = Date.parse(performedAt);
    if (Number.isNaN(ms)) {
      setError("Invalid date/time.");
      return;
    }
    const minutes = duration.trim() === "" ? undefined : Number(duration);
    if (minutes !== undefined && (Number.isNaN(minutes) || minutes < 0)) {
      setError("Duration must be a positive number.");
      return;
    }
    startTransition(async () => {
      try {
        await logSportAction({
          sportSlug: sport.slug,
          performedAtIso: new Date(ms).toISOString(),
          durationMinutes: minutes,
          notes: notes.trim() || undefined,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log session.");
      }
    });
  }

  return (
    <div style={sheetOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Log ${sport.label}`}>
      <div style={sheetPanel} onClick={(e) => e.stopPropagation()}>
        <header style={sheetHeader}>
          <h3 style={sheetTitle}>Log {sport.label}</h3>
          <button type="button" onClick={onClose} style={sheetCloseBtn} aria-label="Close">
            ✕
          </button>
        </header>
        <div style={sheetBody}>
          <div style={formStack}>
            <label style={fieldLabel}>
              When
              <input
                type="datetime-local"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                style={fieldInput}
              />
            </label>
            <label style={fieldLabel}>
              Duration (minutes)
              <input
                type="number"
                inputMode="numeric"
                placeholder="optional"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={fieldInput}
              />
            </label>
            <label style={fieldLabel}>
              Notes
              <textarea
                placeholder="How'd it go?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...fieldInput, minHeight: 80, resize: "vertical" as const }}
              />
            </label>
            {error ? <div style={errorTextStyle}>{error}</div> : null}
            <div style={btnRowStyle}>
              <button type="button" onClick={onClose} style={btnSecondary} disabled={pending}>
                Cancel
              </button>
              <button type="button" onClick={submit} style={btnPrimary} disabled={pending}>
                {pending ? "Saving…" : "Save log"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "rgba(128,128,128,0.05)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 52,
};
const textCol: CSSProperties = { display: "grid", gap: 2, minWidth: 0 };
const rowLabel: CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };
const rowEyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};
const rowAction: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
  whiteSpace: "nowrap",
};

const sheetOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  background: "rgba(4,8,16,0.66)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "0 0 env(safe-area-inset-bottom)",
};
const sheetPanel: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "85vh",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  background: "#0e1a2e",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "16px 16px 0 0",
  boxShadow: "0 -10px 30px rgba(0,0,0,0.45)",
  overflow: "hidden",
};
const sheetHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
const sheetTitle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 900 };
const sheetCloseBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
const sheetBody: CSSProperties = { padding: "14px 14px 18px", overflowY: "auto" };
const formStack: CSSProperties = { display: "grid", gap: 12 };
const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const fieldInput: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  textTransform: "none",
  letterSpacing: 0,
  opacity: 1,
};
const errorTextStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(248,113,113,0.95)",
  fontWeight: 700,
};
const btnRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: 4,
};
const btnPrimary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};
const btnSecondary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
