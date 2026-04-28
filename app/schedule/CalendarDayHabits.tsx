"use client";

import { useState } from "react";

export type CalendarHabitItem = {
  routineName: string;
  logged: boolean;
};

export default function CalendarDayHabits({ tasks }: { tasks: CalendarHabitItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const done = tasks.filter((t) => t.logged).length;
  const total = tasks.length;

  return (
    <div>
      <button type="button" onClick={() => setExpanded((e) => !e)} style={badgeBtnStyle}>
        {done}/{total} Habits
      </button>
      {expanded && (
        <div style={expandedListStyle}>
          {tasks.map((task, i) => (
            <div key={i} style={expandedRowStyle}>
              <span
                style={{
                  display: "inline-block",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: task.logged ? "rgba(34,197,94,0.9)" : "rgba(148,163,184,0.3)",
                }}
              />
              <span style={expandedNameStyle}>{task.routineName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const badgeBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "2px 4px",
  background: "rgba(129,140,248,0.13)",
  border: "none",
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 800,
  color: "#c7d2fe",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
  appearance: "none",
  WebkitAppearance: "none",
};

const expandedListStyle: React.CSSProperties = {
  marginTop: 2,
  display: "grid",
  gap: 1,
};

const expandedRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: "1px 2px",
  lineHeight: 1,
};

const expandedNameStyle: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 700,
  lineHeight: 1,
  opacity: 0.75,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
