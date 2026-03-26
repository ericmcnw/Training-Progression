"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RoutineKind } from "@/generated/prisma";
import type { CoverageCategoryRow, CoverageDetailLog } from "./coverage";

type LegendItem = {
  kind: RoutineKind;
  label: string;
  color: string;
};

type ActiveBar = {
  categoryId: string;
  routineKind: RoutineKind;
};

function barKey(categoryId: string, routineKind: RoutineKind) {
  return `${categoryId}:${routineKind}`;
}

function groupDetails(logs: CoverageDetailLog[]) {
  const grouped = new Map<
    string,
    { routineName: string; routineKind: RoutineKind; dates: string[]; relevantParts: string[] }
  >();

  for (const log of logs) {
    const current = grouped.get(log.routineId) ?? {
      routineName: log.routineName,
      routineKind: log.routineKind,
      dates: [],
      relevantParts: [],
    };
    current.dates.push(log.performedAtLabel);
    current.relevantParts.push(...log.relevantParts);
    grouped.set(log.routineId, current);
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      dates: [...entry.dates].sort((left, right) => right.localeCompare(left)),
      relevantParts: Array.from(new Set(entry.relevantParts)).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => right.dates.length - left.dates.length || left.routineName.localeCompare(right.routineName));
}

export default function CoverageGroupedBarChart({
  categories,
  legend,
  rangeLabel,
  emptyMessage,
}: {
  categories: CoverageCategoryRow[];
  legend: LegendItem[];
  rangeLabel: string;
  emptyMessage: string;
}) {
  const [hoveredBar, setHoveredBar] = useState<ActiveBar | null>(null);
  const [activeBar, setActiveBar] = useState<ActiveBar | null>(null);

  const maxCount = Math.max(
    1,
    ...categories.flatMap((category) => legend.map((item) => category.countsByKind[item.kind]))
  );

  const focusedBar = activeBar ?? hoveredBar;
  const focusedDetails = useMemo(() => {
    if (!focusedBar) return null;
    const category = categories.find((entry) => entry.id === focusedBar.categoryId);
    if (!category) return null;
    const logs = category.contributingLogsByKind[focusedBar.routineKind];
    return {
      category,
      routineKind: focusedBar.routineKind,
      logs,
      groupedLogs: groupDetails(logs),
    };
  }, [categories, focusedBar]);

  if (categories.length === 0) {
    return <div style={emptyStateStyle}>{emptyMessage}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={legendRowStyle}>
        {legend.map((item) => (
          <span key={item.kind} style={legendChipStyle}>
            <span style={{ ...legendDotStyle, background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div style={helperStyle}>Bars show how many completed logs in {rangeLabel.toLowerCase()} contributed to each category.</div>

      <div style={{ display: "grid", gap: 12 }}>
        {categories.map((category) => (
          <div key={category.id} style={categoryRowStyle}>
            <div style={categoryLabelColumnStyle}>
              <Link href={category.targetHref} style={categoryLinkStyle}>
                {category.label}
              </Link>
              <div style={categoryMetaStyle}>{category.totalCount} total</div>
            </div>

            <div style={barsColumnStyle}>
              {legend.map((item) => {
                const count = category.countsByKind[item.kind];
                const isInteractive = count > 0;
                const isFocused = focusedBar
                  ? focusedBar.categoryId === category.id && focusedBar.routineKind === item.kind
                  : false;

                return (
                  <button
                    key={barKey(category.id, item.kind)}
                    type="button"
                    disabled={!isInteractive}
                    style={{
                      ...barButtonStyle,
                      ...(isInteractive ? interactiveBarButtonStyle : inactiveBarButtonStyle),
                      ...(isFocused ? focusedBarButtonStyle : {}),
                    }}
                    onMouseEnter={() => {
                      if (activeBar === null && isInteractive) setHoveredBar({ categoryId: category.id, routineKind: item.kind });
                    }}
                    onMouseLeave={() => {
                      if (activeBar === null) setHoveredBar(null);
                    }}
                    onClick={() => {
                      if (!isInteractive) return;
                      setActiveBar((current) =>
                        current && current.categoryId === category.id && current.routineKind === item.kind
                          ? null
                          : { categoryId: category.id, routineKind: item.kind }
                      );
                    }}
                    aria-label={`${category.label}, ${item.label}, ${count} completed logs`}
                  >
                    <span style={barTrackStyle}>
                      <span
                        style={{
                          ...barFillStyle,
                          background: item.color,
                          width: count > 0 ? `${Math.max(8, (count / maxCount) * 100)}%` : "0%",
                        }}
                      />
                    </span>
                    <span style={barCountStyle}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={detailPanelStyle}>
        {focusedDetails ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{focusedDetails.category.label}</div>
              <span style={legendChipStyle}>
                <span
                  style={{
                    ...legendDotStyle,
                    background: legend.find((item) => item.kind === focusedDetails.routineKind)?.color ?? "rgba(255,255,255,0.8)",
                  }}
                />
                {focusedDetails.routineKind}
              </span>
              <span style={detailCountChipStyle}>{focusedDetails.logs.length} logs</span>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {focusedDetails.groupedLogs.slice(0, 8).map((entry) => (
                <div key={`${entry.routineName}-${entry.dates.join(",")}`} style={detailRowStyle}>
                  <div style={{ fontWeight: 800 }}>
                    {entry.routineName}
                    {entry.dates.length > 1 ? ` x${entry.dates.length}` : ""}
                  </div>
                  <div style={detailDatesStyle}>{entry.dates.join(", ")}</div>
                  {entry.relevantParts.length > 0 ? <div style={detailPartsStyle}>{entry.relevantParts.join(" | ")}</div> : null}
                </div>
              ))}
            </div>

            {focusedDetails.groupedLogs.length > 8 ? (
              <div style={helperStyle}>Showing 8 routines. Narrow the window or open the target page for the full log history.</div>
            ) : null}
          </div>
        ) : (
          <div style={helperStyle}>Hover a bar on desktop or tap one on mobile to inspect the contributing routines, completion dates, and matching exercises or guided steps.</div>
        )}
      </div>
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = {
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.03)",
  fontSize: 13,
  opacity: 0.82,
};

const helperStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.74,
};

const legendRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const legendChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  fontSize: 12,
  fontWeight: 800,
};

const legendDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  display: "inline-block",
};

const categoryRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(120px, 180px) minmax(0, 1fr)",
  alignItems: "start",
};

const categoryLabelColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const categoryLinkStyle: React.CSSProperties = {
  color: "inherit",
  fontWeight: 900,
  textDecoration: "none",
};

const categoryMetaStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
};

const barsColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const barButtonStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 32px",
  gap: 8,
  alignItems: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  textAlign: "left",
};

const interactiveBarButtonStyle: React.CSSProperties = {
  cursor: "pointer",
};

const inactiveBarButtonStyle: React.CSSProperties = {
  cursor: "default",
};

const focusedBarButtonStyle: React.CSSProperties = {
  filter: "brightness(1.08)",
};

const barTrackStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 16,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const barFillStyle: React.CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: 999,
};

const barCountStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.9,
  textAlign: "right",
};

const detailPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
};

const detailCountChipStyle: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  fontSize: 12,
  fontWeight: 800,
};

const detailRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
};

const detailDatesStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.76,
};

const detailPartsStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.9,
};
