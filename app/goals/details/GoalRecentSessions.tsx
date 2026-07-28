"use client";

// Recent contributing sessions for the goal detail page. Each row is a
// button (not a Link) — tap opens the same LogDetailPopover the home page
// and the consistency panel use. The user explicitly said "no page
// redirect" when clicking session surfaces; the popover is the answer.

import { useState, type CSSProperties } from "react";
import { LogDetailPopover, type OpenLog } from "@/app/_home/DomainSparklines";
import type { GoalRecentItem } from "@/lib/goals";
import { toAppYmd } from "@/lib/dates";
import type { GoalTypeAccent } from "@/app/plan/goals/goal-type-accent";

// Compact "Aug 15 · 6:30 PM" formatter — drops the year for current-year
// dates (the goal detail context is "recent", year is implied), drops
// the seconds the locale default includes, and uses a middle-dot separator
// so the date+time read as a single unit instead of two stamps. Older
// dates fall back to including the year so it's still clear.
function formatRecentSessionDate(date: Date): string {
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} · ${timeLabel}`;
}

export default function GoalRecentSessions({
  items,
  accent,
  goalName,
}: {
  items: GoalRecentItem[];
  accent: GoalTypeAccent;
  goalName: string;
}) {
  const [openLog, setOpenLog] = useState<OpenLog>(null);
  if (items.length === 0) {
    return <div style={emptyTextStyle}>No logs in the current timeframe yet.</div>;
  }
  return (
    <div style={listStyle}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="goalDetailSessionCard"
          onClick={() =>
            setOpenLog({
              log: {
                logId: item.id,
                routineId: item.routineId,
                routineName: item.routineName,
                performedYmd: toAppYmd(item.performedAt),
                performedTimeLabel: item.performedAt.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              },
              accent: accent.color,
              label: goalName,
            })
          }
          style={cardStyle(accent)}
        >
          <div className="goalDetailSessionTop" style={topRowStyle}>
            <div style={textBlockStyle}>
              <div style={routineNameStyle}>{item.routineName}</div>
              <div style={dateStyle}>{formatRecentSessionDate(item.performedAt)}</div>
            </div>
            <div className="goalDetailSessionContrib" style={{ ...contribStyle, color: accent.color }}>
              {item.contributionLabel}
            </div>
          </div>
          {item.detailLines && item.detailLines.length > 0 ? (
            <div style={detailLinesStyle}>
              {item.detailLines.map((line, i) => (
                <span key={i} style={detailChipStyle}>{line}</span>
              ))}
            </div>
          ) : null}
        </button>
      ))}
      <LogDetailPopover open={openLog} onClose={() => setOpenLog(null)} />
    </div>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const emptyTextStyle: CSSProperties = {
  fontSize: 13,
  opacity: 0.7,
};

function cardStyle(accent: GoalTypeAccent): CSSProperties {
  return {
    appearance: "none",
    display: "grid",
    gap: 8,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.20)",
    borderLeft: `3px solid ${accent.border}`,
    background: "rgba(255,255,255,0.02)",
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    fontFamily: "inherit",
  };
}

const topRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
};

const textBlockStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const routineNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  lineHeight: 1.25,
  overflowWrap: "break-word",
};

const dateStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.65,
  marginTop: 2,
};

const contribStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const detailLinesStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
};

const detailChipStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  opacity: 0.88,
};
