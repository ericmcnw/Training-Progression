import type { CSSProperties } from "react";
import type { Last7DaysStats } from "./types";

// Compact "Last 7 days" snapshot strip. Three big stat cells: session
// count, total active time, total cardio miles. Sits at the very top of
// the home dashboard — an at-a-glance view of the rolling week.
export default function Last7DaysStrip({ stats }: { stats: Last7DaysStats }) {
  const minutes = Math.round(stats.totalDurationSec / 60);
  return (
    <section style={shellStyle} aria-label="Last 7 days summary">
      <div style={eyebrowStyle}>Last 7 days</div>
      <div style={gridStyle}>
        <Stat
          value={String(stats.sessions)}
          label={stats.sessions === 1 ? "session" : "sessions"}
        />
        <Stat
          value={formatMinutes(minutes)}
          label="active"
          dim={minutes === 0}
        />
        <Stat
          value={formatCardio(stats.totalCardioMi)}
          label="mi cardio"
          dim={stats.totalCardioMi === 0}
        />
      </div>
    </section>
  );
}

function Stat({ value, label, dim }: { value: string; label: string; dim?: boolean }) {
  return (
    <div style={cellStyle}>
      <div style={{ ...valueStyle, opacity: dim ? 0.42 : 1 }}>{value}</div>
      <div style={labelStyle}>{label}</div>
    </div>
  );
}

function formatMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function formatCardio(mi: number): string {
  if (mi <= 0) return "—";
  if (mi >= 100) return mi.toFixed(0);
  return mi.toFixed(1);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 16px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.55,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
};

const cellStyle: CSSProperties = {
  display: "grid",
  justifyItems: "start",
  gap: 2,
  minWidth: 0,
};

const valueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: -0.4,
  lineHeight: 1.05,
};

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
};
