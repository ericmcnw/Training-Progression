"use client";

// Tick-list rows open the problem sheet rather than navigating to the crag —
// see ProblemDetailSheet for why.

import { useState } from "react";
import { relativeFromNow } from "@/lib/dates";
import ProblemDetailSheet from "./ProblemDetailSheet";

export type TickListRow = {
  id: string;
  name: string;
  grade: string;
  locationId: string | null;
  location: { name: string } | null;
  sessionCount: number;
  tries: number;
  lastAttempt: Date | null;
  sent: boolean;
};

export default function TickList({ rows, done }: { rows: TickListRow[]; done: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={trackStyle} aria-hidden>
        <div style={{ ...fillStyle, width: `${Math.round((done / rows.length) * 100)}%` }} />
      </div>
      {rows.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setOpenId(p.id)}
          style={p.sent ? rowSentStyle : rowStyle}
        >
          <span style={{ fontSize: 15, lineHeight: 1, color: p.sent ? "#4ade80" : "#fbbf24" }}>
            {p.sent ? "✓" : "★"}
          </span>
          <span style={{ display: "grid", gap: 3, minWidth: 0, flex: 1, textAlign: "left" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                opacity: p.sent ? 0.7 : 1,
              }}
            >
              <span style={{ color: ACCENT_TEXT, marginRight: 6 }}>{p.grade}</span>
              {p.name}
            </span>
            <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
              {p.location?.name ?? "No location"}
              {p.tries > 0
                ? ` · ${p.tries} ${p.tries === 1 ? "try" : "tries"} over ${p.sessionCount} session${p.sessionCount === 1 ? "" : "s"}`
                : " · not yet attempted"}
              {p.lastAttempt ? ` · last ${relativeFromNow(p.lastAttempt)}` : ""}
            </span>
          </span>
        </button>
      ))}

      {open ? (
        <ProblemDetailSheet
          problemId={open.id}
          name={open.name}
          grade={open.grade}
          locationId={open.locationId}
          locationName={open.location?.name ?? null}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

const ACCENT_TEXT = "rgba(253,186,116,0.95)";

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(251,191,36,0.3)",
  background: "rgba(251,191,36,0.07)",
  color: "inherit",
  minHeight: 44,
  width: "100%",
  cursor: "pointer",
  touchAction: "manipulation",
};

const rowSentStyle: React.CSSProperties = {
  ...rowStyle,
  border: "1px solid rgba(74,222,128,0.28)",
  background: "rgba(74,222,128,0.06)",
};

const trackStyle: React.CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const fillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#4ade80",
};
