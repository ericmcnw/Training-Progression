"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { addSportAction, removeSportAction } from "@/app/log/sport-actions";

// The `+` pill that sits in the SPORT section's quickLogSlot. Opens
// a bottom-sheet picker for adding/removing sports. Kept separate
// from SportRow so each row + the picker have independent sheet
// state — simpler than threading a shared dispatcher through props.

export type AvailableSport = { slug: string; label: string; eyebrow: string };
export type SelectedSportLite = { slug: string; label: string; eyebrow: string };

export default function SportsAddButton({
  selected,
  available,
}: {
  selected: SelectedSportLite[];
  available: AvailableSport[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Add a sport"
        onClick={() => setOpen(true)}
        style={plusBtnStyle}
      >
        +
      </button>
      {open ? (
        <PickerSheet
          selected={selected}
          available={available}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function PickerSheet({
  selected,
  available,
  onClose,
}: {
  selected: SelectedSportLite[];
  available: AvailableSport[];
  onClose: () => void;
}) {
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(slug: string, currentlySelected: boolean) {
    setPendingSlug(slug);
    startTransition(async () => {
      try {
        if (currentlySelected) {
          await removeSportAction(slug);
        } else {
          await addSportAction(slug);
        }
      } finally {
        setPendingSlug(null);
      }
    });
  }

  return (
    <div style={sheetOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Your sports">
      <div style={sheetPanel} onClick={(e) => e.stopPropagation()}>
        <header style={sheetHeader}>
          <h3 style={sheetTitle}>Your sports</h3>
          <button type="button" onClick={onClose} style={sheetCloseBtn} aria-label="Close">
            ✕
          </button>
        </header>
        <div style={sheetBody}>
          <div style={pickerStack}>
            <p style={pickerHint}>
              Sports you’ve added appear in the SPORT section for quick session logging. Remove anytime — past logs stay.
            </p>
            {selected.length > 0 ? (
              <div style={pickerGroup}>
                <div style={pickerGroupLabel}>Added</div>
                {selected.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    style={pickerRowSelected}
                    onClick={() => toggle(s.slug, true)}
                    disabled={pendingSlug === s.slug}
                  >
                    <span style={pickerRowText}>
                      <span style={pickerRowLabel}>{s.label}</span>
                      <span style={pickerRowEyebrow}>{s.eyebrow}</span>
                    </span>
                    <span style={pickerRemoveHint}>{pendingSlug === s.slug ? "…" : "Remove"}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {available.length > 0 ? (
              <div style={pickerGroup}>
                <div style={pickerGroupLabel}>Available</div>
                {available.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    style={pickerRowAvailable}
                    onClick={() => toggle(s.slug, false)}
                    disabled={pendingSlug === s.slug}
                  >
                    <span style={pickerRowText}>
                      <span style={pickerRowLabel}>{s.label}</span>
                      <span style={pickerRowEyebrow}>{s.eyebrow}</span>
                    </span>
                    <span style={pickerAddHint}>{pendingSlug === s.slug ? "…" : "+ Add"}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div style={btnRowStyle}>
              <button type="button" onClick={onClose} style={btnPrimary}>Done</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const plusBtnStyle: CSSProperties = {
  minHeight: 28,
  minWidth: 28,
  padding: "0 8px",
  border: "1px solid rgba(128,128,128,0.7)",
  borderRadius: 8,
  color: "inherit",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 900,
  fontSize: 16,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
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

const pickerStack: CSSProperties = { display: "grid", gap: 14 };
const pickerHint: CSSProperties = { fontSize: 12, opacity: 0.65, lineHeight: 1.5, margin: 0 };
const pickerGroup: CSSProperties = { display: "grid", gap: 6 };
const pickerGroupLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.55,
};
const pickerRowAvailable: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.025)",
  color: "inherit",
  cursor: "pointer",
};
const pickerRowSelected: CSSProperties = {
  ...pickerRowAvailable,
  background: "rgba(51,255,122,0.06)",
  borderColor: "rgba(51,255,122,0.25)",
};
const pickerRowText: CSSProperties = { display: "grid", gap: 1, textAlign: "left", minWidth: 0 };
const pickerRowLabel: CSSProperties = { fontSize: 13, fontWeight: 800 };
const pickerRowEyebrow: CSSProperties = { fontSize: 10, opacity: 0.55, fontWeight: 700 };
const pickerAddHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(51,255,122,0.85)",
  whiteSpace: "nowrap",
};
const pickerRemoveHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.6,
  whiteSpace: "nowrap",
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
