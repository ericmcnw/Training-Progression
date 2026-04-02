"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { RoutineKind } from "@/generated/prisma";
import type { CoverageCategoryRow, CoverageDetailLog } from "./coverage";

type LegendItem = {
  kind: RoutineKind;
  label: string;
  color: string;
};

type ActiveCell = {
  categoryId: string;
  routineKind: RoutineKind;
};

function withAlpha(color: string, alpha: number) {
  return color.replace(/[\d.]+\)$/, `${alpha})`);
}

function kindAbbr(kind: RoutineKind): string {
  switch (kind) {
    case "WORKOUT": return "WO";
    case "CARDIO": return "CA";
    case "GUIDED": return "GU";
    case "SESSION": return "SE";
    case "COMPLETION": return "CO";
  }
}

function statusBorderColor(totalCount: number, rangeLabel: string): string {
  if (totalCount === 0) return "transparent";
  if (rangeLabel === "This Week" && totalCount <= 1) return "rgba(255,196,107,0.5)";
  if (rangeLabel === "Last 4 Weeks" && totalCount <= 2) return "rgba(255,196,107,0.5)";
  return "rgba(84,203,130,0.45)";
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
      dates: [...entry.dates].sort((a, b) => b.localeCompare(a)),
      relevantParts: Array.from(new Set(entry.relevantParts)).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.dates.length - a.dates.length || a.routineName.localeCompare(b.routineName));
}

type GroupedLog = ReturnType<typeof groupDetails>[number];

function DetailPanel({
  details,
  onClose,
}: {
  details: {
    kindLabel: string;
    kindColor: string;
    category: CoverageCategoryRow;
    logs: CoverageDetailLog[];
    groupedLogs: GroupedLog[];
  };
  onClose: () => void;
}) {
  const hasExercises = details.groupedLogs.some((entry) => entry.relevantParts.length > 0);

  return (
    <div style={detailPanelStyle}>
      <div style={detailHeaderStyle}>
        <div style={detailHeaderLeftStyle}>
          <span style={{ ...dotStyle, background: details.kindColor }} />
          <span style={detailKindStyle}>{details.kindLabel}</span>
          <span style={detailSepStyle}>·</span>
          <Link href={details.category.targetHref} style={detailCategoryLinkStyle}>
            {details.category.label}
          </Link>
          <span style={detailCountBadgeStyle}>
            {details.logs.length} {details.logs.length === 1 ? "session" : "sessions"}
          </span>
        </div>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close detail">
          ✕
        </button>
      </div>

      <div style={detailListStyle}>
        {details.groupedLogs.slice(0, 6).map((entry) => (
          <div key={`${entry.routineName}-${entry.dates[0] ?? ""}`} style={detailRowStyle}>
            <div style={detailRowTopStyle}>
              <span style={routineNameStyle}>
                {entry.routineName}
                {entry.dates.length > 1 ? (
                  <span style={routineRepeatStyle}> ×{entry.dates.length}</span>
                ) : null}
              </span>
              <span style={datesStyle}>{entry.dates.slice(0, 3).join(", ")}</span>
            </div>
            {entry.relevantParts.length > 0 ? (
              <div style={partsStyle}>{entry.relevantParts.join("  ·  ")}</div>
            ) : null}
          </div>
        ))}
        {details.groupedLogs.length > 6 ? (
          <div style={detailMoreStyle}>+{details.groupedLogs.length - 6} more routines</div>
        ) : null}
      </div>

      {hasExercises ? (
        <div style={detailHintStyle}>Exercises shown are the ones that contributed to this group.</div>
      ) : null}
    </div>
  );
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
  const [hoveredCell, setHoveredCell] = useState<ActiveCell | null>(null);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const compact = useSyncExternalStore(subscribeToCompactMediaQuery, getCompactSnapshot, () => false);

  // Hover only shows preview when no cell is locked active
  const focusedCell = activeCell ?? hoveredCell;

  const focusedDetails = useMemo(() => {
    if (!focusedCell) return null;
    const category = categories.find((c) => c.id === focusedCell.categoryId);
    if (!category) return null;
    const logs = category.contributingLogsByKind[focusedCell.routineKind];
    const legendItem = legend.find((l) => l.kind === focusedCell.routineKind);
    return {
      category,
      routineKind: focusedCell.routineKind,
      kindLabel: legendItem?.label ?? focusedCell.routineKind,
      kindColor: legendItem?.color ?? "rgba(255,255,255,0.8)",
      logs,
      groupedLogs: groupDetails(logs),
    };
  }, [categories, focusedCell, legend]);

  const totalByKind = useMemo(() => {
    const totals = new Map<RoutineKind, number>();
    for (const cat of categories) {
      for (const item of legend) {
        totals.set(item.kind, (totals.get(item.kind) ?? 0) + (cat.countsByKind[item.kind] ?? 0));
      }
    }
    return totals;
  }, [categories, legend]);

  if (categories.length === 0) {
    return <div style={emptyStateStyle}>{emptyMessage}</div>;
  }

  const kindColWidth = compact ? 40 : 52;
  const labelMinWidth = compact ? 80 : 100;
  const btnSize = compact ? 32 : 38;
  const colTemplate = `minmax(${labelMinWidth}px, 1fr) repeat(${legend.length}, ${kindColWidth}px)`;
  const minInnerWidth = labelMinWidth + legend.length * kindColWidth;

  return (
    <div style={outerScrollStyle}>
      <div style={{ minWidth: minInnerWidth }}>

        {/* Column headers — dot + abbreviation + total count */}
        <div style={{ display: "grid", gridTemplateColumns: colTemplate, marginBottom: 4, paddingInline: "10px 6px" }}>
          <div /> {/* empty corner */}
          {legend.map((item) => (
            <div key={item.kind} style={kindHeaderStyle} title={item.label}>
              <span style={{ ...dotStyle, background: item.color }} />
              <span style={kindAbbrStyle}>{kindAbbr(item.kind)}</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: item.color, lineHeight: 1, opacity: 0.9 }}>
                {totalByKind.get(item.kind) ?? 0}
              </span>
            </div>
          ))}
        </div>

        {/* Category rows */}
        <div style={{ display: "grid", gap: 2, marginTop: 8 }}>
          {categories.map((category) => {
            const border = statusBorderColor(category.totalCount, rangeLabel);
            const isRowFocused = focusedCell?.categoryId === category.id;
            const isRowActive = activeCell?.categoryId === category.id;

            return (
              <div key={category.id}>
                {/* Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: colTemplate,
                    alignItems: "stretch",
                    minHeight: 48,
                    borderRadius: 10,
                    borderLeft: `3px solid ${border}`,
                    background: isRowFocused
                      ? "rgba(120,190,255,0.07)"
                      : "rgba(255,255,255,0.028)",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Label column */}
                  <div style={labelColStyle}>
                    <Link href={category.targetHref} style={categoryLinkStyle}>
                      {category.label}
                    </Link>
                    {category.totalCount > 0 ? (
                      <span style={rowTotalStyle}>{category.totalCount}</span>
                    ) : null}
                  </div>

                  {/* Kind count cells */}
                  {legend.map((item) => {
                    const count = category.countsByKind[item.kind];
                    const isActive =
                      activeCell?.categoryId === category.id &&
                      activeCell.routineKind === item.kind;
                    const isHovered =
                      !activeCell &&
                      hoveredCell?.categoryId === category.id &&
                      hoveredCell.routineKind === item.kind;

                    return (
                      <div key={item.kind} style={kindCellStyle}>
                        {count > 0 ? (
                          <button
                            type="button"
                            style={{
                              ...countBtnBase,
                              width: btnSize,
                              height: btnSize,
                              background: isActive
                                ? withAlpha(item.color, 0.28)
                                : isHovered
                                ? withAlpha(item.color, 0.18)
                                : withAlpha(item.color, 0.11),
                              borderColor: isActive || isHovered
                                ? withAlpha(item.color, 0.55)
                                : withAlpha(item.color, 0.22),
                              boxShadow: isActive
                                ? `0 0 0 2px ${withAlpha(item.color, 0.18)}`
                                : "none",
                            }}
                            onMouseEnter={() => {
                              if (!activeCell) {
                                setHoveredCell({ categoryId: category.id, routineKind: item.kind });
                              }
                            }}
                            onMouseLeave={() => {
                              if (!activeCell) setHoveredCell(null);
                            }}
                            onClick={() => {
                              setHoveredCell(null);
                              setActiveCell((current) =>
                                current?.categoryId === category.id &&
                                current.routineKind === item.kind
                                  ? null
                                  : { categoryId: category.id, routineKind: item.kind }
                              );
                            }}
                            aria-label={`${category.label} — ${item.label}: ${count} ${count === 1 ? "session" : "sessions"}`}
                            aria-pressed={isActive}
                          >
                            {count}
                          </button>
                        ) : (
                          <span style={{ ...emptyCellStyle, width: btnSize, height: btnSize }} aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Inline detail panel — expands below the row when active */}
                {isRowActive && focusedDetails?.category.id === category.id ? (
                  <DetailPanel
                    details={focusedDetails}
                    onClose={() => setActiveCell(null)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function subscribeToCompactMediaQuery(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(max-width: 600px)");
  const handler = () => onStoreChange();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

function getCompactSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 600px)").matches;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const outerScrollStyle: React.CSSProperties = {
  overflowX: "auto",
};

const dotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const kindHeaderStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 3,
  paddingBottom: 6,
  paddingTop: 4,
};

const kindAbbrStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  opacity: 0.7,
  textAlign: "center",
};


const labelColStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 8px 0 10px",
  minWidth: 0,
};

const categoryLinkStyle: React.CSSProperties = {
  color: "inherit",
  fontWeight: 800,
  fontSize: 13,
  textDecoration: "none",
  lineHeight: 1.3,
  minWidth: 0,
};

const rowTotalStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.45,
  flexShrink: 0,
};

const kindCellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
};

const countBtnBase: React.CSSProperties = {
  width: 38,
  height: 38,
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
  color: "inherit",
  transition: "background 0.1s, border-color 0.1s, box-shadow 0.1s",
};

const emptyCellStyle: React.CSSProperties = {
  display: "block",
  width: 38,
  height: 38,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.03)",
  fontSize: 13,
  opacity: 0.82,
};

// ─── Detail panel ─────────────────────────────────────────────────────────────

const detailPanelStyle: React.CSSProperties = {
  margin: "4px 0 6px",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(120,190,255,0.2)",
  background: "rgba(120,190,255,0.04)",
  display: "grid",
  gap: 10,
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const detailHeaderLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 0,
};

const detailKindStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.3,
};

const detailSepStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.35,
};

const detailCategoryLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "inherit",
  textDecoration: "none",
  opacity: 0.85,
};

const detailCountBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.6,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
};

const closeBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 30,
  height: 30,
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  color: "inherit",
};

const detailListStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const detailRowStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 9,
  background: "rgba(255,255,255,0.04)",
  display: "grid",
  gap: 4,
};

const detailRowTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 10,
  flexWrap: "wrap",
};

const routineNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.3,
};

const routineRepeatStyle: React.CSSProperties = {
  fontWeight: 600,
  opacity: 0.65,
};

const datesStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.62,
  flexShrink: 0,
  lineHeight: 1.3,
};

const partsStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.82,
};

const detailMoreStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  paddingTop: 2,
  paddingInline: 2,
};

const detailHintStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  lineHeight: 1.4,
  paddingTop: 2,
};
