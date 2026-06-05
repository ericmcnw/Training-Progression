"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { addSportAction, logSportAction, removeSportAction } from "./sport-actions";

// Single client component that owns:
//   • The tile grid (one per selected sport, plus an "Add" tile)
//   • An overlay sheet for logging against a selected sport
//   • An overlay sheet for adding/removing sports
//
// All visual styles match the dark-panel language used elsewhere
// (cardSurface, chips, etc.) so the section reads as part of /log,
// not a separate widget.

type SelectedSport = {
  slug: string;
  label: string;
  eyebrow: string;
  color: string;
};

type AvailableSport = {
  slug: string;
  label: string;
  eyebrow: string;
};

type SheetState =
  | { kind: "closed" }
  | { kind: "log"; sport: SelectedSport }
  | { kind: "picker" };

export default function SportsLogSectionClient({
  selected,
  available,
}: {
  selected: SelectedSport[];
  available: AvailableSport[];
}) {
  const [sheet, setSheet] = useState<SheetState>({ kind: "closed" });

  return (
    <section style={sectionStyle} aria-label="Sports">
      <header style={headerStyle}>
        <div style={titleColStyle}>
          <span style={eyebrowStyle}>Log</span>
          <h2 style={titleStyle}>Sports</h2>
        </div>
        <button
          type="button"
          style={addBtnStyle}
          onClick={() => setSheet({ kind: "picker" })}
        >
          + Add sport
        </button>
      </header>

      {selected.length === 0 ? (
        <button
          type="button"
          style={emptyStateBtn}
          onClick={() => setSheet({ kind: "picker" })}
        >
          <span style={emptyTitle}>Pick the sports you do</span>
          <span style={emptySub}>
            Climbing, surfing, snowboarding, basketball, golf… anything you want quick-log access to.
          </span>
        </button>
      ) : (
        <div style={tileGridStyle}>
          {selected.map((sport) => (
            <button
              key={sport.slug}
              type="button"
              style={{ ...tileStyle, background: sport.color }}
              onClick={() => setSheet({ kind: "log", sport })}
            >
              <span style={tileEyebrow}>{sport.eyebrow}</span>
              <span style={tileLabel}>{sport.label}</span>
              <span style={tileHint}>tap to log</span>
            </button>
          ))}
        </div>
      )}

      {sheet.kind === "log" ? (
        <LogSheet sport={sheet.sport} onClose={() => setSheet({ kind: "closed" })} />
      ) : null}

      {sheet.kind === "picker" ? (
        <PickerSheet
          available={available}
          selected={selected}
          onClose={() => setSheet({ kind: "closed" })}
        />
      ) : null}
    </section>
  );
}

// ─── Log sheet ──────────────────────────────────────────────────────────────

function LogSheet({ sport, onClose }: { sport: SelectedSport; onClose: () => void }) {
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
    <Sheet onClose={onClose} title={`Log ${sport.label}`}>
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
    </Sheet>
  );
}

// ─── Add / remove picker ────────────────────────────────────────────────────

function PickerSheet({
  available,
  selected,
  onClose,
}: {
  available: AvailableSport[];
  selected: SelectedSport[];
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
    <Sheet onClose={onClose} title="Your sports">
      <div style={pickerStack}>
        <p style={pickerHint}>
          Sports you’ve added show up as tiles on the log page for quick session logging.
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
          <button type="button" onClick={onClose} style={btnPrimary}>
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Sheet primitive ────────────────────────────────────────────────────────

function Sheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div style={sheetOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div style={sheetPanel} onClick={(e) => e.stopPropagation()}>
        <header style={sheetHeader}>
          <h3 style={sheetTitle}>{title}</h3>
          <button type="button" onClick={onClose} style={sheetCloseBtn} aria-label="Close">
            ✕
          </button>
        </header>
        <div style={sheetBody}>{children}</div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Formats a Date as the value an <input type="datetime-local"> expects:
// YYYY-MM-DDTHH:mm in local time (NOT UTC). The native input ignores
// timezone offsets, so we have to hand it local components.
function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "14px 14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 10,
  minWidth: 0,
};

const titleColStyle: CSSProperties = { display: "grid", gap: 1, minWidth: 0 };

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.5,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: -0.2,
};

const addBtnStyle: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const emptyStateBtn: CSSProperties = {
  display: "grid",
  gap: 4,
  textAlign: "left",
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.025)",
  color: "inherit",
  cursor: "pointer",
};
const emptyTitle: CSSProperties = { fontSize: 14, fontWeight: 900 };
const emptySub: CSSProperties = { fontSize: 12, opacity: 0.65, lineHeight: 1.4 };

const tileGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 8,
};

const tileStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  textAlign: "left",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  color: "inherit",
  cursor: "pointer",
  minHeight: 76,
  transition: "transform 80ms ease",
};

const tileEyebrow: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.65,
};
const tileLabel: CSSProperties = { fontSize: 15, fontWeight: 900, letterSpacing: -0.2 };
const tileHint: CSSProperties = { fontSize: 10, fontWeight: 700, opacity: 0.55, marginTop: 2 };

// Sheet overlay — full-screen scrim with a centered panel on desktop
// and a bottom sheet feel on mobile (caps height, hugs the bottom).
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
