import Link from "next/link";
import type { CSSProperties } from "react";
import type { MonthData } from "./data";

// MonthHeader — prev/next chevrons + label + "Today" jump button + a
// 4-stat strip below.

function monthHref(monthYmd: string) {
  return `/plan?tab=month&month=${monthYmd}`;
}

export default function MonthHeader({ data }: { data: MonthData }) {
  const todayMonthYmd = data.today.slice(0, 7);
  const onCurrentMonth = todayMonthYmd === data.monthYmd;

  return (
    <header style={shell} className="planMonthHeader">
      <div style={navRow}>
        <Link
          href={monthHref(data.prevMonthYmd)}
          replace
          aria-label="Previous month"
          style={chevron}
        >
          ‹
        </Link>
        <div style={labelCol}>
          <span style={labelText}>{data.monthLabel}</span>
        </div>
        <Link
          href={monthHref(data.nextMonthYmd)}
          replace
          aria-label="Next month"
          style={chevron}
        >
          ›
        </Link>
        {!onCurrentMonth ? (
          <Link href={monthHref(todayMonthYmd)} replace style={todayBtn}>
            Today
          </Link>
        ) : null}
      </div>

      <div style={statsRow}>
        <Stat
          label="Days logged"
          value={`${data.stats.daysLogged}/${Math.max(1, data.stats.daysWithActivity)}`}
        />
        <Stat label="Sessions" value={String(data.stats.totalSessions)} />
        <Stat label="Top domain" value={data.stats.topDomain ?? "—"} />
        <Stat label="Active cycles" value={String(data.stats.activeCycles)} />
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statTile}>
      <span style={statValue}>{value}</span>
      <span style={statLabel}>{label}</span>
    </div>
  );
}

const shell: CSSProperties = {
  display: "grid",
  gap: 10,
};

const navRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const chevron: CSSProperties = {
  width: 36,
  height: 36,
  minHeight: 36,
  padding: 0,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.78)",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  flexShrink: 0,
};

const labelCol: CSSProperties = {
  flex: 1,
  minWidth: 0,
  textAlign: "center",
};

const labelText: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const todayBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
  textDecoration: "none",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const statsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const statTile: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  textAlign: "center",
  minWidth: 0,
};

const statValue: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
