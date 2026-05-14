"use client";

// Heatmap of training load on the muscle groups affected by this injury,
// split by routine domain (cardio / sport / strength / mobility). Click a
// single cell to see the routines that contributed during that week; each
// link jumps to its log detail.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { COLOR, RADIUS } from "@/lib/design-tokens";
import type { HeatmapDomain, InjuryHeatmapData, InjuryHeatmapDomainRow } from "@/app/injuries/[id]/training-heatmap";
import type { CoverageDetailLog } from "@/app/progress/coverage";

type ExpandedKey = { category: string; domain: HeatmapDomain; weekIdx: number };

// Match the dashboard domain palette so this card reads in the same
// visual language as Training Balance + sparkline charts.
const DOMAIN_ACCENT: Record<HeatmapDomain, string> = {
  strength: "rgba(84,203,130,0.9)",
  cardio:   "rgba(78,148,255,0.9)",
  mobility: "rgba(192,132,252,0.9)",
  sport:    "rgba(251,146,60,0.9)",
};

export default function InjuryTrainingHeatmap({ data }: { data: InjuryHeatmapData }) {
  const [expanded, setExpanded] = useState<ExpandedKey | null>(null);

  if (data.categories.length === 0) {
    return (
      <div style={{ fontSize: 13, color: COLOR.textDim, lineHeight: 1.45 }}>
        These zones aren&rsquo;t mapped to a muscle group, so there&rsquo;s nothing to count here.
      </div>
    );
  }

  // Global peak across every domain × week cell — keeps color scaling
  // consistent so a heavy cardio week reads visually similar to a heavy
  // strength week.
  const globalPeak = Math.max(
    1,
    ...data.categories.flatMap((c) => c.domains.flatMap((d) => d.weeks)),
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Date axis (top) */}
      <div style={headerRow}>
        <div style={labelCol} />
        <div style={weeksCol}>
          {data.weekStarts.map((ws, i) => (
            <span key={ws} style={{ ...weekHeaderCell, ...(i === data.weekStarts.length - 1 ? weekHeaderCurrent : null) }}>
              {weekShort(ws)}
            </span>
          ))}
        </div>
        <div style={totalLabel}>recent</div>
      </div>

      {data.categories.map((category) => (
        <div key={category.slug} style={{ display: "grid", gap: 4 }}>
          {/* Muscle-group header (non-clickable, just an eyebrow + combined
              recent count). */}
          <div style={muscleHeader}>
            <span style={muscleHeaderLabel}>{category.label}</span>
            <span style={muscleHeaderMeta}>
              {category.recentCount} session{category.recentCount === 1 ? "" : "s"} in last 4w · {category.totalCount} total
            </span>
          </div>

          {category.domains.length === 0 ? (
            <div style={emptyDomainNote}>
              No training touched this muscle group in the last 12 weeks.
            </div>
          ) : (
            category.domains.map((domainRow) => {
              const accent = DOMAIN_ACCENT[domainRow.domain];
              const isRowExpanded =
                expanded?.category === category.slug && expanded.domain === domainRow.domain;
              return (
                <div key={`${category.slug}::${domainRow.domain}`} style={{ display: "grid", gap: 6 }}>
                  <div style={rowContent}>
                    <div style={labelCol}>
                      <span style={{ ...domainDot, background: accent }} />
                      <span style={domainName}>{domainRow.domainLabel}</span>
                    </div>
                    <div style={weeksCol}>
                      {domainRow.weeks.map((count, i) => {
                        const isCellExpanded = isRowExpanded && expanded.weekIdx === i;
                        const isClickable = count > 0;
                        const cellStyle: CSSProperties = {
                          ...heatmapCell(count, globalPeak, accent),
                          ...heatmapCellButton,
                          cursor: isClickable ? "pointer" : "default",
                          ...(isCellExpanded ? heatmapCellSelected(accent) : null),
                        };
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={!isClickable}
                            onClick={() =>
                              setExpanded(
                                isCellExpanded
                                  ? null
                                  : { category: category.slug, domain: domainRow.domain, weekIdx: i }
                              )
                            }
                            style={cellStyle}
                            aria-pressed={isCellExpanded}
                            title={`${category.label} · ${domainRow.domainLabel}: ${count} session${count === 1 ? "" : "s"} · week of ${data.weekStarts[i]}`}
                          >
                            {count > 0 ? count : ""}
                          </button>
                        );
                      })}
                    </div>
                    <div style={totalCol}>
                      <span style={totalValue}>{domainRow.recentCount}</span>
                      <span style={totalSub}>/4w</span>
                    </div>
                  </div>

                  {isRowExpanded && (
                    <ExpandedRoutineList
                      row={domainRow}
                      weekIdx={expanded.weekIdx}
                      weekStarts={data.weekStarts}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

function ExpandedRoutineList({
  row,
  weekIdx,
  weekStarts,
}: {
  row: InjuryHeatmapDomainRow;
  weekIdx: number;
  weekStarts: string[];
}) {
  const weekStart = weekStarts[weekIdx];
  // Week-end is exclusive — the day after the last day of the bucket. For the
  // final week we add 7 days; otherwise we use the next week's start.
  const weekEndExclusive =
    weekIdx < weekStarts.length - 1
      ? weekStarts[weekIdx + 1]
      : addDaysYmd(weekStarts[weekIdx], 7);

  const logs = filterLogsToWeek(row.contributingLogs, weekStart, weekEndExclusive);
  const rangeLabel = formatWeekRange(weekStart, weekEndExclusive);

  if (logs.length === 0) {
    return (
      <div style={expandedPanel}>
        <div style={weekRangeLabel}>{rangeLabel}</div>
        <div style={emptyLogs}>No sessions during this week.</div>
      </div>
    );
  }

  return (
    <div style={expandedPanel}>
      <div style={weekRangeLabel}>{rangeLabel}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {logs.slice(0, 20).map((log) => (
          <Link
            key={log.logId}
            href={`/routines/${log.routineId}/logs/${log.logId}`}
            style={logRow}
          >
            <span style={logName}>{log.routineName}</span>
            {log.relevantParts.length > 0 && (
              <span style={logHint}>{log.relevantParts[0]}</span>
            )}
            <span style={logDate}>{log.performedAtLabel}</span>
          </Link>
        ))}
        {logs.length > 20 && (
          <div style={moreNote}>
            + {logs.length - 20} more session{logs.length - 20 === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

function filterLogsToWeek(
  logs: CoverageDetailLog[],
  startYmd: string,
  endYmdExclusive: string,
): CoverageDetailLog[] {
  return logs.filter((log) => {
    const ymd = ymdFromIso(log.performedAt);
    return ymd >= startYmd && ymd < endYmdExclusive;
  });
}

function ymdFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(startYmd: string, endYmdExclusive: string): string {
  const endYmd = addDaysYmd(endYmdExclusive, -1);
  const start = new Date(`${startYmd}T00:00:00.000Z`);
  const end = new Date(`${endYmd}T00:00:00.000Z`);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}

function weekShort(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function heatmapCell(count: number, peak: number, accent: string): CSSProperties {
  const intensity = peak > 0 ? Math.min(1, count / peak) : 0;
  const alpha = count === 0 ? 0.04 : 0.12 + 0.78 * intensity;
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 4,
    background: count === 0 ? "rgba(255,255,255,0.04)" : tintAccent(accent, alpha),
    color: count === 0 ? "transparent" : intensity > 0.55 ? "#0b1220" : COLOR.text,
    fontSize: 10.5,
    fontWeight: 800,
    border: count === 0 ? `1px solid rgba(255,255,255,0.04)` : `1px solid ${tintAccent(accent, 0.45)}`,
  };
}

function tintAccent(rgba: string, alpha: number): string {
  const match = rgba.match(/rgba\(([^)]+)\)/);
  if (!match) return rgba;
  const [r, g, b] = match[1].split(",").slice(0, 3).map((s) => Number(s.trim()));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const headerRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(110px, 150px) 1fr 56px",
  gap: 10,
  alignItems: "center",
  paddingBottom: 4,
};

const labelCol: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const weeksCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
  gap: 3,
};

const weekHeaderCell: CSSProperties = {
  textAlign: "center",
  fontSize: 9,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const weekHeaderCurrent: CSSProperties = {
  color: COLOR.text,
  fontWeight: 800,
};

const totalLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  textAlign: "right",
};

const muscleHeader: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  paddingTop: 4,
};

const muscleHeaderLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.text,
  letterSpacing: -0.1,
};

const muscleHeaderMeta: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const emptyDomainNote: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  fontStyle: "italic",
  padding: "4px 0",
};

const rowContent: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(110px, 150px) 1fr 56px",
  gap: 10,
  alignItems: "center",
  padding: "6px 8px",
};

const heatmapCellButton: CSSProperties = {
  appearance: "none",
  margin: 0,
  font: "inherit",
  color: "inherit",
  padding: 0,
};

function heatmapCellSelected(accent: string): CSSProperties {
  return {
    outline: `2px solid ${tintAccent(accent, 0.95)}`,
    outlineOffset: 1,
  };
}

const domainDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const domainName: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textTransform: "capitalize",
};

const totalCol: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  gap: 3,
};

const totalValue: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: COLOR.text,
};

const totalSub: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const expandedPanel: CSSProperties = {
  padding: "8px 10px 10px",
  borderRadius: RADIUS.inner,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${COLOR.border}`,
  display: "grid",
  gap: 6,
};

const weekRangeLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
};

const emptyLogs: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  fontStyle: "italic",
};

const logRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 8,
  alignItems: "center",
  padding: "6px 8px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${COLOR.border}`,
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  minWidth: 0,
};

const logName: CSSProperties = {
  fontWeight: 800,
  color: COLOR.text,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const logHint: CSSProperties = {
  fontSize: 11,
  color: COLOR.textDim,
  fontWeight: 600,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 220,
};

const logDate: CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const moreNote: CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  fontStyle: "italic",
  textAlign: "center",
  padding: "4px 0",
};
