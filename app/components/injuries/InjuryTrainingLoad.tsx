"use client";

// Injury timeline: the pain trend (line) stacked directly over the training
// load that hit the affected muscle group(s), BOTH on the same real date axis
// windowed to the injury (since start, capped). A vertical line at any date
// crosses the pain level and the load bar for that week, so "pain rose the week
// after load spiked" reads at a glance. Load bars stack by routine domain and
// toggle between session counts and effort-weighted load; tap a week for the
// routines that contributed.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { COLOR, RADIUS } from "@/lib/design-tokens";
import type { HeatmapDomain, InjuryHeatmapData } from "@/app/injuries/[id]/training-heatmap";
import type { CoverageDetailLog } from "@/app/progress/coverage";
import { toAppYmd } from "@/lib/dates";
import type { PainTrendPoint } from "@/app/components/injuries/PainTrendLine";

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

const TRACK_H = 64;
const PAIN_H = 104;
// viewBox width ≈ the typical rendered px width so width:100% + height:auto
// scales UNIFORMLY (round dots, sane height) while still mapping x edge-to-edge
// so the line sits over the bar columns.
const PAIN_W = 320;

function painLevelColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  return "#86EFAC";
}
function dayNum(ymd: string): number {
  return Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);
}
function weekShort(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function InjuryTrainingLoad({
  data,
  painPoints = [],
  windowStartYmd,
}: {
  data: InjuryHeatmapData;
  /** Daily pain peaks (all logs); cropped to the window here. */
  painPoints?: PainTrendPoint[];
  /** Sunday of the injury's first week — bars + pain line crop to this. */
  windowStartYmd?: string;
}) {
  const [sel, setSel] = useState<{ category: string; weekIdx: number } | null>(null);
  const [view, setView] = useState<"sessions" | "load" | "miles">("sessions");
  const [painSel, setPainSel] = useState<number | null>(null);
  // Shared window for BOTH the pain line and the bars. Default 4w — a
  // months-old injury otherwise stretches 12 weeks of bars under a few days
  // of recent pain dots, squeezing the pain into the right edge. null = the
  // full injury window (capped at the 12-week cache).
  const [rangeWeeks, setRangeWeeks] = useState<number | null>(4);

  // Crop the 12-week cache to the injury window, narrowed further by the
  // range pills. Pain + bars crop together so the timescale always matches.
  const windowCrop = windowStartYmd
    ? Math.max(0, data.weekStarts.findIndex((ws) => ws >= windowStartYmd))
    : 0;
  const rangeCrop = rangeWeeks != null ? Math.max(0, data.weekStarts.length - rangeWeeks) : 0;
  const cropStart = Math.max(windowCrop, rangeCrop);
  const weekStarts = data.weekStarts.slice(cropStart);
  const weekCount = weekStarts.length;

  const pain = painPoints.filter((p) => weekCount === 0 || p.ymd >= weekStarts[0]);

  // Shared date axis [start, end). With load bars it spans their weeks; with no
  // mapped muscle groups (pain-only) it spans windowStart → the latest pain.
  const axisStartNum = weekCount > 0 ? dayNum(weekStarts[0]) : windowStartYmd ? dayNum(windowStartYmd) : 0;
  const lastPainNum = pain.length > 0 ? dayNum(pain[pain.length - 1].ymd) + 1 : axisStartNum + 7;
  const axisEndNum = weekCount > 0 ? dayNum(weekStarts[weekCount - 1]) + 7 : Math.max(axisStartNum + 7, lastPainNum);
  const axisSpan = Math.max(1, axisEndNum - axisStartNum);
  const xFor = (ymd: string) =>
    Math.max(0, Math.min(1, (dayNum(ymd) - axisStartNum) / axisSpan)) * PAIN_W;

  const isLoad = view === "load";
  const isMiles = view === "miles";
  const catWeeks = (c: InjuryHeatmapData["categories"][number]) =>
    (isMiles ? c.milesWeeks : isLoad ? c.loadWeeks : c.weeks).slice(cropStart);
  const drWeeks = (dr: InjuryHeatmapData["categories"][number]["domains"][number]) =>
    (isMiles ? dr.milesWeeks : isLoad ? dr.loadWeeks : dr.weeks).slice(cropStart);
  const anyLoad = data.categories.some((c) => c.loadWeeks.some((n) => n > 0));
  // Miles view only appears when cardio distance actually hit this injury's
  // muscles — a shoulder injury with no mileage never shows the toggle.
  const anyMiles = data.categories.some((c) => c.milesWeeks.some((n) => n > 0));
  const globalPeak = Math.max(1, ...data.categories.flatMap((c) => catWeeks(c)));

  const presentDomains = STACK_ORDER.filter((d) =>
    data.categories.some((c) => c.domains.some((dr) => dr.domain === d && dr.totalCount > 0)),
  );

  const hasPain = pain.length > 0;
  const noMuscleMap = data.categories.length === 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* legend + range + metric toggle */}
      <div style={topRow}>
        {presentDomains.length > 0 ? (
          <div style={legendRow}>
            {presentDomains.map((d) => (
              <span key={d} style={legendItem}>
                <span style={{ ...legendSwatch, background: DOMAIN_ACCENT[d] }} />
                {DOMAIN_LABEL[d]}
              </span>
            ))}
          </div>
        ) : <span />}
        <div style={toggleGroup} role="tablist" aria-label="Window">
          {([[2, "2w"], [4, "4w"], [null, "All"]] as Array<[number | null, string]>).map(([w, lbl]) => (
            <button
              key={lbl}
              type="button"
              role="tab"
              aria-selected={rangeWeeks === w}
              onClick={() => { setRangeWeeks(w); setSel(null); setPainSel(null); }}
              style={rangeWeeks === w ? toggleBtnActive : toggleBtn}
            >
              {lbl}
            </button>
          ))}
        </div>
        {anyLoad || anyMiles ? (
          <div style={toggleGroup} role="tablist" aria-label="Bar metric">
            <button type="button" role="tab" aria-selected={!isLoad && !isMiles} onClick={() => setView("sessions")} style={!isLoad && !isMiles ? toggleBtnActive : toggleBtn}>Sessions</button>
            {anyLoad ? (
              <button type="button" role="tab" aria-selected={isLoad} onClick={() => setView("load")} style={isLoad ? toggleBtnActive : toggleBtn}>Load</button>
            ) : null}
            {anyMiles ? (
              <button type="button" role="tab" aria-selected={isMiles} onClick={() => setView("miles")} style={isMiles ? toggleBtnActive : toggleBtn}>Miles</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Pain line ──────────────────────────────────────────────────────── */}
      <PainLine
        pain={pain}
        xFor={xFor}
        sel={painSel}
        onSel={setPainSel}
        hasPain={hasPain}
        weekXs={weekStarts.slice(1).map((ws) => xFor(ws))}
      />

      {/* ── Load bars per muscle group, same date axis ─────────────────────── */}
      {noMuscleMap ? (
        <div style={emptyNote}>
          These zones aren&rsquo;t mapped to a muscle group, so there&rsquo;s no training load to line up here.
        </div>
      ) : (
        data.categories.map((category) => {
          const cw = catWeeks(category);
          const weekDomainVals: Array<Partial<Record<HeatmapDomain, number>>> = Array.from(
            { length: weekCount },
            () => ({}),
          );
          for (const dr of category.domains) {
            drWeeks(dr).forEach((v, i) => { if (v > 0) weekDomainVals[i][dr.domain] = v; });
          }
          return (
            <div key={category.slug} style={{ display: "grid", gap: 6 }}>
              <div style={muscleHeader}>
                <span style={muscleHeaderLabel}>{category.label}</span>
                <span style={muscleHeaderMeta}>
                  {category.recentCount} session{category.recentCount === 1 ? "" : "s"} · last 4w
                </span>
              </div>

              {category.totalCount === 0 ? (
                <div style={emptyNote}>No training touched this muscle group in this window.</div>
              ) : (
                <>
                  <div style={barsRow(weekCount)} role="group" aria-label={`${category.label} weekly training`}>
                    <span aria-hidden />
                    {weekStarts.map((ws, i) => {
                      const total = cw[i] ?? 0;
                      const isSel = sel?.category === category.slug && sel.weekIdx === i;
                      return (
                        <button
                          key={ws}
                          type="button"
                          onClick={() => setSel(isSel ? null : { category: category.slug, weekIdx: i })}
                          style={{ ...colBtn, ...(isSel ? colBtnSelected : null) }}
                          aria-pressed={isSel}
                          title={`Week of ${weekShort(ws)}: ${total}${isLoad ? " load" : isMiles ? " mi" : ` session${total === 1 ? "" : "s"}`}`}
                        >
                          <span style={colCount}>
                            {total > 0 ? (isLoad ? compactLoad(total) : isMiles ? compactMiles(total) : total) : ""}
                          </span>
                          <span style={track}>
                            {STACK_ORDER.map((d) => {
                              const v = weekDomainVals[i][d] ?? 0;
                              if (v <= 0) return null;
                              const h = Math.max(3, (v / globalPeak) * TRACK_H);
                              return <span key={d} style={{ height: h, background: DOMAIN_ACCENT[d], opacity: isSel || sel === null ? 1 : 0.55 }} />;
                            })}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {sel?.category === category.slug && (
                    <WeekRoutines category={category} weekIdx={sel.weekIdx + cropStart} weekStarts={data.weekStarts} />
                  )}
                </>
              )}
            </div>
          );
        })
      )}

      {/* shared x-axis date labels */}
      {weekCount > 0 ? (
        <div style={barsRow(weekCount)} aria-hidden>
          <span />
          {weekStarts.map((ws, i) => {
            const stride = weekCount > 8 ? 2 : 1;
            const show = i % stride === 0 || i === weekCount - 1;
            return (
              <span key={ws} style={axisLabel}>{show ? weekShort(ws) : ""}</span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── Pain line (date-positioned, tappable) ────────────────────────────────────
function PainLine({
  pain,
  xFor,
  sel,
  onSel,
  hasPain,
  weekXs = [],
}: {
  pain: PainTrendPoint[];
  xFor: (ymd: string) => number;
  sel: number | null;
  onSel: (i: number | null) => void;
  hasPain: boolean;
  /** X positions of week boundaries — faint gridlines that visually tie the
   *  pain plot to the weekly bar columns below (shared timescale). */
  weekXs?: number[];
}) {
  if (!hasPain) {
    return <div style={painEmpty}>No pain logged in this window.</div>;
  }
  const levels = pain.map((p) => p.level);
  let lo = Math.max(0, Math.min(...levels) - 1);
  let hi = Math.min(10, Math.max(...levels) + 1);
  if (hi - lo < 3) { hi = Math.min(10, lo + 3); lo = Math.max(0, hi - 3); }
  const mid = Math.round((lo + hi) / 2);
  const padY = 8;
  const y = (lvl: number) => padY + (1 - (lvl - lo) / (hi - lo)) * (PAIN_H - padY * 2);
  const gridLevels = [lo, mid, hi];

  const selected = sel != null ? pain[sel] : pain[pain.length - 1];
  // Single point → no line; render the callout only.
  const line = pain.length > 1 ? pain.map((p) => `${xFor(p.ymd).toFixed(1)},${y(p.level).toFixed(1)}`).join(" ") : "";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>
        <span style={{ color: painLevelColor(selected.level) }}>{selected.level}/10</span>{" "}
        <span style={{ opacity: 0.55, fontWeight: 700 }}>pain · {weekShort(selected.ymd)}{sel == null ? " (latest)" : ""}</span>
      </div>
      <div style={painAxisGrid}>
        <div style={painYAxis}>
          {[...gridLevels].reverse().map((g) => <span key={g}>{g}</span>)}
        </div>
        <svg viewBox={`0 0 ${PAIN_W} ${PAIN_H}`} width="100%" height="auto" style={{ display: "block", overflow: "visible" }} role="img" aria-label="Pain trend">
          {gridLevels.map((g) => (
            <line key={g} x1={0} x2={PAIN_W} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {weekXs.map((x, i) => (
            <line key={`wk-${i}`} x1={x} x2={x} y1={padY} y2={PAIN_H - padY} stroke="rgba(255,255,255,0.05)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {line ? (
            <polyline points={line} fill="none" stroke="rgba(248,113,113,0.7)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {pain.map((p, i) => {
            const isSel = sel == null ? i === pain.length - 1 : i === sel;
            return (
              <g key={`${p.ymd}-${i}`}>
                <circle cx={xFor(p.ymd)} cy={y(p.level)} r={20} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSel(i)} />
                <circle cx={xFor(p.ymd)} cy={y(p.level)} r={isSel ? 6 : 3.5} fill={isSel ? painLevelColor(p.level) : "rgba(248,113,113,0.85)"} stroke={isSel ? "#0b1422" : "none"} strokeWidth={1.5} pointerEvents="none" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
      </div>
      {(selected.routineName || (selected.factors?.length ?? 0) > 0) ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", paddingLeft: 24 }}>
          {selected.routineName ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>{selected.routineName}</span>
          ) : null}
          {selected.factors?.map((f) => (
            <span key={f} style={painFactorChip}>{f}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Drilldown: routines in the tapped week ───────────────────────────────────
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
      const ymd = toAppYmd(new Date(log.performedAt));
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
              {sessionMetric(log) ? <span style={logMetric}>{sessionMetric(log)}</span> : null}
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
function compactLoad(load: number): string {
  if (load >= 1000) return `${(load / 1000).toFixed(1)}k`;
  return String(load);
}
function compactMiles(mi: number): string {
  return mi >= 10 ? mi.toFixed(0) : mi.toFixed(1);
}
// Native per-session metric for the drilldown row — distance when present
// (the number that matters for cardio on an injury), else duration.
function sessionMetric(log: CoverageDetailLog): string | null {
  if (log.distanceMi && log.distanceMi > 0) return `${compactMiles(log.distanceMi)} mi`;
  if (log.durationSec && log.durationSec > 0) return `${Math.round(log.durationSec / 60)}m`;
  return null;
}
function formatWeekRange(startYmd: string, endYmdExclusive: string): string {
  const endYmd = addDaysYmd(endYmdExclusive, -1);
  const start = new Date(`${startYmd}T00:00:00.000Z`);
  const end = new Date(`${endYmd}T00:00:00.000Z`);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}

// ── styles ──────────────────────────────────────────────────────────────────
const topRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const toggleGroup: CSSProperties = { display: "inline-flex", gap: 2, padding: 2, borderRadius: 999, border: `1px solid ${COLOR.border}`, background: "rgba(255,255,255,0.03)" };
const toggleBtn: CSSProperties = { minHeight: 28, padding: "4px 12px", borderRadius: 999, border: "none", background: "transparent", color: COLOR.textDim, fontSize: 11, fontWeight: 800, cursor: "pointer" };
const toggleBtnActive: CSSProperties = { ...toggleBtn, background: "rgba(255,255,255,0.10)", color: COLOR.text };

const legendRow: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: COLOR.textDim };
const legendSwatch: CSSProperties = { width: 9, height: 9, borderRadius: 2, display: "inline-block" };

const muscleHeader: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" };
const muscleHeaderLabel: CSSProperties = { fontSize: 13, fontWeight: 900, color: COLOR.text, letterSpacing: -0.1 };
const muscleHeaderMeta: CSSProperties = { fontSize: 11, fontWeight: 700, color: COLOR.textFaint };
const emptyNote: CSSProperties = { fontSize: 12, color: COLOR.textFaint, fontStyle: "italic", padding: "4px 0" };
const painEmpty: CSSProperties = { fontSize: 12.5, color: "rgba(255,255,255,0.45)", fontWeight: 600 };

// Bars + axis share the SAME N-column grid (gap 2, left gutter matching the
// pain y-axis column) so a date lines up between the pain line and the bars.
function barsRow(n: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `22px repeat(${Math.max(1, n)}, 1fr)`,
    gap: 2,
    alignItems: "flex-end",
  };
}
const colBtn: CSSProperties = {
  appearance: "none",
  border: "1px solid transparent",
  background: "transparent",
  padding: "2px 0 0",
  margin: 0,
  cursor: "pointer",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  borderRadius: 6,
  gridColumn: "auto",
};
const colBtnSelected: CSSProperties = { border: `1px solid ${COLOR.borderStrong}`, background: "rgba(255,255,255,0.04)" };
const colCount: CSSProperties = { fontSize: 9.5, fontWeight: 900, color: COLOR.text, minHeight: 13, lineHeight: "13px", fontVariantNumeric: "tabular-nums" };
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
const axisLabel: CSSProperties = { fontSize: 9, fontWeight: 700, color: COLOR.textFaint, textAlign: "center", whiteSpace: "nowrap", minWidth: 0, overflow: "hidden" };

// Pain row shares the bars' 22px gutter + 2px gap so the line's plot area sits
// exactly over the bar columns (same left/right bounds).
const painAxisGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px 1fr",
  gap: 2,
  alignItems: "stretch",
};
const painYAxis: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "flex-end",
  fontSize: 9,
  fontWeight: 800,
  color: "rgba(255,255,255,0.4)",
  paddingBlock: 2,
};
const painFactorChip: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(251,146,60,0.4)",
  background: "rgba(251,146,60,0.10)",
  color: "#FED7AA",
};

const expandedPanel: CSSProperties = { padding: "8px 10px 10px", borderRadius: RADIUS.inner, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLOR.border}`, display: "grid", gap: 6 };
const weekRangeLabel: CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, color: COLOR.textFaint, textTransform: "uppercase" };
const emptyLogs: CSSProperties = { fontSize: 12, color: COLOR.textFaint, fontStyle: "italic" };
const logRow: CSSProperties = { display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLOR.border}`, color: "inherit", textDecoration: "none", fontSize: 12, minWidth: 0 };
const logName: CSSProperties = { flex: 1, fontWeight: 800, color: COLOR.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const logMetric: CSSProperties = { flexShrink: 0, fontSize: 11, color: "rgba(186,230,253,0.9)", fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const logHint: CSSProperties = { flexShrink: 1, fontSize: 11, color: COLOR.textDim, fontWeight: 600, maxWidth: 200, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const logDate: CSSProperties = { flexShrink: 0, fontSize: 11, color: COLOR.textFaint, fontWeight: 700, whiteSpace: "nowrap" };
const moreNote: CSSProperties = { fontSize: 11, color: COLOR.textFaint, fontStyle: "italic", textAlign: "center", padding: "4px 0" };
