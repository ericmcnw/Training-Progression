"use client";

// DomainSparklines — one row per active domain, 8-week mini bar chart.
//
// Layout:
//   • Shared week-range axis at the top of the card (e.g. "5/4–5/10"), each
//     label aligned over its column so every domain row reads the same.
//   • Per-row chart of 8 bars. Tap a bar → inline expansion shows that week's
//     logs sorted by date.
//   • Tap a log row → small floating popover with log details + view link.

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { DomainSeries, DomainTone, DomainWeek } from "./types";
import { COLOR, cardSurface, cardHeader, cardTitle, cardHint, DOMAIN_LABEL } from "./tokens";
import { domainAccent } from "./client-utils";
import Popover from "./Popover";
import { getHomeLogReport, type LogReport } from "./log-detail-action";

type Props = { series: DomainSeries[] };

type OpenSelection = { domain: DomainTone; weekStartYmd: string } | null;

// Shared log reference shape used by both the per-domain expansion and any
// other surface that wants to open the floating LogDetailPopover (e.g. the
// frequency-goal weekly bars). Kept structural so callers can hand in extra
// fields (like `isPrimary`) without having to map.
export type HomeLogRef = {
  logId: string;
  routineId: string;
  routineName: string;
  performedYmd: string;
  performedTimeLabel: string;
};

export type OpenLog = { log: HomeLogRef; accent: string; label: string } | null;

export default function DomainSparklines({ series }: Props) {
  const [open, setOpen] = useState<OpenSelection>(null);
  const [openLog, setOpenLog] = useState<OpenLog>(null);

  if (series.length === 0) {
    return (
      <section style={cardSurface}>
        <header style={cardHeader}>
          <span style={cardTitle}>Domain volume</span>
        </header>
        <div style={emptyState}>No sessions logged in the last 8 weeks.</div>
      </section>
    );
  }

  // All domain rows share the same 8 week starts.
  const weekStarts = series[0]?.weeks.map((w) => ({ start: w.weekStartYmd, end: w.weekEndYmd })) ?? [];

  return (
    <section style={cardSurface}>
      <header style={cardHeader}>
        <span style={cardTitle}>Domain volume</span>
        <span style={cardHint}>last 8 weeks · tap a bar</span>
      </header>

      {/* Shared week-range axis — sits above the first domain row so every
          row reads against the same labels. Uses the same 3-column grid as
          the rows so the chart middle column lines up exactly. The inner
          spacer matches the per-row y-axis gutter (peak/0 markers) so the
          date labels stay aligned over their respective bars. */}
      <div style={axisRow} className="homeV2DomainRow">
        <div /> {/* aligns under the domain label column */}
        <div style={axisChartShell}>
          <div style={axisYGutter} aria-hidden />
          <div style={weekLabelStrip}>
            {weekStarts.map((w, i) => {
              const startLabel = monthDay(w.start);
              const endLabel = monthDay(w.end);
              return (
                <span
                  key={w.start}
                  style={{ ...weekLabelText, ...(i === weekStarts.length - 1 ? weekLabelTextCurrent : null) }}
                >
                  {startLabel}
                  {/* Hide the "–end" half on narrow viewports so the labels
                      don't collide. Start date alone is enough to read the
                      8-week timeline at a glance. */}
                  <span className="weekLabelEnd">–{endLabel}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div style={axisTotalSlot}>this wk</div>
      </div>

      <ul style={list}>
        {series.map((row) => {
          const accent = domainAccent(row.domain);
          const peak = Math.max(1, ...row.weeks.map((w) => w.count));
          const expandedWeek =
            open && open.domain === row.domain
              ? row.weeks.find((w) => w.weekStartYmd === open.weekStartYmd) ?? null
              : null;
          return (
            <li key={row.domain} style={domainRowShell}>
              <div style={domainRow} className="homeV2DomainRow">
                <div style={rowLabelCol}>
                  <span style={{ ...labelDot, background: accent }} aria-hidden />
                  <span style={labelText}>{DOMAIN_LABEL[row.domain] ?? row.label}</span>
                </div>
                <div style={chartCol}>
                  {/* Tiny y-axis hint: the peak value, anchored at the top
                      of the bar area. The 0 baseline is implicit (the bottom
                      border of the chart cell). */}
                  <div style={yAxis} aria-hidden>
                    <span style={yAxisPeak}>{peak}</span>
                    <span style={yAxisZero}>0</span>
                  </div>
                  <div style={barsTrack}>
                    {row.weeks.map((week, i) => {
                      const isCurrent = i === row.weeks.length - 1;
                      const isOpen = Boolean(
                        expandedWeek && week.weekStartYmd === expandedWeek.weekStartYmd
                      );
                      return (
                        <button
                          key={week.weekStartYmd}
                          type="button"
                          onClick={() =>
                            setOpen((prev) =>
                              prev && prev.domain === row.domain && prev.weekStartYmd === week.weekStartYmd
                                ? null
                                : { domain: row.domain, weekStartYmd: week.weekStartYmd }
                            )
                          }
                          className="homeV2DomainBar"
                          aria-label={`${row.label}: ${week.count} sessions · week of ${week.weekStartYmd}`}
                          aria-pressed={isOpen}
                          disabled={week.count === 0}
                        >
                          <span style={barValueLabel(isCurrent, week.count > 0)}>
                            {week.count > 0 ? week.count : ""}
                          </span>
                          <div style={barInnerCell}>
                            <div
                              style={{
                                ...bar,
                                height: `${Math.max(week.count > 0 ? 10 : 3, (week.count / peak) * 100)}%`,
                                background: week.count > 0 ? accent : "rgba(255,255,255,0.06)",
                                boxShadow: isCurrent && week.count > 0
                                  ? `0 0 0 1px ${accent}`
                                  : isOpen
                                  ? `0 0 0 1.5px rgba(255,255,255,0.5)`
                                  : undefined,
                                opacity: week.count > 0 ? 1 : 0.35,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={trailingCol} className="homeV2DomainTotal">
                  <span style={countValue}>{row.totalThisWeek}</span>
                  <span style={countLabel}>this wk</span>
                </div>
              </div>

              {expandedWeek ? (
                <ExpandedWeekPanel
                  week={expandedWeek}
                  accent={accent}
                  label={DOMAIN_LABEL[row.domain] ?? row.label}
                  onClose={() => setOpen(null)}
                  onLogClick={(log) => setOpenLog({ log, accent, label: DOMAIN_LABEL[row.domain] ?? row.label })}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <LogDetailPopover open={openLog} onClose={() => setOpenLog(null)} />

      <style>{`
        .homeV2DomainBar {
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
          padding: 0 1px;
          background: transparent;
          border: none;
          color: inherit;
          font: inherit;
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          cursor: pointer;
          border-radius: 4px;
          transition: background 100ms ease;
        }
        .homeV2DomainBar:not(:disabled):hover,
        .homeV2DomainBar:not(:disabled):focus-visible {
          background: rgba(255,255,255,0.06);
        }
        .homeV2DomainBar:disabled { cursor: default; }
        /* Shared grid template — applies to both the axis row and the domain
           rows. Fixed trailing column width keeps the bar column lined up. */
        .homeV2DomainRow {
          display: grid;
          grid-template-columns: minmax(80px, 0.95fr) minmax(0, 2.4fr) 64px;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
        }
        @media (max-width: 540px) {
          /* Stacked layout on mobile — the 3-col grid was squeezing both
             the domain label (truncated to "Stren...") and the chart. By
             stacking, the chart gets full row width, labels stop truncating,
             and date axis + per-bar values both breathe. */
          .homeV2DomainRow {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "label total"
              "chart chart";
            column-gap: 8px;
            row-gap: 4px;
            padding: 10px 10px 8px;
            align-items: center;
          }
          .homeV2DomainRow > :nth-child(1) { grid-area: label; }
          .homeV2DomainRow > :nth-child(2) { grid-area: chart; }
          .homeV2DomainRow > :nth-child(3) { grid-area: total; }
          /* Drop the "–end" half so labels stop colliding; start-date alone
             reads cleanly across the 8 columns. */
          .weekLabelEnd { display: none; }
        }
        @keyframes homeV2Pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(0.78); }
        }
      `}</style>
    </section>
  );
}

// ───────────────────────────── inline week expansion

function ExpandedWeekPanel({
  week,
  accent,
  label,
  onClose,
  onLogClick,
}: {
  week: DomainWeek;
  accent: string;
  label: string;
  onClose: () => void;
  onLogClick: (log: DomainWeek["logs"][number]) => void;
}) {
  return (
    <div style={expansionShell}>
      <div style={expansionHeader}>
        <div style={expansionHeaderText}>
          <span style={{ ...expansionDot, background: accent }} aria-hidden />
          <span style={expansionLabel}>{label}</span>
          <span style={expansionRange}>{prettyDate(week.weekStartYmd)} – {prettyDate(week.weekEndYmd)}</span>
        </div>
        <button type="button" onClick={onClose} style={closeBtn} aria-label="Close week detail">×</button>
      </div>
      {week.logs.length === 0 ? (
        <div style={emptyState}>No sessions this week.</div>
      ) : (
        <ul style={logList}>
          {groupLogsByRoutine(week.logs).map((group) => (
            <li key={group.routineId}>
              <div style={groupShell}>
                <div style={groupHeader}>
                  <span style={{ ...logRowAccent, background: accent }} aria-hidden />
                  <span style={logRowName}>{group.routineName}</span>
                  {group.entries.length > 1 ? (
                    <span style={countBadge(accent)}>×{group.entries.length}</span>
                  ) : null}
                </div>
                {/* Date pills — one per occurrence, each clickable to open
                    the per-log detail popover. Even single-log groups use
                    the pill so the layout reads consistently. */}
                <div style={datePillRow}>
                  {group.entries.map((log) => (
                    <button
                      key={log.logId}
                      type="button"
                      onClick={() => onLogClick(log)}
                      style={datePill}
                    >
                      <span style={datePillDate}>
                        {prettyDate(log.performedYmd, { weekday: "short" })}
                      </span>
                      <span style={datePillTime}>{log.performedTimeLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Group logs by routine, keeping each routine's entries in chronological
// order. Returned groups are sorted by most-recent occurrence first so the
// list reads "what'd I just do" → "what'd I do earlier this week."
function groupLogsByRoutine(
  logs: DomainWeek["logs"]
): Array<{ routineId: string; routineName: string; entries: DomainWeek["logs"] }> {
  const byRoutine = new Map<string, { routineId: string; routineName: string; entries: DomainWeek["logs"] }>();
  for (const log of logs) {
    const existing = byRoutine.get(log.routineId);
    if (existing) existing.entries.push(log);
    else byRoutine.set(log.routineId, { routineId: log.routineId, routineName: log.routineName, entries: [log] });
  }
  for (const group of byRoutine.values()) {
    group.entries.sort((a, b) => a.performedYmd.localeCompare(b.performedYmd));
  }
  return Array.from(byRoutine.values()).sort((a, b) => {
    const aLatest = a.entries[a.entries.length - 1].performedYmd;
    const bLatest = b.entries[b.entries.length - 1].performedYmd;
    return bLatest.localeCompare(aLatest);
  });
}

// ───────────────────────────── floating log popover (full report)

export function LogDetailPopover({
  open,
  onClose,
}: {
  open: OpenLog;
  onClose: () => void;
}) {
  const [report, setReport] = useState<LogReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the full log report when the popover opens. Resets between opens.
  useEffect(() => {
    if (!open) {
      setReport(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    getHomeLogReport(open.log.logId)
      .then((r) => {
        if (cancelled) return;
        if (!r) setError("Log not found.");
        else setReport(r);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load this log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;
  const { log, accent, label } = open;
  return (
    <Popover
      open={!!open}
      onClose={onClose}
      title={
        <span style={popTitleRow}>
          <span style={{ ...popTitleDot, background: accent }} aria-hidden />
          {report?.routineName ?? log.routineName}
        </span>
      }
      subtitle={
        report
          ? `${report.performedDateLabel} · ${report.performedTimeLabel} · ${label}`
          : `${prettyDate(log.performedYmd, { weekday: "long" })} · ${log.performedTimeLabel} · ${label}`
      }
      desktopWidth={420}
    >
      {loading ? (
        <div style={loadingShell}>
          <span style={loadingDot} />
          <span style={loadingText}>Loading log…</span>
        </div>
      ) : error ? (
        <div style={errorText}>{error}</div>
      ) : report ? (
        <LogReportBody report={report} />
      ) : null}

      <Link href={`/routines/${log.routineId}/logs/${log.logId}`} style={popAction} onClick={onClose}>
        View full log →
      </Link>
    </Popover>
  );
}

function LogReportBody({ report }: { report: LogReport }) {
  return (
    <div style={reportShell}>
      {/* Top-line metrics adapt by kind. */}
      <TopLineMetrics report={report} />

      {/* WORKOUT / SESSION exercises */}
      {report.exercises.length > 0 ? (
        <div style={reportBlock}>
          <div style={reportBlockLabel}>Exercises</div>
          <ul style={exerciseList}>
            {report.exercises.map((ex) => (
              <li key={ex.exerciseId} style={exerciseRow}>
                <div style={exerciseHead}>
                  <span style={exerciseName}>{ex.exerciseName}</span>
                  <span style={exerciseMeta}>{ex.setCount} set{ex.setCount === 1 ? "" : "s"}</span>
                </div>
                <div style={exerciseSummary}>
                  {ex.topWeight != null ? <Stat label="Top" value={`${ex.topWeight}lb`} /> : null}
                  {ex.totalReps > 0 ? <Stat label="Reps" value={String(ex.totalReps)} /> : null}
                  {ex.totalSeconds > 0 ? <Stat label="Time" value={formatSeconds(ex.totalSeconds)} /> : null}
                </div>
                {ex.sets.length > 0 && ex.sets.length <= 6 ? (
                  <div style={setStrip}>
                    {ex.sets.map((s) => (
                      <span key={s.setNumber} style={setChip}>
                        {s.weightLb != null ? `${s.weightLb}×` : ""}
                        {s.reps != null ? `${s.reps}` : s.seconds != null ? formatSeconds(s.seconds) : "·"}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* GUIDED steps */}
      {report.guidedSteps.length > 0 ? (
        <div style={reportBlock}>
          <div style={reportBlockLabel}>Steps · {report.guidedSteps.length}</div>
          <ul style={smallList}>
            {report.guidedSteps.slice(0, 8).map((step, i) => (
              <li key={i} style={smallRow}>
                <span style={smallRowText}>{step.title}</span>
                <span style={smallRowMeta}>
                  {step.durationSec ? formatSeconds(step.durationSec) : null}
                  {step.weightLb != null ? ` · ${step.weightLb}lb` : null}
                  {step.repCount > 1 ? ` · ×${step.repCount}` : null}
                </span>
              </li>
            ))}
            {report.guidedSteps.length > 8 ? (
              <li style={smallRowFooter}>+{report.guidedSteps.length - 8} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Climbing attempts (SESSION kind) */}
      {report.climbAttempts.length > 0 ? (
        <div style={reportBlock}>
          <div style={reportBlockLabel}>Attempts · {report.climbAttempts.length}</div>
          <div style={attemptGrid}>
            {report.climbAttempts.slice(0, 12).map((c, i) => (
              <span key={i} style={attemptChip(c.outcome)}>
                {c.grade} <span style={attemptOutcome}>{c.outcome.toLowerCase()}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Custom + ad-hoc metrics */}
      {report.metrics.length > 0 ? (
        <div style={reportBlock}>
          <div style={reportBlockLabel}>Metrics</div>
          <ul style={smallList}>
            {report.metrics.map((m) => (
              <li key={m.id} style={smallRow}>
                <span style={smallRowText}>{m.name}</span>
                <span style={smallRowMeta}>{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.notes ? (
        <div style={reportBlock}>
          <div style={reportBlockLabel}>Notes</div>
          <div style={notesText}>{report.notes}</div>
        </div>
      ) : null}
    </div>
  );
}

function TopLineMetrics({ report }: { report: LogReport }) {
  const metrics: Array<{ label: string; value: string }> = [];
  if (report.durationSec != null && report.durationSec > 0) {
    metrics.push({ label: "Duration", value: formatSeconds(report.durationSec) });
  }
  if (report.distanceMi != null && report.distanceMi > 0) {
    metrics.push({ label: "Distance", value: `${report.distanceMi.toFixed(2)} mi` });
  }
  if (report.elevationGainFt != null && report.elevationGainFt > 0) {
    metrics.push({ label: "Elevation", value: `${report.elevationGainFt} ft` });
  }
  if (report.location) {
    metrics.push({ label: "Location", value: report.location });
  }
  if (report.completionCount != null && report.completionCount > 0) {
    metrics.push({ label: "Count", value: String(report.completionCount) });
  }
  if (report.kind === "WORKOUT" && report.exercises.length > 0) {
    const totalSets = report.exercises.reduce((s, e) => s + e.setCount, 0);
    metrics.push({ label: "Sets", value: String(totalSets) });
    metrics.push({ label: "Exercises", value: String(report.exercises.length) });
  }
  if (metrics.length === 0) return null;
  return (
    <div style={topLineGrid}>
      {metrics.map((m) => (
        <div key={m.label} style={topLineTile}>
          <span style={topLineValue}>{m.value}</span>
          <span style={topLineLabel}>{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span style={statInline}>
      <span style={statInlineLabel}>{label}</span>
      <span style={statInlineValue}>{value}</span>
    </span>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r === 0 ? `${m}m` : `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
}

// ───────────────────────────── helpers

function monthDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function prettyDate(ymd: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(opts ?? {}),
  });
}

// ───────────────────────── styles

const list: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 6,
};

const axisRow: CSSProperties = {
  paddingTop: 2,
  paddingBottom: 0,
};

const axisChartShell: CSSProperties = {
  display: "flex",
  gap: 6, // matches chartCol's gap so the labels-track starts where the bars-track starts
  width: "100%",
};

// Empty gutter that matches the y-axis column width inside the bar rows
// (12px min + 4px padding-right + 1px border = ~17px). Keeps the date-label
// strip starting at the same x-offset as the bars track.
const axisYGutter: CSSProperties = {
  minWidth: 12,
  paddingRight: 4,
  borderRight: `1px dashed transparent`, // reserve the 1px the bar rows use
};

const weekLabelStrip: CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 3,
  minWidth: 0,
};

const weekLabelText: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  textAlign: "center",
  fontSize: 9.5,
  fontWeight: 700,
  color: COLOR.textFaint,
  letterSpacing: 0.2,
};

const weekLabelTextCurrent: CSSProperties = {
  color: COLOR.text,
  fontWeight: 800,
};

const axisTotalSlot: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  textAlign: "right",
};

const domainRowShell: CSSProperties = {
  borderRadius: 12,
  border: `1px solid rgba(255,255,255,0.06)`,
  background: "rgba(255,255,255,0.018)",
  overflow: "hidden",
};

const domainRow: CSSProperties = {};

const rowLabelCol: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const labelDot: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  flexShrink: 0,
};

const labelText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  color: COLOR.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// The chart cell now contains a tiny left-side y-axis (peak / 0 markers) and
// the bars track. Each bar button is a flex column: value label on top, bar
// cell below. Bars still grow from the bottom of the bar cell.
const chartCol: CSSProperties = {
  display: "flex",
  gap: 6,
  width: "100%",
  height: 52,
  alignItems: "stretch",
};

const yAxis: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "flex-end",
  paddingTop: 0,
  paddingBottom: 1,
  minWidth: 12,
  borderRight: `1px dashed rgba(255,255,255,0.08)`,
  paddingRight: 4,
};

const yAxisPeak: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: COLOR.textDim,
  lineHeight: 1,
};

const yAxisZero: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: COLOR.textFaint,
  lineHeight: 1,
};

const barsTrack: CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 3,
  alignItems: "stretch",
  minWidth: 0,
};

const barInnerCell: CSSProperties = {
  width: "100%",
  flex: 1,
  display: "flex",
  alignItems: "flex-end",
  minHeight: 0,
};

function barValueLabel(isCurrent: boolean, hasValue: boolean): CSSProperties {
  return {
    height: 12,
    minHeight: 12,
    lineHeight: 1,
    fontSize: 9.5,
    fontWeight: isCurrent ? 900 : 700,
    color: !hasValue ? "transparent"
      : isCurrent ? COLOR.text
      : COLOR.textDim,
    letterSpacing: 0.2,
    paddingBottom: 2,
  };
}

const bar: CSSProperties = {
  width: "100%",
  minHeight: 3,
  borderRadius: 3,
  transition: "height 220ms ease, box-shadow 120ms ease",
};

const trailingCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  justifyContent: "center",
};

const countValue: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: COLOR.text,
  lineHeight: 1,
};

const countLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: COLOR.textFaint,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const emptyState: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  padding: "12px 6px",
  fontStyle: "italic",
};

// ───────── inline expansion

const expansionShell: CSSProperties = {
  padding: "10px 12px 12px",
  borderTop: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
  display: "grid",
  gap: 8,
};

const expansionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const expansionHeaderText: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const expansionDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
};

const expansionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: COLOR.text,
};

const expansionRange: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textDim,
};

const closeBtn: CSSProperties = {
  width: 24,
  height: 24,
  minHeight: 24,
  padding: 0,
  borderRadius: 999,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.textDim,
  fontSize: 14,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  lineHeight: 1,
};

const logList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
};

const logRow: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  display: "grid",
  gridTemplateColumns: "3px 1fr auto",
  gap: 10,
  alignItems: "center",
  padding: "7px 10px",
  borderRadius: 9,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.022)",
  color: COLOR.text,
  minHeight: 36,
  boxSizing: "border-box",
};

const logRowAccent: CSSProperties = {
  width: 3,
  height: 22,
  borderRadius: 2,
};

const logRowText: CSSProperties = {
  display: "grid",
  gap: 1,
  minWidth: 0,
};

const logRowDate: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const logRowName: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const logRowTime: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textDim,
  whiteSpace: "nowrap",
};

const groupShell: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 9,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.022)",
};

const groupHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

function countBadge(accent: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: 999,
    border: `1px solid ${accent}`,
    color: accent,
    fontSize: 10.5,
    fontWeight: 900,
    letterSpacing: 0.3,
    background: "transparent",
    flexShrink: 0,
  };
}

const datePillRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
};

const datePill: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "baseline",
  gap: 5,
  padding: "3px 9px",
  borderRadius: 999,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.text,
  fontSize: 11,
  fontWeight: 700,
};

const datePillDate: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const datePillTime: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textDim,
  whiteSpace: "nowrap",
};

// ───────── floating log popover

const popTitleRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const popTitleDot: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
};

const popMeta: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
};

const popMetaLine: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const popMetaLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const popMetaValue: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  color: COLOR.text,
};

const popAction: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid rgba(51,255,122,0.42)`,
  background: COLOR.successSoft,
  color: COLOR.success,
  fontSize: 12.5,
  fontWeight: 900,
  textDecoration: "none",
  letterSpacing: 0.3,
};

// ─────────────── log report styles

const loadingShell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 4px",
  color: COLOR.textDim,
  fontSize: 12,
  fontWeight: 700,
};

const loadingDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: COLOR.success,
  animation: "homeV2Pulse 1.1s ease-in-out infinite",
};

const loadingText: CSSProperties = {};

const errorText: CSSProperties = {
  fontSize: 12,
  color: COLOR.red,
  padding: "8px 4px",
};

const reportShell: CSSProperties = {
  display: "grid",
  gap: 10,
};

const reportBlock: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.022)",
};

const reportBlockLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textDim,
};

const topLineGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
  gap: 6,
};

const topLineTile: CSSProperties = {
  display: "grid",
  gap: 1,
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
  textAlign: "center",
};

const topLineValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: COLOR.text,
  lineHeight: 1.1,
};

const topLineLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const exerciseList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 6,
};

const exerciseRow: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
};

const exerciseHead: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
};

const exerciseName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const exerciseMeta: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const exerciseSummary: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const statInline: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${COLOR.border}`,
  fontSize: 11,
  fontWeight: 800,
};

const statInlineLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const statInlineValue: CSSProperties = {
  color: COLOR.text,
};

const setStrip: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
};

const setChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${COLOR.border}`,
  fontSize: 10.5,
  fontWeight: 700,
  color: COLOR.textDim,
  letterSpacing: 0.2,
};

const smallList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 3,
};

const smallRow: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  padding: "5px 0",
  borderBottom: `1px solid rgba(255,255,255,0.04)`,
};

const smallRowText: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const smallRowMeta: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textDim,
  whiteSpace: "nowrap",
};

const smallRowFooter: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: COLOR.textFaint,
  paddingTop: 4,
};

const attemptGrid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
};

function attemptChip(outcome: string): CSSProperties {
  const sent = ["SEND", "FLASH", "ONSIGHT", "REDPOINT"].includes(outcome.toUpperCase());
  const failed = ["FALL", "FAIL"].includes(outcome.toUpperCase());
  const tone = sent ? COLOR.success : failed ? COLOR.red : COLOR.amber;
  const bg = sent ? COLOR.successSoft : failed ? COLOR.redSoft : COLOR.amberSoft;
  return {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 6,
    background: bg,
    border: `1px solid ${tone}`,
    color: tone,
    fontSize: 11,
    fontWeight: 900,
  };
}

const attemptOutcome: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "lowercase",
  opacity: 0.85,
};

const notesText: CSSProperties = {
  fontSize: 12,
  color: COLOR.text,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
};
