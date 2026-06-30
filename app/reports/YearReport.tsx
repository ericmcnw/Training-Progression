import type { CSSProperties } from "react";
import { addDaysYmd, diffYmdDays, toAppYmd } from "@/lib/dates";
import { formatHoursMinutes } from "@/lib/progress";
import { domainColor } from "@/lib/routines";
import {
  ymdWeekday,
  PROFILE_DOMAIN_LABELS as DOMAIN_LABELS,
  PROFILE_DOMAIN_ORDER as DOMAIN_ORDER,
  type ProfileDomain as Domain,
} from "@/lib/profile-summary";
import { resolvePeriod, type Period } from "@/lib/reports/period";
import { loadReportLogs } from "@/lib/reports/load";
import { loadReportTotals } from "@/lib/reports/totals";
import { delta, summarize } from "@/lib/reports/aggregate";
import {
  buildNumbers,
  countChip,
  DeltaChips,
  DomainBar,
  KpiStrip,
  NumbersGrid,
  pctChip,
  body,
  emptyBody,
  panel,
  panelHeader,
  sectionLabel,
  type NumberRow,
} from "./_ui";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function YearReport({ period }: { period: Period }) {
  const todayYmd = toAppYmd(new Date());
  const year = Number(period.key);
  const totalDays = isLeapYear(year) ? 366 : 365;
  const currentMonthIdx = period.isCurrent ? Number(todayYmd.slice(5, 7)) - 1 : 11;
  const daysElapsed = period.isCurrent
    ? Math.min(diffYmdDays(todayYmd, `${year}-01-01`) + 1, totalDays)
    : totalDays;

  const logs = await loadReportLogs(period);
  const cur = summarize(logs);

  if (cur.sessions === 0) {
    return (
      <section style={panel}>
        <div style={panelHeader}>{period.label}</div>
        <div style={emptyBody}>No sessions logged this year.</div>
      </section>
    );
  }

  const prevPeriod = resolvePeriod("year", period.prevKey);
  const [prevLogs, totals] = await Promise.all([
    loadReportLogs(prevPeriod),
    loadReportTotals(logs.map((l) => l.id)),
  ]);
  const prev = summarize(prevLogs);

  // ── Month buckets (domain-stacked trend bars) ─────────────────────────────
  const monthBuckets = MONTH_LABELS.map((label, i) => ({
    label,
    total: 0,
    byDomain: { strength: 0, cardio: 0, mobility: 0, sport: 0, lifestyle: 0 } as Record<Domain, number>,
    isFuture: period.isCurrent && i > currentMonthIdx,
  }));
  for (const l of logs) {
    const m = Number(toAppYmd(l.performedAt).slice(5, 7)) - 1;
    monthBuckets[m].total++;
    monthBuckets[m].byDomain[l.domain]++;
  }
  const maxMonthTotal = Math.max(1, ...monthBuckets.map((m) => m.total));

  let bestMonth: { label: string; total: number } | null = null;
  for (const m of monthBuckets) if (m.total > (bestMonth?.total ?? 0)) bestMonth = m;

  // ── Year heatmap weeks ────────────────────────────────────────────────────
  type HeatCell = { ymd: string; count: number; isToday: boolean } | null;
  const weeks: HeatCell[][] = [];
  let week: HeatCell[] = [];
  const firstDow = ymdWeekday(`${year}-01-01`);
  for (let i = 0; i < firstDow; i++) week.push(null);
  for (let d = 0; d < totalDays; d++) {
    const ymd = addDaysYmd(`${year}-01-01`, d);
    week.push({ ymd, count: cur.dayCounts.get(ymd) ?? 0, isToday: period.isCurrent && ymd === todayYmd });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  const maxDayCount = Math.max(0, ...Array.from(cur.dayCounts.values()));

  const numbers: NumberRow[] = [...buildNumbers(cur, totals)];
  if (bestMonth && bestMonth.total > 0) {
    numbers.unshift({ label: "Best month", value: bestMonth.label, sub: `${bestMonth.total} sessions`, accent: "rgba(250,204,21,0.95)" });
  }

  return (
    <section style={panel}>
      <div style={panelHeader}>{period.label}</div>
      <div style={body}>
        <KpiStrip
          items={[
            { label: "Sessions", value: String(cur.sessions) },
            { label: "Time", value: cur.totalSec > 0 ? formatHoursMinutes(cur.totalSec) : "—" },
            { label: "Distance", value: cur.totalMi > 0 ? `${cur.totalMi.toFixed(0)}mi` : "—" },
            { label: "Active", value: `${cur.activeDays}/${daysElapsed}` },
          ]}
        />

        {prev.sessions > 0 && (
          <div>
            <div style={sectionLabel}>VS LAST YEAR</div>
            <DeltaChips
              items={[
                countChip("Sessions", delta(cur.sessions, prev.sessions)),
                pctChip("Load", delta(cur.load, prev.load)),
                pctChip("Time", delta(cur.totalSec, prev.totalSec)),
                pctChip("Distance", delta(cur.totalMi, prev.totalMi)),
              ]}
            />
          </div>
        )}

        {/* Year heatmap */}
        <div>
          <div style={sectionLabel}>YEAR HEATMAP</div>
          <div style={heatScroll}>
            <div style={heatGrid}>
              {weeks.map((wk, wi) =>
                wk.map((cell, di) =>
                  cell ? (
                    <span
                      key={cell.ymd}
                      style={heatCellStyle(intensityLevel(cell.count, maxDayCount), cell.isToday)}
                      title={`${cell.ymd} — ${cell.count} session${cell.count === 1 ? "" : "s"}`}
                    />
                  ) : (
                    <span key={`pad-${wi}-${di}`} style={heatPad} aria-hidden />
                  )
                )
              )}
            </div>
          </div>
        </div>

        {/* Monthly trend bars */}
        <div>
          <div style={sectionLabel}>BY MONTH</div>
          <div style={{ display: "grid", gap: 4 }}>
            {monthBuckets.map((m) => (
              <div key={m.label} style={monthBarRow(m.isFuture)}>
                <span style={monthBarLabel}>{m.label}</span>
                <div style={monthBarTrack}>
                  <div style={{ ...monthBarFill, width: `${m.total === 0 ? 0 : (m.total / maxMonthTotal) * 100}%` }}>
                    {DOMAIN_ORDER.map((d) =>
                      m.byDomain[d] > 0 ? (
                        <div key={d} style={{ flex: m.byDomain[d], background: domainColor(d) }} />
                      ) : null
                    )}
                  </div>
                </div>
                <span style={monthBarCount(m.isFuture)}>{m.total > 0 ? m.total : "—"}</span>
              </div>
            ))}
          </div>
          <div style={domainLegend}>
            {DOMAIN_ORDER.filter((d) => monthBuckets.some((m) => m.byDomain[d] > 0)).map((d) => (
              <div key={d} style={legendItem}>
                <span style={{ ...legendDot, background: domainColor(d) }} aria-hidden />
                <span style={legendLabel}>{DOMAIN_LABELS[d]}</span>
              </div>
            ))}
          </div>
        </div>

        <DomainBar perDomain={cur.perDomain} activeDomains={cur.activeDomains} total={cur.sessions} />

        <NumbersGrid title="THIS YEAR IN NUMBERS" rows={numbers} />
      </div>
    </section>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function intensityLevel(count: number, maxCount: number): number {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= Math.ceil(maxCount * 0.33)) return 2;
  if (count <= Math.ceil(maxCount * 0.66)) return 3;
  return 4;
}

// ── styles (ported from YearlySummary) ──────────────────────────────────────

const heatScroll: CSSProperties = { overflowX: "auto", paddingBottom: 4 };

const heatGrid: CSSProperties = {
  display: "grid",
  gridTemplateRows: "repeat(7, 1fr)",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(6px, 1fr)",
  gap: 2,
  minWidth: 340,
};

const heatPad: CSSProperties = { aspectRatio: "1 / 1", background: "transparent" };

const HEAT_BG = [
  "rgba(255,255,255,0.05)",
  "rgba(51,255,122,0.18)",
  "rgba(51,255,122,0.35)",
  "rgba(51,255,122,0.65)",
  "rgba(51,255,122,0.95)",
] as const;

function heatCellStyle(lvl: number, isToday: boolean): CSSProperties {
  return {
    aspectRatio: "1 / 1",
    borderRadius: 2,
    background: HEAT_BG[lvl],
    border: isToday ? "1.5px solid rgba(51,255,122,1)" : "1px solid rgba(255,255,255,0.04)",
    boxSizing: "border-box",
  };
}

function monthBarRow(isFuture: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "32px 1fr 32px",
    alignItems: "center",
    gap: 8,
    opacity: isFuture ? 0.4 : 1,
  };
}

const monthBarLabel: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 0.3, color: "rgba(255,255,255,0.75)" };
const monthBarTrack: CSSProperties = { height: 12, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" };
const monthBarFill: CSSProperties = { height: "100%", display: "flex", borderRadius: 999, overflow: "hidden" };
function monthBarCount(isFuture: boolean): CSSProperties {
  return { fontSize: 11, fontWeight: 900, color: isFuture ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.95)", textAlign: "right" };
}

const domainLegend: CSSProperties = { marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5 };
const legendDot: CSSProperties = { width: 8, height: 8, borderRadius: 999, flexShrink: 0 };
const legendLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" };
