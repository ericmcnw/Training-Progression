"use client";

// Training load on the injured muscle group(s): a stacked weekly bar chart of
// sessions that loaded the group over the last 8 weeks, stacked by routine
// domain (cardio / sport / strength / mobility). Reads load magnitude over
// time at a glance — is loading climbing back up, or backing off? — instead of
// the old heatmap grid. Tap a week to see the routines that contributed.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { COLOR, RADIUS } from "@/lib/design-tokens";
import type { HeatmapDomain, InjuryHeatmapData } from "@/app/injuries/[id]/training-heatmap";
import type { CoverageDetailLog } from "@/app/progress/coverage";

const DOMAIN_ACCENT: Record<HeatmapDomain, string> = {
  strength: "rgba(84,203,130,0.9)",
  cardio:   "rgba(78,148,255,0.9)",
  mobility: "rgba(192,132,252,0.9)",
  sport:    "rgba(251,146,60,0.9)",
};
const DOMAIN_LABEL: Record<HeatmapDomain, string> = {
  strength: "Strength",
  cardio: "Cardio",
  sport: "Sport",
  mobility: "Mobility",
};
const STACK_ORDER: HeatmapDomain[] = ["cardio", "sport", "strength", "mobility"];

const TRACK_H = 96;

export default function InjuryTrainingLoad({ data }: { data: InjuryHeatmapData }) {
  const [sel, setSel] = useState<{ category: string; weekIdx: number } | null>(null);

  if (data.categories.length === 0) {
    return (
      <div style={{ fontSize: 13, color: COLOR.textDim, lineHeight: 1.45 }}>
        These zones aren&rsquo;t mapped to a muscle group, so there&rsquo;s nothing to count here.
      </div>
    );
  }

  // Consistent y-scale across every muscle group so a heavy week reads heavy
  // in all charts.
  const globalPeak = Math.max(1, ...data.categories.flatMap((c) => c.weeks));

  // Which domains appear anywhere — drives the legend.
  const presentDomains = STACK_ORDER.filter((d) =>
    data.categories.some((c) => c.domains.some((dr) => dr.domain === d && dr.totalCount > 0)),
  );

  const weekCount = data.weekStarts.length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {presentDomains.length > 0 && (
        <div style={legendRow}>
          {presentDomains.map((d) => (
            <span key={d} style={legendItem}>
              <span style={{ ...legendSwatch, background: DOMAIN_ACCENT[d] }} />
              {DOMAIN_LABEL[d]}
            </span>
          ))}
        </div>
      )}

      {data.categories.map((category) => {
        // count per domain per week for this category
        const weekDomainCounts: Array<Partial<Record<HeatmapDomain, number>>> = Array.from(
          { length: weekCount },
          () => ({}),
        );
        for (const dr of category.domains) {
          dr.weeks.forEach((count, i) => {
            if (count > 0) weekDomainCounts[i][dr.domain] = count;
          });
        }

        return (
          <div key={category.slug} style={{ display: "grid", gap: 8 }}>
            <div style={muscleHeader}>
              <span style={muscleHeaderLabel}>{category.label}</span>
              <span style={muscleHeaderMeta}>
                {category.recentCount} session{category.recentCount === 1 ? "" : "s"} · last 4w · {category.totalCount} total
              </span>
            </div>

            {category.totalCount === 0 ? (
              <div style={emptyNote}>No training touched this muscle group in the last 8 weeks.</div>
            ) : (
              <>
                <div style={chartRow} role="group" aria-label={`${category.label} weekly training load`}>
                  {data.weekStarts.map((ws, i) => {
                    const total = category.weeks[i];
                    const isSel = sel?.category === category.slug && sel.weekIdx === i;
                    const isCurrent = i === weekCount - 1;
                    return (
                      <button
                        key={ws}
                        type="button"
                        onClick={() => setSel(isSel ? null : { category: category.slug, weekIdx: i })}
                        style={{ ...colBtn, ...(isSel ? colBtnSelected : null) }}
                        aria-pressed={isSel}
                        title={`Week of ${weekShort(ws)}: ${total} session${total === 1 ? "" : "s"}`}
                      >
                        <span style={colCount}>{total > 0 ? total : ""}</span>
                        <span style={track}>
                          {STACK_ORDER.map((d) => {
                            const count = weekDomainCounts[i][d] ?? 0;
                            if (count <= 0) return null;
                            const h = Math.max(3, (count / globalPeak) * TRACK_H);
                            return (
                              <span
                                key={d}
                                style={{ height: h, background: DOMAIN_ACCENT[d], opacity: isSel || sel === null ? 1 : 0.55 }}
                              />
                            );
                          })}
                        </span>
                        <span style={{ ...colLabel, ...(isCurrent ? colLabelCurrent : null) }}>{weekShort(ws)}</span>
                      </button>
                    );
                  })}
                </div>

                {sel?.category === category.slug && (
                  <WeekRoutines category={category} weekIdx={sel.weekIdx} weekStarts={data.weekStarts} />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekRoutines({
  category,
  weekIdx,
  weekStarts,
}: {
  category: InjuryHeatmapData["categories"][number];
  weekIdx: number;
  weekStarts: string[];
}) {
  const weekStart = weekStarts[weekIdx];
  const weekEndExclusive =
    weekIdx < weekStarts.length - 1 ? weekStarts[weekIdx + 1] : addDaysYmd(weekStarts[weekIdx], 7);

  const logs: CoverageDetailLog[] = [];
  const seen = new Set<string>();
  for (const dr of category.domains) {
    for (const log of dr.contributingLogs) {
      if (seen.has(log.logId)) continue;
      const ymd = log.performedAt.slice(0, 10);
      if (ymd >= weekStart && ymd < weekEndExclusive) {
        seen.add(log.logId);
        logs.push(log);
      }
    }
  }
  logs.sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  return (
    <div style={expandedPanel}>
      <div style={weekRangeLabel}>{formatWeekRange(weekStart, weekEndExclusive)}</div>
      {logs.length === 0 ? (
        <div style={emptyLogs}>No sessions during this week.</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {logs.slice(0, 20).map((log) => (
            <Link key={log.logId} href={`/routines/${log.routineId}/logs/${log.logId}`} style={logRow}>
              <span style={logName}>{log.routineName}</span>
              {log.relevantParts.length > 0 && <span style={logHint}>{log.relevantParts[0]}</span>}
              <span style={logDate}>{log.performedAtLabel}</span>
            </Link>
          ))}
          {logs.length > 20 && (
            <div style={moreNote}>+ {logs.length - 20} more session{logs.length - 20 === 1 ? "" : "s"}</div>
          )}
        </div>
      )}
    </div>
  );
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekShort(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatWeekRange(startYmd: string, endYmdExclusive: string): string {
  const endYmd = addDaysYmd(endYmdExclusive, -1);
  const start = new Date(`${startYmd}T00:00:00.000Z`);
  const end = new Date(`${endYmd}T00:00:00.000Z`);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}

// ── styles ──────────────────────────────────────────────────────────────────
const legendRow: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };
const legendItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.textDim,
};
const legendSwatch: CSSProperties = { width: 9, height: 9, borderRadius: 2, display: "inline-block" };

const muscleHeader: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};
const muscleHeaderLabel: CSSProperties = { fontSize: 13, fontWeight: 900, color: COLOR.text, letterSpacing: -0.1 };
const muscleHeaderMeta: CSSProperties = { fontSize: 11, fontWeight: 700, color: COLOR.textFaint };
const emptyNote: CSSProperties = { fontSize: 12, color: COLOR.textFaint, fontStyle: "italic", padding: "4px 0" };

const chartRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 4,
};
const colBtn: CSSProperties = {
  appearance: "none",
  border: "1px solid transparent",
  background: "transparent",
  padding: "2px 2px 0",
  margin: 0,
  cursor: "pointer",
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  borderRadius: 8,
};
const colBtnSelected: CSSProperties = {
  border: `1px solid ${COLOR.borderStrong}`,
  background: "rgba(255,255,255,0.04)",
};
const colCount: CSSProperties = { fontSize: 10.5, fontWeight: 900, color: COLOR.text, minHeight: 14, lineHeight: "14px" };
const track: CSSProperties = {
  width: "100%",
  height: TRACK_H,
  display: "flex",
  flexDirection: "column-reverse",
  justifyContent: "flex-start",
  alignItems: "stretch",
  gap: 1.5,
  borderRadius: 4,
  overflow: "hidden",
  background: "rgba(255,255,255,0.035)",
};
const colLabel: CSSProperties = { fontSize: 9, fontWeight: 700, color: COLOR.textFaint, whiteSpace: "nowrap" };
const colLabelCurrent: CSSProperties = { color: COLOR.text, fontWeight: 900 };

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
const emptyLogs: CSSProperties = { fontSize: 12, color: COLOR.textFaint, fontStyle: "italic" };
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
  maxWidth: 200,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const logDate: CSSProperties = { fontSize: 11, color: COLOR.textFaint, fontWeight: 700, whiteSpace: "nowrap" };
const moreNote: CSSProperties = { fontSize: 11, color: COLOR.textFaint, fontStyle: "italic", textAlign: "center", padding: "4px 0" };
