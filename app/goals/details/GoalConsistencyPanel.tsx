"use client";

// Interactive wrapper around FrequencyHeatmap + WeeklyFrequencyBars for
// the goal detail page. Owns the LogDetailPopover state so a click on a
// done/covered day (heatmap) or a date pill in a week expansion (bars)
// opens the same popover the home page uses.
//
// Server-side parent fetches `contributingLogs` from getFrequencyConsistency
// and passes them here; we slice them into per-day / per-week buckets at
// render time. Cheap (just an array walk) and keeps the server payload
// flat.

import { useMemo, useState, type CSSProperties } from "react";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import { LogDetailPopover, type OpenLog } from "@/app/_home/DomainSparklines";
import FrequencyHeatmap from "@/app/components/dashboard/FrequencyHeatmap";
import WeeklyFrequencyBars from "@/app/components/dashboard/WeeklyFrequencyBars";
import { getFrequencyRenderMode, type FrequencyState, type FrequencyTarget } from "@/lib/frequency-state";
import type { FrequencyContributionLog } from "@/lib/frequency-consistency";

export default function GoalConsistencyPanel({
  target,
  state,
  today,
  weekdayMask,
  weeks,
  accentColor,
  accentBorderColor,
  retroactiveLogRoutineId,
  contributingLogs,
  goalName,
}: {
  target: FrequencyTarget;
  state: FrequencyState;
  today: string;
  weekdayMask: number | null;
  weeks: number;
  accentColor: string;
  accentBorderColor: string;
  retroactiveLogRoutineId?: string;
  contributingLogs: FrequencyContributionLog[];
  goalName: string;
}) {
  const [openLog, setOpenLog] = useState<OpenLog>(null);
  const [openDayYmd, setOpenDayYmd] = useState<string | null>(null);
  const mode = getFrequencyRenderMode(target);

  // Per-day log index — used by the heatmap cell click handler.
  const logsByDay = useMemo(() => {
    const map = new Map<string, FrequencyContributionLog[]>();
    for (const log of contributingLogs) {
      const list = map.get(log.performedYmd);
      if (list) list.push(log);
      else map.set(log.performedYmd, [log]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.performedYmd.localeCompare(a.performedYmd) || b.performedTimeLabel.localeCompare(a.performedTimeLabel));
    }
    return map;
  }, [contributingLogs]);

  // 7-day buckets for WeeklyFrequencyBars (Sunday-anchored, oldest → newest).
  const weeklyContributions = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00.000Z`);
    const todayDow = todayDate.getUTCDay();
    const currentWeekStart = addDaysYmd(today, -todayDow);
    const firstWeekStart = addDaysYmd(currentWeekStart, -(weeks - 1) * 7);
    const buckets: Array<{
      weekStartYmd: string;
      weekEndYmd: string;
      logs: FrequencyContributionLog[];
    }> = [];
    for (let w = 0; w < weeks; w++) {
      const weekStartYmd = addDaysYmd(firstWeekStart, w * 7);
      const weekEndYmd = addDaysYmd(weekStartYmd, 6);
      const logs = contributingLogs
        .filter((log) => log.performedYmd >= weekStartYmd && log.performedYmd <= weekEndYmd)
        .sort((a, b) => a.performedYmd.localeCompare(b.performedYmd));
      buckets.push({ weekStartYmd, weekEndYmd, logs });
    }
    return buckets;
  }, [contributingLogs, today, weeks]);

  const onLogClick = (log: FrequencyContributionLog) => {
    setOpenLog({
      log: {
        logId: log.logId,
        routineId: log.routineId,
        routineName: log.routineName,
        performedYmd: log.performedYmd,
        performedTimeLabel: log.performedTimeLabel,
      },
      accent: accentColor,
      label: goalName,
    });
  };

  const openDayLogs = openDayYmd ? logsByDay.get(openDayYmd) ?? [] : [];

  return (
    <div style={shellStyle}>
      {mode === "daily-grid" ? (
        <FrequencyHeatmap
          target={target}
          state={state}
          today={today}
          weekdayMask={weekdayMask}
          weeks={weeks}
          accentColor={accentColor}
          accentBorderColor={accentBorderColor}
          retroactiveLogRoutineId={retroactiveLogRoutineId}
          logsByDay={logsByDay}
          onDayClick={(ymd) => setOpenDayYmd((prev) => (prev === ymd ? null : ymd))}
          openDayYmd={openDayYmd}
        />
      ) : (
        <WeeklyFrequencyBars
          target={target}
          state={state}
          today={today}
          weeks={weeks}
          weeklyContributions={weeklyContributions}
          onLogClick={onLogClick}
          compact
        />
      )}

      {openDayYmd && openDayLogs.length > 0 ? (
        <DayContributionsPanel
          ymd={openDayYmd}
          logs={openDayLogs}
          accentColor={accentColor}
          accentBorderColor={accentBorderColor}
          onClose={() => setOpenDayYmd(null)}
          onLogClick={onLogClick}
        />
      ) : null}

      <LogDetailPopover open={openLog} onClose={() => setOpenLog(null)} />
    </div>
  );
}

// ── Day expansion (heatmap mode) ──────────────────────────────────────────

function DayContributionsPanel({
  ymd,
  logs,
  accentColor,
  accentBorderColor,
  onClose,
  onLogClick,
}: {
  ymd: string;
  logs: FrequencyContributionLog[];
  accentColor: string;
  accentBorderColor: string;
  onClose: () => void;
  onLogClick: (log: FrequencyContributionLog) => void;
}) {
  const dateLabel = formatUtcDateLabel(ymd, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <div style={{ ...dayPanelStyle, borderColor: accentBorderColor }}>
      <div style={dayPanelHeaderStyle}>
        <span style={{ ...dayPanelDotStyle, background: accentColor }} aria-hidden />
        <span style={dayPanelLabelStyle}>{dateLabel}</span>
        <span style={dayPanelCountStyle}>
          {logs.length} {logs.length === 1 ? "session" : "sessions"}
        </span>
        <button type="button" onClick={onClose} style={dayPanelCloseStyle} aria-label="Close day detail">
          ×
        </button>
      </div>
      <div style={dayPillRowStyle}>
        {logs.map((log) => (
          <button
            key={log.logId}
            type="button"
            onClick={() => onLogClick(log)}
            style={{ ...dayPillStyle, borderColor: accentBorderColor }}
          >
            <span style={dayPillNameStyle}>{log.routineName}</span>
            <span style={dayPillTimeStyle}>{log.performedTimeLabel}</span>
            {!log.isPrimary ? <span style={dayPillSubStyle}>substitute</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const dayPanelStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid",
  background: "rgba(255,255,255,0.025)",
  padding: "10px 12px",
  display: "grid",
  gap: 8,
};

const dayPanelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const dayPanelDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const dayPanelLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.3,
};

const dayPanelCountStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.6,
  marginLeft: "auto",
};

const dayPanelCloseStyle: CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "inherit",
  borderRadius: 999,
  width: 24,
  height: 24,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const dayPillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const dayPillStyle: CSSProperties = {
  appearance: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid",
  color: "inherit",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 36,
};

const dayPillNameStyle: CSSProperties = {
  fontWeight: 800,
};

const dayPillTimeStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
};

const dayPillSubStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  opacity: 0.6,
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
};
