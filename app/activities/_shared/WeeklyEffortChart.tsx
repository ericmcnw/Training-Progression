"use client";

// Weekly chart with effort lenses. One card, a lens picker in the header, and
// a tap-a-week sessions panel underneath. Lenses:
//   • magnitude (optional) — the domain's own metric (Distance / Volume),
//     rendered by StackedWeeklyBarChart.
//   • Sessions (B2) — one sliver per session, hue = series, shade = effort,
//     with a peak-effort cap on each week. Shows how-much + how-hard.
//   • Effort (B1) — a line per series of the week's peak (or avg) effort.
//
// Reuses WeekSession / SessionsByWeek so the existing chart builders feed it
// unchanged (they just need to put `effort` on each session).

import { useMemo, useState, type CSSProperties } from "react";
import StackedWeeklyBarChart, { type StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import { LogDetailPopover, type OpenLog } from "@/app/_home/DomainSparklines";
import { clampEffort, effortColor } from "@/lib/strain";
import { toAppYmd } from "@/lib/dates";
import type { SessionsByWeek, WeekSession } from "./WeeklyBarChartWithSessions";

type Lens = "magnitude" | "bars" | "lines";

export default function WeeklyEffortChart({
  title,
  weekLabels,
  series,
  sessionsByWeek,
  defaultLens = "bars",
  magnitude,
  compact = false,
}: {
  title: string;
  weekLabels: string[];
  /** Series order + colors (label/color). Drives sliver hue + line colors. */
  series: StackedBarSeries[];
  sessionsByWeek: SessionsByWeek;
  defaultLens?: Lens;
  /** Optional domain-magnitude lens (Distance / Volume). When omitted the
   *  picker is just Sessions ⇄ Effort. */
  magnitude?: { label: string; series: StackedBarSeries[]; unit?: string; decimals?: number };
  compact?: boolean;
}) {
  const hasEffort = useMemo(
    () => sessionsByWeek.some((wk) => wk.some((s) => s.effort != null)),
    [sessionsByWeek],
  );

  const lenses: Lens[] = [
    ...(magnitude ? (["magnitude"] as Lens[]) : []),
    ...(hasEffort ? (["bars", "lines"] as Lens[]) : []),
  ];
  const [lens, setLens] = useState<Lens>(
    lenses.includes(defaultLens) ? defaultLens : lenses[0] ?? "bars",
  );
  const [peakMode, setPeakMode] = useState<"peak" | "avg">("peak");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [openLog, setOpenLog] = useState<OpenLog>(null);

  const lensLabel = (l: Lens) =>
    l === "magnitude" ? magnitude!.label : l === "bars" ? "Sessions" : "Effort";

  const weekSessions = selectedWeek != null ? sessionsByWeek[selectedWeek] ?? [] : null;

  return (
    <div style={shell}>
      <div style={headerRow}>
        <div style={titleStyle}>{title}</div>
        {lenses.length > 1 ? (
          <div style={lensGroup} role="tablist" aria-label="Chart view">
            {lenses.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lens === l}
                onClick={() => setLens(l)}
                style={lens === l ? lensBtnActive : lensBtn}
              >
                {lensLabel(l)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {lens === "magnitude" && magnitude ? (
        <StackedWeeklyBarChart
          title=""
          weekLabels={weekLabels}
          series={magnitude.series}
          unit={magnitude.unit}
          decimals={magnitude.decimals}
          compact={compact}
          hideTooltip
          onPinnedWeekChange={setSelectedWeek}
        />
      ) : lens === "lines" ? (
        <EffortLines
          weekLabels={weekLabels}
          series={series}
          sessionsByWeek={sessionsByWeek}
          mode={peakMode}
          onPeakModeChange={setPeakMode}
          selectedWeek={selectedWeek}
          onSelectWeek={(i) => setSelectedWeek((p) => (p === i ? null : i))}
        />
      ) : (
        <StackedWeeklyBarChart
          title=""
          weekLabels={weekLabels}
          series={series}
          unit=""
          decimals={0}
          compact={compact}
          hideTooltip
          onPinnedWeekChange={setSelectedWeek}
        />
      )}

      {selectedWeek != null ? (
        <WeekPanel
          weekLabel={weekLabels[selectedWeek] ?? "Week"}
          sessions={weekSessions ?? []}
          onClear={() => setSelectedWeek(null)}
          onSelect={(s) => setOpenLog(buildOpenLog(s))}
        />
      ) : null}
      <LogDetailPopover open={openLog} onClose={() => setOpenLog(null)} />
    </div>
  );
}

// ── B1: a line per series of weekly peak (or avg) effort ─────────────────────
function EffortLines({
  weekLabels,
  series,
  sessionsByWeek,
  mode,
  onPeakModeChange,
  selectedWeek,
  onSelectWeek,
}: {
  weekLabels: string[];
  series: StackedBarSeries[];
  sessionsByWeek: SessionsByWeek;
  mode: "peak" | "avg";
  onPeakModeChange: (m: "peak" | "avg") => void;
  selectedWeek: number | null;
  onSelectWeek: (i: number) => void;
}) {
  const N = weekLabels.length;
  const W = 320;
  const H = 132;
  const padX = 6;
  const padY = 10;
  const x = (i: number) => padX + (N <= 1 ? 0.5 : i / (N - 1)) * (W - padX * 2);
  const y = (e: number) => padY + (1 - e / 10) * (H - padY * 2);
  const stride = N > 10 ? 3 : N > 6 ? 2 : 1;

  // Only series that actually have rated/effort sessions in the window.
  const lines = useMemo(() => {
    return series
      .map((s) => {
        const pts = weekLabels.map((_, wi) => {
          const efforts = (sessionsByWeek[wi] ?? [])
            .filter((ws) => ws.seriesLabel === s.label && ws.effort != null)
            .map((ws) => ws.effort as number);
          if (efforts.length === 0) return null;
          return mode === "peak"
            ? Math.max(...efforts)
            : efforts.reduce((a, b) => a + b, 0) / efforts.length;
        });
        return { label: s.label, color: s.color, pts };
      })
      .filter((l) => l.pts.some((p) => p != null));
  }, [series, sessionsByWeek, weekLabels, mode]);

  if (lines.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", fontWeight: 600, padding: "18px 4px", textAlign: "center" }}>
        No effort ratings in this range yet — rate a few sessions to see the trend.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={lensGroup}>
          <button type="button" onClick={() => onPeakModeChange("peak")} style={mode === "peak" ? lensBtnActive : lensBtn}>Peak</button>
          <button type="button" onClick={() => onPeakModeChange("avg")} style={mode === "avg" ? lensBtnActive : lensBtn}>Avg</button>
        </div>
      </div>
      <div style={barsTrackRow}>
        <div style={yAxisCol} aria-hidden>
          <span style={yTick}>10</span>
          <span style={yTick}>0</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block", overflow: "visible" }} role="img" aria-label="Effort trend">
          {[2, 5, 8].map((g) => (
            <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {lines.map((l) => (
            <g key={l.label}>
              {segments(l.pts).map((seg, si) => (
                <polyline
                  key={si}
                  points={seg.map(({ i, v }) => `${x(i)},${y(v)}`).join(" ")}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {l.pts.map((v, i) =>
                v == null ? null : (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(v)} r={14} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSelectWeek(i)} />
                    <circle cx={x(i)} cy={y(v)} r={selectedWeek === i ? 4.5 : 2.6} fill={l.color} stroke={selectedWeek === i ? "#0b1422" : "none"} strokeWidth={1.5} pointerEvents="none" vectorEffect="non-scaling-stroke" />
                  </g>
                ),
              )}
            </g>
          ))}
        </svg>
      </div>
      <div style={xAxisRow} aria-hidden>
        <div style={{ minWidth: 20 }} />
        <div style={xAxisLabels}>
          {weekLabels.map((wk, wi) => {
            const show = wi % stride === 0 || wi === N - 1;
            return <span key={wi} style={xTick}>{show ? shortLabel(wk) : ""}</span>;
          })}
        </div>
      </div>
      {lines.length > 1 ? (
        <div style={legendRow}>
          {lines.map((l) => (
            <span key={l.label} style={legendItem}>
              <span style={{ ...legendSwatch, background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Split a points array into contiguous non-null segments for the polylines.
function segments(pts: Array<number | null>): Array<Array<{ i: number; v: number }>> {
  const out: Array<Array<{ i: number; v: number }>> = [];
  let cur: Array<{ i: number; v: number }> = [];
  pts.forEach((v, i) => {
    if (v == null) { if (cur.length) { out.push(cur); cur = []; } }
    else cur.push({ i, v });
  });
  if (cur.length) out.push(cur);
  return out;
}

// ── Sessions panel (tap a week) ──────────────────────────────────────────────
function WeekPanel({
  weekLabel,
  sessions,
  onClear,
  onSelect,
}: {
  weekLabel: string;
  sessions: WeekSession[];
  onClear: () => void;
  onSelect: (s: WeekSession) => void;
}) {
  return (
    <section style={panel} aria-label={`Sessions for week of ${weekLabel}`}>
      <header style={panelHeader}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={panelEyebrow}>Week of {weekLabel}</div>
          <div style={panelTitle}>{sessions.length} session{sessions.length === 1 ? "" : "s"}</div>
        </div>
        <button type="button" onClick={onClear} style={closeBtn}>Close</button>
      </header>
      {sessions.length === 0 ? (
        <div style={emptyState}>No sessions logged this week.</div>
      ) : (
        <div style={{ display: "grid", gap: 3 }}>
          {sessions.map((s) => {
            const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(s.performedAt);
            const day = `${weekday} ${s.performedAt.getMonth() + 1}/${s.performedAt.getDate()}`;
            return (
              <button key={s.id} type="button" onClick={() => onSelect(s)} style={rowBtn} aria-label={`Open ${s.routineName} on ${day}`}>
                <span style={{ ...stripe, background: s.seriesColor }} aria-hidden />
                <span style={rowDate}>{day}</span>
                <span style={rowName}>{s.routineName}</span>
                <span style={rowMetric}>{s.metricFormatted}</span>
                {s.effort != null ? (
                  <span style={{ ...effortChip, color: effortColor(s.effort), borderColor: `${effortColor(s.effort)}66` }}>
                    {clampEffort(s.effort)}
                  </span>
                ) : (
                  <span style={effortChipUnrated} title="Not rated">–</span>
                )}
                <span style={caret}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function buildOpenLog(session: WeekSession): OpenLog {
  const routineId = session.href ? session.href.split("/")[2] ?? "" : "";
  const ymd = toAppYmd(session.performedAt);
  const timeLabel = session.performedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return {
    log: { logId: session.id, routineId, routineName: session.routineName, performedYmd: ymd, performedTimeLabel: timeLabel },
    accent: session.seriesColor,
    label: session.seriesLabel,
  };
}
function shortLabel(label: string) {
  const i = label.indexOf("-");
  return i > 0 ? label.slice(0, i) : label;
}

// ── styles ───────────────────────────────────────────────────────────────────
const shell: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: "12px 12px 10px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.022))",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 10,
  width: "100%",
  maxWidth: 760,
  margin: "0 auto",
  minWidth: 0,
  boxSizing: "border-box",
  contain: "layout paint",
};
const headerRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const titleStyle: CSSProperties = { fontWeight: 900, fontSize: 13, opacity: 0.92, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" };
const lensGroup: CSSProperties = { display: "inline-flex", gap: 2, padding: 2, borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", flexShrink: 0 };
const lensBtn: CSSProperties = { minHeight: 28, padding: "4px 12px", borderRadius: 999, border: "none", background: "transparent", color: "inherit", fontSize: 11.5, fontWeight: 800, cursor: "pointer", opacity: 0.6 };
const lensBtnActive: CSSProperties = { ...lensBtn, background: "rgba(255,255,255,0.10)", opacity: 1 };

const barsTrackRow: CSSProperties = { display: "flex", gap: 6, alignItems: "stretch", minWidth: 0 };
const yAxisCol: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", minWidth: 20, paddingRight: 4, borderRight: "1px dashed rgba(255,255,255,0.10)" };
const yTick: CSSProperties = { fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.5)", lineHeight: 1 };

const xAxisRow: CSSProperties = { display: "flex", gap: 6, alignItems: "stretch", minWidth: 0 };
const xAxisLabels: CSSProperties = { flex: 1, display: "flex", gap: 4, minWidth: 0 };
const xTick: CSSProperties = { flex: "1 1 0", minWidth: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden" };

const legendRow: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, opacity: 0.7 };
const legendSwatch: CSSProperties = { width: 9, height: 9, borderRadius: 3, display: "inline-block" };

const panel: CSSProperties = { display: "grid", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.025)", width: "100%", minWidth: 0, boxSizing: "border-box", overflow: "hidden" };
const panelHeader: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const panelEyebrow: CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 0.7, textTransform: "uppercase", opacity: 0.55 };
const panelTitle: CSSProperties = { fontSize: 15, fontWeight: 900 };
const closeBtn: CSSProperties = { minHeight: 32, padding: "5px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "inherit", fontSize: 11, fontWeight: 800, cursor: "pointer" };
const emptyState: CSSProperties = { fontSize: 12, opacity: 0.55, fontStyle: "italic", padding: "8px 4px" };
const rowBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minHeight: 30, padding: "5px 8px 5px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", width: "100%", font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", overflow: "hidden" };
const stripe: CSSProperties = { width: 3, alignSelf: "stretch", flexShrink: 0 };
const rowDate: CSSProperties = { fontSize: 11, fontWeight: 800, opacity: 0.65, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 4 };
const rowName: CSSProperties = { flex: "2 1 0", minWidth: 0, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const rowMetric: CSSProperties = { flex: "1 1 0", minWidth: 0, fontSize: 11.5, fontWeight: 800, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const effortChip: CSSProperties = { flexShrink: 0, fontSize: 10.5, fontWeight: 900, padding: "2px 7px", borderRadius: 999, border: "1px solid", background: "rgba(255,255,255,0.03)", fontVariantNumeric: "tabular-nums" };
const effortChipUnrated: CSSProperties = { flexShrink: 0, fontSize: 10.5, fontWeight: 900, padding: "2px 8px", borderRadius: 999, border: "1px dashed rgba(148,163,184,0.4)", background: "transparent", color: "rgba(148,163,184,0.8)" };
const caret: CSSProperties = { fontSize: 14, opacity: 0.4, fontWeight: 700, paddingRight: 2, flexShrink: 0 };
