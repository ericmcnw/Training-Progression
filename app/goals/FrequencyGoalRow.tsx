"use client";

import Link from "next/link";
import { useState } from "react";
import { GOAL_TYPE_ACCENT, GoalStatusBadge, smallActionLinkStyle } from "./ui";
import DeleteGoalButton from "./DeleteGoalButton";

export type FrequencyGoalRowData = {
  id: string;
  name: string;
  isToggleEnabled: boolean;
  isGroupFrequency: boolean;
  goalId: string;
  routineId: string | null;
  actualValue: number;
  targetValue: number;
  timeframeStatusLabel: string;
  timeframeWindowLabel: string;
  isAchieved: boolean;
  editHref: string | null;
  recentItems: Array<{
    id: string;
    routineName: string;
    date: string;
  }>;
  showRoutineNames: boolean;
};

function RowDots({
  current,
  target,
  status,
}: {
  current: number;
  target: number;
  status: string;
}) {
  const MAX_INLINE = 7;
  const filled = Math.min(current, target);
  const isAchieved = status === "Achieved" || (target > 0 && current >= target);
  const isBehind = status === "Behind";
  const dotColor = isAchieved
    ? "rgba(34,197,94,0.95)"
    : isBehind
    ? "rgba(248,113,113,0.85)"
    : "rgba(100,180,255,0.9)";

  if (target <= MAX_INLINE) {
    return (
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
        {Array.from({ length: target }, (_, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: i < filled ? dotColor : "rgba(148,163,184,0.18)",
              border: `1.5px solid ${i < filled ? dotColor : "rgba(148,163,184,0.28)"}`,
              flexShrink: 0,
            }}
          />
        ))}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            opacity: 0.65,
            marginLeft: 4,
            whiteSpace: "nowrap",
          }}
        >
          {current}/{target}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
      <div
        style={{
          width: 88,
          height: 11,
          borderRadius: 999,
          background: "rgba(148,163,184,0.15)",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${Math.min(1, target > 0 ? current / target : 0) * 100}%`,
            background: dotColor,
            borderRadius: 999,
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.65, whiteSpace: "nowrap" }}>
        {current}/{target}
      </span>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 150ms ease",
        display: "block",
        flexShrink: 0,
        opacity: 0.5,
      }}
    >
      <path
        d="M3 5l4 4 4-4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FrequencyGoalRow({
  data,
  toggleAction,
  currentGoalsHref,
}: {
  data: FrequencyGoalRowData;
  toggleAction: (formData: FormData) => Promise<void>;
  currentGoalsHref: string;
}) {
  const [open, setOpen] = useState(false);
  const accentColor = GOAL_TYPE_ACCENT.FREQUENCY;

  return (
    <div style={{ borderLeft: `3px solid ${accentColor}` }}>
      <div className="goalFreqRowBody" style={rowBodyStyle}>
        {/* Dots — inline on desktop, moves below on mobile via CSS order */}
        <div className="goalFreqDots" style={dotsWrapStyle}>
          <RowDots
            current={data.actualValue}
            target={data.targetValue}
            status={data.timeframeStatusLabel}
          />
          <span className="goalFreqDotsLabel" style={dotsLabelStyle}>
            {data.timeframeWindowLabel}
          </span>
        </div>

        {/* Expand trigger — name/subtitle/status/chevron */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="goalFreqExpandTrigger"
          style={expandTriggerStyle}
          aria-expanded={open}
        >
          <div style={{ flex: "1 1 0", minWidth: 0, textAlign: "left" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {data.name}
            </div>
            <div className="goalFreqTriggerWindow" style={{ fontSize: 11, opacity: 0.5, marginTop: 1, whiteSpace: "nowrap" }}>
              {data.timeframeWindowLabel}
            </div>
          </div>
          <span className="goalFreqStatusBadge">
            <GoalStatusBadge label={data.timeframeStatusLabel} achieved={data.isAchieved} />
          </span>
          <ChevronIcon open={open} />
        </button>

        {/* Actions — outside expand button to avoid nested interactive elements */}
        <div className="goalFreqRowActions" style={rowActionsStyle}>
          <form action={toggleAction}>
            {data.routineId ? (
              <input type="hidden" name="routineId" value={data.routineId} />
            ) : null}
            <input type="hidden" name="goalId" value={data.goalId} />
            <input type="hidden" name="enabled" value={data.isToggleEnabled ? "0" : "1"} />
            <input type="hidden" name="returnTo" value={currentGoalsHref} />
            <button
              type="submit"
              style={{
                ...smallToggleStyle,
                ...(data.isToggleEnabled ? toggleOnStyle : toggleOffStyle),
              }}
              aria-pressed={data.isToggleEnabled}
            >
              <span style={toggleLabelStyle}>
                {data.isToggleEnabled ? "On" : "Off"}
              </span>
              <span style={toggleTrackStyle}>
                <span
                  style={{
                    ...toggleThumbStyle,
                    ...(data.isToggleEnabled ? toggleThumbOnStyle : toggleThumbOffStyle),
                  }}
                />
              </span>
            </button>
          </form>
          {data.editHref ? (
            <Link href={data.editHref} style={smallActionLinkStyle}>
              Edit
            </Link>
          ) : null}
          <DeleteGoalButton goalId={data.goalId} />
        </div>
      </div>

      {open ? (
        <div style={expandedPanelStyle}>
          <div style={expandedWindowLabelStyle}>{data.timeframeWindowLabel}</div>
          {data.recentItems.length === 0 ? (
            <div style={noSessionsStyle}>No sessions logged yet</div>
          ) : (
            <div style={sessionListStyle}>
              {data.recentItems.map((item) => (
                <div key={item.id} style={sessionItemStyle}>
                  <span style={sessionDateStyle}>{item.date}</span>
                  {data.showRoutineNames ? (
                    <span style={sessionRoutineStyle}>{item.routineName}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const rowBodyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const dotsWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "10px 0 10px 14px",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const dotsLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.5,
  whiteSpace: "nowrap",
  display: "none", // hidden on desktop, shown on mobile via CSS
};

const expandTriggerStyle: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px 10px 0",
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
  textAlign: "left",
};

const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexShrink: 0,
  paddingRight: 12,
};

const expandedPanelStyle: React.CSSProperties = {
  padding: "0 14px 12px 20px",
  borderTop: "1px solid rgba(128,128,128,0.1)",
  marginTop: 0,
};

const expandedWindowLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  paddingTop: 10,
  marginBottom: 8,
};

const noSessionsStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
  fontStyle: "italic",
};

const sessionListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const sessionItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "baseline",
  fontSize: 13,
};

const sessionDateStyle: React.CSSProperties = {
  fontWeight: 700,
  opacity: 0.8,
  flexShrink: 0,
  minWidth: 52,
};

const sessionRoutineStyle: React.CSSProperties = {
  opacity: 0.6,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const smallToggleStyle: React.CSSProperties = {
  ...smallActionLinkStyle,
  cursor: "pointer",
  minWidth: 0,
  justifyContent: "space-between",
  gap: 6,
  padding: "5px 7px 5px 9px",
};

const toggleLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const toggleTrackStyle: React.CSSProperties = {
  position: "relative",
  width: 30,
  height: 18,
  borderRadius: 999,
  background: "rgba(10,14,20,0.34)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  flexShrink: 0,
};

const toggleThumbStyle: React.CSSProperties = {
  position: "absolute",
  top: 2,
  left: 2,
  width: 14,
  height: 14,
  borderRadius: 999,
  transition: "transform 140ms ease, background 140ms ease",
};

const toggleThumbOnStyle: React.CSSProperties = {
  transform: "translateX(12px)",
  background: "#54cb82",
  boxShadow: "0 0 10px rgba(84,203,130,0.45)",
};

const toggleThumbOffStyle: React.CSSProperties = {
  transform: "translateX(0)",
  background: "rgba(226,232,240,0.95)",
};

const toggleOnStyle: React.CSSProperties = {
  borderColor: "rgba(84,203,130,0.5)",
  background: "rgba(84,203,130,0.16)",
  color: "#dff7e8",
};

const toggleOffStyle: React.CSSProperties = {
  borderColor: "rgba(248,113,113,0.38)",
  background: "rgba(248,113,113,0.12)",
  color: "#ffd4d4",
};
