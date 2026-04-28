"use client";

import Link from "next/link";
import { useState } from "react";
import { domainColor } from "@/lib/routines";

export type HabitTaskData = {
  routineId: string;
  routineName: string;
  logged: number;
  latestLogId: string | null;
  removableManualEntryId: string | null;
  domain: string | null;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 10 10"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 130ms ease",
        flexShrink: 0,
        opacity: 0.45,
      }}
    >
      <path
        d="M2 3.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HabitsBlock({
  tasks,
  defaultExpanded,
  isToday,
  removeAction,
  timelineStart,
  selectedMonth,
}: {
  tasks: HabitTaskData[];
  defaultExpanded: boolean;
  isToday: boolean;
  removeAction: (formData: FormData) => Promise<void>;
  timelineStart: string;
  selectedMonth: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (tasks.length === 0) return null;

  const done = tasks.filter((t) => t.logged > 0).length;
  const total = tasks.length;
  const returnTo = encodeURIComponent(`/schedule?start=${timelineStart}&month=${selectedMonth}`);
  const showDots = total <= 10;

  return (
    <div className="scheduleHabitsBlock" style={blockStyle}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="scheduleHabitsHeader"
        style={headerBtnStyle}
        aria-expanded={expanded}
      >
        {showDots ? (
          <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
            {tasks.map((task) => (
              <div
                key={task.routineId}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: task.logged > 0 ? "rgba(34,197,94,0.9)" : "rgba(148,163,184,0.22)",
                  border: `1px solid ${task.logged > 0 ? "rgba(34,197,94,0.6)" : "rgba(148,163,184,0.28)"}`,
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              width: 56,
              height: 5,
              borderRadius: 999,
              background: "rgba(148,163,184,0.18)",
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
                width: `${total > 0 ? (done / total) * 100 : 0}%`,
                background: "rgba(34,197,94,0.85)",
                borderRadius: 999,
              }}
            />
          </div>
        )}
        <span style={summaryStyle}>{done}/{total} Habits</span>
        <ChevronIcon open={expanded} />
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="scheduleHabitsExpList" style={listStyle}>
          {tasks.map((task) => {
            const isLogged = task.logged > 0;
            const logHref = `/routines/${task.routineId}/log?returnTo=${returnTo}`;
            const latestLogHref = task.latestLogId
              ? `/routines/${task.routineId}/logs/${task.latestLogId}?returnTo=${returnTo}`
              : null;

            return (
              <div
                key={task.routineId}
                className="scheduleHabitsExpRow"
                style={{
                  ...rowStyle,
                  background: isLogged ? "rgba(34,197,94,0.06)" : "rgba(148,163,184,0.03)",
                  borderLeft: `2px solid ${domainColor(task.domain ?? "")}`,
                }}
              >
                <div style={{ display: "flex", gap: 5, alignItems: "center", flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isLogged ? "rgba(34,197,94,0.9)" : "rgba(148,163,184,0.22)",
                      border: `1px solid ${isLogged ? "rgba(34,197,94,0.6)" : "rgba(148,163,184,0.28)"}`,
                    }}
                  />
                  {latestLogHref ? (
                    <Link href={latestLogHref} style={nameLinkStyle}>
                      {task.routineName}
                    </Link>
                  ) : (
                    <span style={nameStyle}>{task.routineName}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                  {isToday && (
                    <Link href={logHref} style={logBtnStyle}>
                      Log
                    </Link>
                  )}
                  {task.removableManualEntryId ? (
                    <form action={removeAction} style={{ display: "contents" }}>
                      <input type="hidden" name="entryId" value={task.removableManualEntryId} />
                      <input type="hidden" name="returnStart" value={timelineStart} />
                      <input type="hidden" name="returnMonth" value={selectedMonth} />
                      <button type="submit" style={removeBtnStyle}>✕</button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const blockStyle: React.CSSProperties = {
  border: "1px solid rgba(129,140,248,0.25)",
  borderRadius: 6,
  overflow: "hidden",
  background: "rgba(129,140,248,0.04)",
};

const headerBtnStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 6px",
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
  minHeight: 0,
};

const summaryStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
  opacity: 0.6,
  letterSpacing: 0.15,
};

const listStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(129,140,248,0.15)",
  display: "grid",
  gap: 1,
  padding: "2px 5px 3px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "space-between",
  padding: "1px 4px",
  borderRadius: 4,
  lineHeight: 1,
};

const nameLinkStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 10,
  lineHeight: 1,
  color: "inherit",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const nameStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 10,
  lineHeight: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const logBtnStyle: React.CSSProperties = {
  padding: "0px 5px",
  border: "1px solid rgba(84,203,130,0.5)",
  borderRadius: 999,
  background: "rgba(84,203,130,0.12)",
  color: "rgba(84,203,130,1)",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: "12px",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const removeBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  minWidth: 0,
  padding: 0,
  border: "1px solid rgba(255,80,80,0.5)",
  borderRadius: 999,
  background: "rgba(255,80,80,0.10)",
  color: "inherit",
  fontSize: 8,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
  appearance: "none",
  WebkitAppearance: "none",
};
