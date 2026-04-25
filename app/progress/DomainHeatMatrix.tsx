"use client";

import type React from "react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { domainColor } from "@/lib/routines";
import type { RoutineDomain } from "@/lib/routines";

export type DomainWeekLog = {
  routineId: string;
  routineName: string;
  performedAtLabel: string;
};

export type DomainWeekCell = {
  domain: RoutineDomain;
  label: string;
  weeks: number[];
  weekLogs: DomainWeekLog[][];
};

type ActiveCell = { domain: RoutineDomain; weekIdx: number };

const domainAccent = domainColor;

function groupLogs(logs: DomainWeekLog[]) {
  const grouped = new Map<string, { routineId: string; routineName: string; dates: string[] }>();
  for (const log of logs) {
    const entry = grouped.get(log.routineId) ?? { routineId: log.routineId, routineName: log.routineName, dates: [] };
    entry.dates.push(log.performedAtLabel);
    grouped.set(log.routineId, entry);
  }
  return Array.from(grouped.values())
    .map((entry) => ({ ...entry, dates: [...entry.dates].sort((a, b) => b.localeCompare(a)) }))
    .sort((a, b) => b.dates.length - a.dates.length || a.routineName.localeCompare(b.routineName));
}

function DetailPanel({
  domain,
  domainLabel,
  weekLabel,
  logs,
  onClose,
}: {
  domain: RoutineDomain;
  domainLabel: string;
  weekLabel: string;
  logs: DomainWeekLog[];
  onClose: () => void;
}) {
  const accent = domainAccent(domain);
  const grouped = groupLogs(logs);

  return (
    <div style={{ ...panelStyle, borderColor: accent.replace("0.9", "0.28") }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: accent, flexShrink: 0 }} />
          <span style={{ fontWeight: 900, fontSize: 13 }}>{domainLabel}</span>
          <span style={{ opacity: 0.35, fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 700 }}>week of {weekLabel}</span>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 999,
            background: accent.replace("0.9", "0.14"),
            border: `1px solid ${accent.replace("0.9", "0.3")}`,
          }}>
            {logs.length} {logs.length === 1 ? "session" : "sessions"}
          </span>
        </div>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>

      <div style={{ display: "grid", gap: 5 }}>
        {grouped.map((entry) => (
          <div key={entry.routineId} style={routineRowStyle}>
            <Link
              href={`/progress/routines/${entry.routineId}?tab=overview&range=4w`}
              style={routineLinkStyle}
            >
              {entry.routineName}
              {entry.dates.length > 1 ? (
                <span style={{ fontWeight: 700, opacity: 0.5, marginLeft: 5 }}>×{entry.dates.length}</span>
              ) : null}
            </Link>
            <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, flexShrink: 0 }}>
              {entry.dates.slice(0, 3).join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DomainHeatMatrix({
  rows,
  weekLabels,
}: {
  rows: DomainWeekCell[];
  weekLabels: string[];
}) {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const maxSessions = Math.max(1, ...rows.flatMap((r) => r.weeks));

  function cellFill(count: number, isActive: boolean, domain: RoutineDomain): string {
    const base = domainAccent(domain);
    if (isActive) return base.replace("0.9", "0.28");
    if (count === 0) return "rgba(255,255,255,0.04)";
    const intensity = Math.min(1, count / Math.max(3, maxSessions));
    return base.replace("0.9", String((0.12 + intensity * 0.60).toFixed(2)));
  }

  function cellBorder(count: number, isActive: boolean, domain: RoutineDomain): string {
    const base = domainAccent(domain);
    if (isActive) return base.replace("0.9", "0.65");
    if (count === 0) return "rgba(255,255,255,0.06)";
    return base.replace("0.9", String((0.15 + Math.min(0.5, (count / Math.max(3, maxSessions)) * 0.5)).toFixed(2)));
  }

  if (rows.length === 0) {
    return <div style={{ fontSize: 13, opacity: 0.55 }}>No training logged in this period.</div>;
  }

  const numCols = weekLabels.length;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `140px repeat(${numCols}, minmax(56px, 1fr))`,
          gap: 4,
          minWidth: 0,
        }}
      >
        {/* Header row */}
        <div />
        {weekLabels.map((label) => {
          const dashIdx = label.indexOf("–");
          const line1 = dashIdx >= 0 ? label.slice(0, dashIdx) : label;
          const line2 = dashIdx >= 0 ? label.slice(dashIdx + 1) : null;
          return (
            <div
              key={label}
              style={{ fontSize: 10, fontWeight: 800, opacity: 0.5, textAlign: "center", paddingBottom: 4, lineHeight: 1.4 }}
            >
              <div>{line1}</div>
              {line2 ? <div>{line2}</div> : null}
            </div>
          );
        })}

        {/* Domain rows */}
        {rows.map((row) => {
          const isRowActive = activeCell?.domain === row.domain;

          return (
            <Fragment key={row.domain}>
              {/* Domain label — links to routine index filtered by domain */}
              <Link
                href={`?tab=routines&domain=${row.domain}`}
                scroll={false}
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  paddingRight: 8,
                  textDecoration: "none",
                  color: "inherit",
                  opacity: 0.9,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: domainAccent(row.domain),
                    marginRight: 7,
                    flexShrink: 0,
                  }}
                />
                {row.label}
              </Link>

              {/* Week cells */}
              {row.weeks.map((count, wi) => {
                const isActive = isRowActive && activeCell?.weekIdx === wi;

                if (count > 0) {
                  return (
                    <button
                      key={`cell-${row.domain}-${wi}`}
                      type="button"
                      onClick={() =>
                        setActiveCell(isActive ? null : { domain: row.domain, weekIdx: wi })
                      }
                      style={{
                        height: 36,
                        borderRadius: 8,
                        background: cellFill(count, isActive, row.domain),
                        border: `1px solid ${cellBorder(count, isActive, row.domain)}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                        color: "rgba(255,255,255,0.92)",
                        cursor: "pointer",
                        padding: 0,
                        boxShadow: isActive ? `0 0 0 2px ${domainAccent(row.domain).replace("0.9", "0.16")}` : "none",
                        transition: "background 0.1s, border-color 0.1s, box-shadow 0.1s",
                      }}
                      aria-label={`${row.label}: ${count} session${count !== 1 ? "s" : ""} in week of ${weekLabels[wi]} — click to view details`}
                      aria-pressed={isActive}
                    >
                      {count}
                    </button>
                  );
                }

                return (
                  <div
                    key={`cell-${row.domain}-${wi}`}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      background: cellFill(0, false, row.domain),
                      border: `1px solid ${cellBorder(0, false, row.domain)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      opacity: 0.5,
                      color: "rgba(255,255,255,0.25)",
                    }}
                  >
                    ·
                  </div>
                );
              })}

              {/* Detail panel — spans all columns below this row when a cell is active */}
              {isRowActive && activeCell ? (
                <div style={{ gridColumn: `1 / ${numCols + 2}` }}>
                  <DetailPanel
                    domain={row.domain}
                    domainLabel={row.label}
                    weekLabel={weekLabels[activeCell.weekIdx]}
                    logs={row.weekLogs[activeCell.weekIdx] ?? []}
                    onClose={() => setActiveCell(null)}
                  />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  margin: "2px 0 4px",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid",
  background: "rgba(84,203,130,0.04)",
  display: "grid",
  gap: 10,
};

const closeBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};

const routineRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  padding: "5px 6px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  minWidth: 0,
};

const routineLinkStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "inherit",
  textDecoration: "none",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flexShrink: 1,
};
