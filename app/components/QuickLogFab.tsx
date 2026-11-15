"use client";

// Global floating "+" — a mini log page: search over the account's routines,
// up to three suggestions (planned today, then recent), and one chip per
// type-based log (workout, endurance, its sports, freeform activity).
// Options load on open so pages don't pay for them on every render.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { useLogDraft } from "@/app/contexts/LogDraftContext";
import { QUICK_LOG_ROUTINE_ID } from "@/app/components/LogDrawer";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";
import { domainColor } from "@/lib/routines";
import { loadQuickLogOptions, type QuickLogOptions } from "@/app/log/quick-log-actions";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import SportLogModal from "@/app/routines/SportLogModal";
import ClimbLogSheet from "@/app/routines/ClimbLogSheet";
import GolfLogSheet from "@/app/routines/GolfLogSheet";
import { GenericSportLogSheet, type SportRowData } from "@/app/routines/SportQuickLogRow";
import { ActivityLogSheet } from "@/app/routines/ActivityLogSheet";

const HIDDEN_PATH = /^\/(welcome|signin|auth|coach)(\/|$)|^\/routines\/[^/]+\/log(\/|$)/;

type Sheet = { kind: "sport"; sport: SportRowData } | { kind: "activity" } | null;

export default function QuickLogFab() {
  const pathname = usePathname();
  const { openDrawer } = useLogDrawer();
  const { allDrafts } = useLogDraft();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [options, setOptions] = useState<QuickLogOptions | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");

  if (HIDDEN_PATH.test(pathname)) return null;

  function openPicker() {
    setQuery("");
    setPickerOpen(true);
    loadQuickLogOptions()
      .then(setOptions)
      .catch(() => setOptions({ sports: [], suggestions: [], routines: [] }));
  }

  // A planned sport session points at the sport's placeholder routine, which
  // logs through its own sheet rather than the drawer.
  function pickRoutine(routineId: string) {
    setPickerOpen(false);
    const sportSlug = /^sports-(.+)-synthetic$/.exec(routineId)?.[1];
    const sport = sportSlug ? options?.sports.find((s) => s.slug === sportSlug) : undefined;
    if (sport) setSheet({ kind: "sport", sport });
    else openDrawer(routineId);
  }

  const needle = query.trim().toLowerCase();
  const matches = needle && options ? options.routines.filter((routine) => routine.name.toLowerCase().includes(needle)) : null;

  function pickSheet(next: Sheet) {
    setPickerOpen(false);
    setSheet(next);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Log something"
        onClick={openPicker}
        style={fabButton}
        className="quickLogFab"
        data-tray={allDrafts.length > 0 ? "true" : undefined}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M11 4v14M4 11h14" stroke="#0b1220" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {pickerOpen ? (
        <SportLogModal title="Log" onClose={() => setPickerOpen(false)}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your routines"
            aria-label="Search your routines"
            style={inputStyle}
          />

          {matches ? (
            <div style={group}>
              {matches.map((routine) => (
                <Row key={routine.id} label={routine.name} color={routine.color} onClick={() => pickRoutine(routine.id)} />
              ))}
              {matches.length === 0 ? <div style={loading}>No routine by that name.</div> : null}
            </div>
          ) : (
            <>
              {options === null ? <div style={loading}>Loading…</div> : null}

              {options && options.suggestions.length > 0 ? (
                <div style={group}>
                  <span style={groupLabel}>Suggested</span>
                  {options.suggestions.map((routine) => (
                    <Row key={routine.id} label={routine.name} eyebrow={routine.reason} color={routine.color} onClick={() => pickRoutine(routine.id)} />
                  ))}
                </div>
              ) : null}

              <div style={group}>
                <span style={groupLabel}>Something else</span>
                <div style={chipGrid}>
                  <Chip label="Workout" color={domainColor("strength")} onClick={() => pickRoutine(QUICK_LOG_ROUTINE_ID)} />
                  <Chip label="Endurance" color={domainColor("cardio")} onClick={() => pickRoutine(SYNTHETIC_ENDURANCE_ROUTINE_ID)} />
                  {options?.sports.map((sport) => (
                    <Chip key={sport.slug} label={sport.label} color={sport.color} onClick={() => pickSheet({ kind: "sport", sport })} />
                  ))}
                  <Chip label="Activity" color={domainColor("sport")} onClick={() => pickSheet({ kind: "activity" })} />
                </div>
              </div>
            </>
          )}

          <Link href="/log" onClick={() => setPickerOpen(false)} style={allLink}>
            Open the Log tab →
          </Link>
        </SportLogModal>
      ) : null}

      {sheet?.kind === "activity" ? <ActivityLogSheet onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === "sport" ? (
        sheet.sport.slug === "climbing" ? (
          <ClimbLogSheet onClose={() => setSheet(null)} />
        ) : sheet.sport.slug === "golf" ? (
          <GolfLogSheet onClose={() => setSheet(null)} />
        ) : (
          <GenericSportLogSheet sport={sheet.sport} onClose={() => setSheet(null)} />
        )
      ) : null}

      <style>{`
        .quickLogFab {
          position: fixed;
          right: 18px;
          bottom: 24px;
          z-index: 45;
        }
        .quickLogFab[data-tray] { bottom: 92px; }
        @media (max-width: 720px) {
          .quickLogFab {
            right: 16px;
            /* Lift above the mobile bottom nav bar (which sits ~90px + safe-area). */
            bottom: calc(104px + env(safe-area-inset-bottom, 0px));
          }
          .quickLogFab[data-tray] { bottom: calc(160px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </>
  );
}

function Row({ label, eyebrow, color, onClick }: { label: string; eyebrow?: string; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...rowStyle, borderLeft: `3px solid ${color}` }}>
      <span style={textCol}>
        <span style={rowLabel}>{label}</span>
        {eyebrow ? <span style={rowEyebrow}>{eyebrow}</span> : null}
      </span>
      <span style={rowAction}>Log →</span>
    </button>
  );
}

function Chip({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={chipStyle}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      {label}
    </button>
  );
}

const chipGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
  gap: 8,
};

const chipStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "rgba(128,128,128,0.05)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
};

const fabButton: CSSProperties = {
  width: 56,
  height: 56,
  minHeight: 56,
  padding: 0,
  borderRadius: 999,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "radial-gradient(circle at 30% 25%, #62ff97, #18d96b 60%, #0fa551)",
  color: "#0b1220",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 14px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(51,255,122,0.18)",
  transition: "transform 140ms ease, box-shadow 140ms ease",
};

const group: CSSProperties = { display: "grid", gap: 8 };

const groupLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  opacity: 0.75,
};

const loading: CSSProperties = { fontSize: 12, opacity: 0.6 };

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
  width: "100%",
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

const allLink: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(51,255,122,0.95)",
  textDecoration: "none",
};
