"use client";

// Mark time away — a multi-day span (vacation / travel / sick / rest) that
// draws a band across the Plan calendar and the Home Week-at-a-Glance,
// explaining a dip in activity. Lives on the Plan page's Schedule section;
// used to be buried in the Home FAB's quick-add menu.

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Popover from "@/app/_home/Popover";
import { createDaySpan } from "@/app/_home/day-span-actions";

const AWAY_KINDS: Array<{ value: string; label: string }> = [
  { value: "vacation", label: "🏖️ Vacation" },
  { value: "travel", label: "✈️ Travel" },
  { value: "away", label: "📍 Away" },
  { value: "sick", label: "🤒 Sick" },
  { value: "rest", label: "😴 Rest" },
];

export default function MarkTimeAwayButton({ today, style }: { today: string; style?: CSSProperties }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState("vacation");
  const [label, setLabel] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = label.trim();
    if (!trimmed) { setError("Add a label."); return; }
    if (!start || !end) { setError("Pick start and end dates."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await createDaySpan({ kind, label: trimmed, startYmd: start, endYmd: end });
        setOpen(false);
        setLabel("");
        router.refresh();
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...triggerBtn, ...style }}>
        🏖️ Mark time away
      </button>

      <Popover open={open} onClose={() => setOpen(false)} title="Mark time away" desktopWidth={360}>
        <div style={form}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
            {AWAY_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Hawaii)"
            style={input}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} aria-label="Start date" />
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} aria-label="End date" />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={save} disabled={pending || !label.trim()} style={saveBtn}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} style={cancelBtn}>
              Cancel
            </button>
          </div>
          {error ? <div role="alert" style={errorText}>{error}</div> : null}
        </div>
      </Popover>
    </>
  );
}

const triggerBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(251,191,36,0.40)",
  background: "rgba(251,191,36,0.10)",
  color: "rgba(253,224,140,0.95)",
  fontSize: 12.5,
  fontWeight: 800,
  letterSpacing: 0.2,
  cursor: "pointer",
  minHeight: 36,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const form: CSSProperties = {
  display: "grid",
  gap: 8,
};

// fontSize 16 so the <select> + date inputs don't trigger iOS Safari zoom.
const input: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 42,
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
};

const saveBtn: CSSProperties = {
  minHeight: 42,
  padding: "9px 16px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.12)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const cancelBtn: CSSProperties = {
  minHeight: 42,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const errorText: CSSProperties = {
  color: "rgba(248,113,113,0.95)",
  fontSize: 12,
  fontWeight: 700,
};
