import type { CSSProperties } from "react";
import { domainColor } from "@/lib/routines";
import {
  PROFILE_DOMAIN_LABELS as DOMAIN_LABELS,
  type ProfileDomain as Domain,
} from "@/lib/profile-summary";
import { formatHoursMinutes } from "@/lib/progress";
import type { Delta, ReportSummary } from "@/lib/reports/aggregate";
import type { ReportTotals } from "@/lib/reports/totals";

// Shared presentational pieces for the Month + Year reports. Pure (no hooks),
// so usable from server components. Style tokens match the existing report /
// profile-summary chrome.

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={kpiTile}>
      <div style={kpiValue}>{value}</div>
      <div style={kpiLabel}>{label}</div>
    </div>
  );
}

export function KpiStrip({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div style={kpiRow}>
      {items.map((it) => (
        <Kpi key={it.label} label={it.label} value={it.value} />
      ))}
    </div>
  );
}

export type DeltaChip = { label: string; text: string; dir: "up" | "down" | "flat" };

const DIR_COLOR: Record<DeltaChip["dir"], string> = {
  up: "rgba(74,222,128,0.95)",
  down: "rgba(248,113,113,0.95)",
  flat: "rgba(255,255,255,0.5)",
};
const DIR_ARROW: Record<DeltaChip["dir"], string> = { up: "▲", down: "▼", flat: "–" };

export function DeltaChips({ items }: { items: DeltaChip[] }) {
  return (
    <div style={deltaRow}>
      {items.map((it) => (
        <div key={it.label} style={deltaChip}>
          <span style={deltaChipLabel}>{it.label}</span>
          <span style={{ ...deltaChipValue, color: DIR_COLOR[it.dir] }}>
            {DIR_ARROW[it.dir]} {it.text}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DomainBar({
  perDomain,
  activeDomains,
  total,
}: {
  perDomain: Record<Domain, number>;
  activeDomains: Domain[];
  total: number;
}) {
  if (activeDomains.length === 0 || total === 0) return null;
  return (
    <div>
      <div style={sectionLabel}>BY DOMAIN</div>
      <div style={stackTrack} aria-hidden>
        {activeDomains.map((d) => (
          <div
            key={d}
            title={`${DOMAIN_LABELS[d]}: ${perDomain[d]}`}
            style={{ width: `${(perDomain[d] / total) * 100}%`, background: domainColor(d) }}
          />
        ))}
      </div>
      <div style={domainLegend}>
        {activeDomains.map((d) => (
          <div key={d} style={legendItem}>
            <span style={{ ...legendDot, background: domainColor(d) }} aria-hidden />
            <span style={legendLabel}>{DOMAIN_LABELS[d]}</span>
            <span style={legendCount}>{perDomain[d]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type NumberRow = { label: string; value: string; sub?: string; accent?: string };

export function NumbersGrid({ title, rows }: { title: string; rows: NumberRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div style={sectionLabel}>{title}</div>
      <div style={numbersGrid}>
        {rows.map((r) => (
          <div key={r.label} style={numberTile}>
            <div style={numberTileLabel}>{r.label}</div>
            <div style={{ ...numberTileValue, color: r.accent ?? "inherit" }}>{r.value}</div>
            {r.sub ? <div style={numberTileSub}>{r.sub}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── shared "in numbers" rows + delta chips (Month + Year share these) ───────

export function fmtVolume(lb: number): string {
  return lb >= 1000 ? `${(lb / 1000).toFixed(1)}k lb` : `${Math.round(lb).toLocaleString()} lb`;
}

export function buildNumbers(cur: ReportSummary, totals: ReportTotals): NumberRow[] {
  const rows: NumberRow[] = [];
  if (cur.load > 0) rows.push({ label: "Training load", value: Math.round(cur.load).toLocaleString() });
  if (cur.totalMi > 0) rows.push({ label: "Distance", value: `${cur.totalMi.toFixed(1)} mi`, accent: "rgba(96,165,250,0.95)" });
  if (cur.totalElevFt > 0) rows.push({ label: "Elevation", value: `${cur.totalElevFt.toLocaleString()} ft` });
  if (totals.climbSends > 0) {
    rows.push({ label: "Climb sends", value: String(totals.climbSends), accent: "rgba(74,222,128,0.95)" });
    if (totals.hardestBoulder) rows.push({ label: "Hardest boulder", value: totals.hardestBoulder, accent: "rgba(74,222,128,0.95)" });
    if (totals.hardestRope) rows.push({ label: "Hardest rope", value: totals.hardestRope, accent: "rgba(74,222,128,0.95)" });
  }
  if (totals.strengthVolumeLb > 0) {
    rows.push({
      label: "Volume lifted",
      value: fmtVolume(totals.strengthVolumeLb),
      sub: `${totals.strengthSets.toLocaleString()} sets`,
      accent: "rgba(251,146,60,0.95)",
    });
  }
  if (cur.longestStreak >= 2) rows.push({ label: "Longest streak", value: `${cur.longestStreak}d` });
  if (cur.longest && (cur.longest.durationSec ?? 0) > 0) {
    rows.push({ label: "Longest session", value: formatHoursMinutes(cur.longest.durationSec!), sub: cur.longest.routine.name });
  }
  if (cur.furthest && (cur.furthest.distanceMi ?? 0) > 0) {
    rows.push({ label: "Furthest", value: `${cur.furthest.distanceMi!.toFixed(1)} mi`, sub: cur.furthest.routine.name, accent: "rgba(96,165,250,0.95)" });
  }
  return rows;
}

export function countChip(label: string, d: Delta): DeltaChip {
  return { label, text: `${d.diff >= 0 ? "+" : ""}${d.diff}`, dir: d.dir };
}

export function pctChip(label: string, d: Delta): DeltaChip {
  const text = d.pct !== null ? `${d.diff >= 0 ? "+" : ""}${Math.round(d.pct)}%` : "new";
  return { label, text, dir: d.dir };
}

// ── style tokens (exported for the report bodies) ───────────────────────────

export const panel: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

export const panelHeader: CSSProperties = {
  padding: "8px 16px",
  background: "rgba(128,128,128,0.11)",
  borderBottom: "1px solid rgba(128,128,128,0.2)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

export const body: CSSProperties = { padding: 14, display: "grid", gap: 18 };

export const emptyBody: CSSProperties = {
  padding: 18,
  fontSize: 13,
  color: "rgba(255,255,255,0.6)",
  fontStyle: "italic",
};

export const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  marginBottom: 8,
};

const kpiRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const kpiTile: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "10px 8px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
  minWidth: 0,
};

const kpiValue: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.05,
  color: "rgba(255,255,255,0.95)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const kpiLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.5)",
  textTransform: "uppercase",
};

const deltaRow: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const deltaChip: CSSProperties = {
  display: "grid",
  gap: 1,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  minWidth: 0,
};

const deltaChipLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
};

const deltaChipValue: CSSProperties = { fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" };

const stackTrack: CSSProperties = {
  display: "flex",
  width: "100%",
  height: 10,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255,255,255,0.05)",
};

const domainLegend: CSSProperties = { marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5 };
const legendDot: CSSProperties = { width: 8, height: 8, borderRadius: 999, flexShrink: 0 };
const legendLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" };
const legendCount: CSSProperties = { fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.95)" };

const numbersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
  gap: 8,
};

const numberTile: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "12px 12px",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 3,
};

const numberTileLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};

const numberTileValue: CSSProperties = { fontSize: 20, fontWeight: 900, lineHeight: 1.1 };
const numberTileSub: CSSProperties = {
  fontSize: 11,
  opacity: 0.62,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
