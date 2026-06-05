"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { addSportAction, removeSportAction } from "@/app/log/sport-actions";
import SportLogModal from "./SportLogModal";

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
        onClick={(e) => {
          // The button sits visually on top of RoutineSection's
          // collapsible header (which is itself a <button>). On mobile
          // taps were leaking through to the parent toggle — explicit
          // stopPropagation + a z-index higher than the header lock
          // the tap to this button.
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
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
  // Two-tap confirm on Available: first tap highlights the chip,
  // second tap actually adds. Stops accidental skateboarding-in-the-
  // list bugs from a casual swipe.
  const [confirmingAdd, setConfirmingAdd] = useState<string | null>(null);

  function add(slug: string) {
    setPendingSlug(slug);
    setConfirmingAdd(null);
    startTransition(async () => {
      try {
        await addSportAction(slug);
      } finally {
        setPendingSlug(null);
      }
    });
  }

  function remove(slug: string) {
    setPendingSlug(slug);
    startTransition(async () => {
      try {
        await removeSportAction(slug);
      } finally {
        setPendingSlug(null);
      }
    });
  }

  return (
    <SportLogModal
      title="Your sports"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} style={btnPrimary}>Done</button>
      }
    >
        <div>
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
                    onClick={() => remove(s.slug)}
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
                {available.map((s) => {
                  const isConfirming = confirmingAdd === s.slug;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      style={isConfirming ? pickerRowConfirm : pickerRowAvailable}
                      onClick={() => {
                        if (isConfirming) add(s.slug);
                        else setConfirmingAdd(s.slug);
                      }}
                      disabled={pendingSlug === s.slug}
                    >
                      <span style={pickerRowText}>
                        <span style={pickerRowLabel}>{s.label}</span>
                        <span style={pickerRowEyebrow}>{s.eyebrow}</span>
                      </span>
                      <span style={isConfirming ? pickerConfirmHint : pickerAddHint}>
                        {pendingSlug === s.slug ? "…" : isConfirming ? "Tap again to add" : "Add?"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
    </SportLogModal>
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
  // Ensure this paints + receives taps above RoutineSection's
  // collapsible header button which occupies the same row.
  position: "relative",
  zIndex: 2,
};

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
const pickerRowConfirm: CSSProperties = {
  ...pickerRowAvailable,
  background: "rgba(56,189,248,0.10)",
  borderColor: "rgba(56,189,248,0.5)",
};
const pickerConfirmHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(125,211,252,0.95)",
  whiteSpace: "nowrap",
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
