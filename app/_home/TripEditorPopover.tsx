"use client";

// Create / edit a trip (DaySpan) — kind, label, custom emoji, and date range.
// Shared by the Plan month calendar (tap a trip band) and the Home
// Week-at-a-Glance (Edit next to Remove). Passing `existing` puts it in edit
// mode (adds Delete + calls updateDaySpan); omitting it creates a new trip.

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Popover from "./Popover";
import { createDaySpan, updateDaySpan, deleteDaySpan } from "./day-span-actions";
import { DAY_SPAN_KINDS, TRIP_QUICK_EMOJI, daySpanIcon } from "@/lib/day-span-kinds";

export type TripEditorTarget = {
  id: string;
  kind: string;
  label: string;
  icon: string | null;
  startYmd: string;
  endYmd: string;
};

export default function TripEditorPopover({
  open,
  onClose,
  existing,
  today,
}: {
  open: boolean;
  onClose: () => void;
  existing?: TripEditorTarget | null;
  today?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const [pending, startTransition] = useTransition();
  // Callers mount this only when needed (and key it by target id), so
  // initializing straight from props is correct — a new target remounts.
  const [kind, setKind] = useState(existing?.kind ?? "vacation");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "");
  const [start, setStart] = useState(existing?.startYmd ?? today ?? "");
  const [end, setEnd] = useState(existing?.endYmd ?? today ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = label.trim();
    if (!trimmed) { setError("Add a label."); return; }
    if (!start || !end) { setError("Pick start and end dates."); return; }
    setError(null);
    startTransition(async () => {
      try {
        if (existing) {
          await updateDaySpan({ id: existing.id, kind, label: trimmed, icon, startYmd: start, endYmd: end });
        } else {
          await createDaySpan({ kind, label: trimmed, icon, startYmd: start, endYmd: end });
        }
        onClose();
        router.refresh();
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  function remove() {
    if (!existing) return;
    startTransition(async () => {
      try {
        await deleteDaySpan(existing.id);
        onClose();
        router.refresh();
      } catch {
        setError("Couldn't delete. Try again.");
      }
    });
  }

  const effectiveIcon = icon.trim() || daySpanIcon(kind);

  return (
    <Popover open={open} onClose={onClose} title={isEdit ? "Edit trip" : "Mark time away"} desktopWidth={380}>
      <div style={form}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input} aria-label="Trip kind">
          {DAY_SPAN_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.icon} {k.label}</option>
          ))}
        </select>

        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Cape Cod)"
          style={input}
        />

        {/* Custom emoji — free text (mobile keyboard emoji works) + quick chips.
            Falls back to the kind's default glyph when left blank. */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={iconRow}>
            <span style={iconPreview} aria-hidden>{effectiveIcon}</span>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Icon — type any emoji"
              style={{ ...input, flex: 1 }}
              aria-label="Custom emoji"
            />
          </div>
          <div style={chipRow}>
            {TRIP_QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                style={{ ...emojiChip, ...(icon.trim() === e ? emojiChipActive : null) }}
                aria-label={`Use ${e}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIcon("")}
              style={{ ...emojiChip, ...(icon.trim() === "" ? emojiChipActive : null), fontSize: 11, fontWeight: 800 }}
            >
              Default
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} aria-label="Start date" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} aria-label="End date" />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={save} disabled={pending || !label.trim()} style={saveBtn}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Save"}
          </button>
          {isEdit ? (
            <button type="button" onClick={remove} disabled={pending} style={deleteBtn}>
              Delete
            </button>
          ) : null}
          <button type="button" onClick={() => { onClose(); setError(null); }} style={cancelBtn}>
            Cancel
          </button>
        </div>
        {error ? <div role="alert" style={errorText}>{error}</div> : null}
      </div>
    </Popover>
  );
}

const form: CSSProperties = { display: "grid", gap: 8 };

// fontSize 16 so the <select> + inputs don't trigger iOS Safari focus-zoom.
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

const iconRow: CSSProperties = { display: "flex", gap: 6, alignItems: "center" };

const iconPreview: CSSProperties = {
  width: 42,
  height: 42,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 20,
  lineHeight: 1,
};

const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };

const emojiChip: CSSProperties = {
  minWidth: 34,
  minHeight: 34,
  padding: "0 6px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 17,
  lineHeight: 1,
  cursor: "pointer",
};

const emojiChipActive: CSSProperties = {
  border: "1px solid rgba(51,255,122,0.55)",
  background: "rgba(51,255,122,0.12)",
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

const deleteBtn: CSSProperties = {
  minHeight: 42,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(248,113,113,0.10)",
  color: "rgba(248,113,113,0.95)",
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
