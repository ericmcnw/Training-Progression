import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PERIOD_KINDS, type Period, type PeriodKind } from "@/lib/reports/period";

// Nav chrome shared by every report period. Pure presentational + Link-based —
// no client interactivity. Tabs switch period kind (always to the current
// period of that kind); the stepper pages this kind backward/forward through
// time. Prev disables when there's no data before this period; next disables
// in the future (period.nextKey === null).

const KIND_LABELS: Record<PeriodKind, string> = {
  week: "Week",
  month: "Month",
  year: "Year",
};

const JUMP_LABELS: Record<PeriodKind, string> = {
  week: "This week",
  month: "This month",
  year: "This year",
};

function hrefFor(kind: PeriodKind, key: string | null): string {
  return key ? `/reports/${kind}?${kind}=${key}` : `/reports/${kind}`;
}

export default function ReportShell({
  period,
  earliestMs,
  children,
}: {
  period: Period;
  earliestMs: number | null;
  children: ReactNode;
}) {
  // Disable prev when no logged data exists before this period's start.
  const prevDisabled = earliestMs === null || earliestMs >= period.start.getTime();

  return (
    <div style={shell}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/profile" style={backLink}>← Profile</Link>
        <Link href="/" style={backLink}>Dashboard</Link>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Reports</h1>

      {/* Period-kind tabs */}
      <div style={tabRow} role="tablist" aria-label="Report period">
        {PERIOD_KINDS.map((k) => {
          const active = k === period.kind;
          return (
            <Link
              key={k}
              href={hrefFor(k, null)}
              role="tab"
              aria-selected={active}
              style={active ? { ...tab, ...tabActive } : tab}
            >
              {KIND_LABELS[k]}
            </Link>
          );
        })}
      </div>

      {/* Prev / label / next stepper */}
      <div style={stepper}>
        {prevDisabled ? (
          <span style={{ ...navBtn, ...navDisabled }} aria-disabled>← Prev</span>
        ) : (
          <Link href={hrefFor(period.kind, period.prevKey)} style={navBtn}>← Prev</Link>
        )}

        <div style={labelBox}>
          <span style={periodLabel}>{period.label}</span>
          {!period.isCurrent && (
            <Link href={hrefFor(period.kind, null)} style={jumpLink}>
              {JUMP_LABELS[period.kind]}
            </Link>
          )}
        </div>

        {period.nextKey ? (
          <Link href={hrefFor(period.kind, period.nextKey)} style={navBtn}>Next →</Link>
        ) : (
          <span style={{ ...navBtn, ...navDisabled }} aria-disabled>Next →</span>
        )}
      </div>

      {children}
    </div>
  );
}

const shell: CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "16px 12px",
  display: "grid",
  gap: 16,
};

const backLink: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.2)",
  background: "rgba(128,128,128,0.06)",
};

const tabRow: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  padding: 4,
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.22)",
  background: "rgba(128,128,128,0.06)",
  width: "fit-content",
};

const tab: CSSProperties = {
  padding: "8px 18px",
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  color: "inherit",
  opacity: 0.6,
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
};

const tabActive: CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  opacity: 1,
};

const stepper: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const navBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.24)",
  background: "rgba(128,128,128,0.08)",
  textDecoration: "none",
  color: "inherit",
  whiteSpace: "nowrap",
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
};

const navDisabled: CSSProperties = {
  opacity: 0.25,
  pointerEvents: "none",
};

const labelBox: CSSProperties = {
  display: "grid",
  gap: 2,
  justifyItems: "center",
  textAlign: "center",
  flex: 1,
  minWidth: 0,
};

const periodLabel: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const jumpLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.6,
  textDecoration: "none",
  color: "rgba(84,203,130,0.95)",
};
