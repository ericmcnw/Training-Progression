"use client";

import { useLogDraft } from "@/app/contexts/LogDraftContext";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { type LogDraft, draftAgeLabel } from "@/lib/log-draft";

const KIND_COLOR: Record<LogDraft["kind"], string> = {
  WORKOUT: "#4a9eff",
  SESSION: "#a78bfa",
};

export default function ActiveSessionTray() {
  const { allDrafts, clearDraft } = useLogDraft();
  const { openDrawer } = useLogDrawer();
  if (allDrafts.length === 0) return null;

  return (
    <div className="activeTray" style={trayWrapStyle}>
      <div style={trayScrollStyle}>
        {allDrafts.map((draft) => {
          const accentColor = KIND_COLOR[draft.kind];
          return (
            <div key={draft.routineId} style={chipStyle}>
              <button
                type="button"
                style={chipBtnStyle}
                onClick={() => openDrawer(draft.routineId)}
                aria-label={`Open ${draft.routineName}`}
              >
                <span
                  style={{
                    ...chipDotStyle,
                    background: accentColor,
                    boxShadow: `0 0 7px ${accentColor}99`,
                  }}
                />
                <span style={chipNameStyle}>{draft.routineName}</span>
                <span style={chipAgeStyle}>{draftAgeLabel(draft)}</span>
              </button>
              <button
                type="button"
                style={chipCloseStyle}
                onClick={() => clearDraft(draft.routineId)}
                aria-label={`Discard ${draft.routineName} draft`}
              >
                <svg
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  width={11}
                  height={11}
                >
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const trayWrapStyle: React.CSSProperties = {
  padding: "7px 12px",
  background: "rgba(9,15,27,0.96)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

const trayScrollStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: 8,
  overflowX: "auto",
  scrollbarWidth: "none",
};

const chipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 38,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.11)",
  background: "rgba(255,255,255,0.055)",
  flexShrink: 0,
  overflow: "hidden",
};

const chipBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 9px 0 11px",
  height: "100%",
  background: "none",
  border: "none",
  borderRadius: 0,
  color: "inherit",
  cursor: "pointer",
  minHeight: 0,
};

const chipDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};

const chipNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
  color: "rgba(255,255,255,0.9)",
};

const chipAgeStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.42)",
  whiteSpace: "nowrap",
};

const chipCloseStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  minHeight: 0,
  height: "100%",
  background: "none",
  border: "none",
  borderLeft: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 0,
  color: "rgba(255,255,255,0.38)",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
  transition: "color 120ms ease",
};
