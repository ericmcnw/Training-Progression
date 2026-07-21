// Injury/pain panel for rehab focuses — shown in place of the projection
// banner. The honest signal for tissue-gated work: how long it's been going,
// the latest reading, and the recent pain trend. Server component (display
// only); logging happens on /body.

import Link from "next/link";
import { formatUtcDateLabel } from "@/lib/dates";
import type { InjuryPanelData } from "@/app/focus/data";
import TodayReadingControl from "../TodayReadingControl";

// 0–10 pain → color. Green low, amber mid, red high.
function levelColor(level: number): string {
  if (level <= 2) return "#4ade80";
  if (level <= 4) return "#fbbf24";
  if (level <= 6) return "#fb923c";
  return "#f87171";
}

export default function InjuryPanel({ injury }: { injury: InjuryPanelData }) {
  const { latest, recent } = injury;

  return (
    <section style={card}>
      <div style={headRow}>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span style={title}>🩹 {injury.name}</span>
          <span style={sub}>
            active {injury.daysActive} days · since {formatUtcDateLabel(injury.startedYmd, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <Link href="/body" style={logLink}>Log / view →</Link>
      </div>

      {latest ? (
        <div style={latestRow}>
          <span style={{ ...bigLevel, color: levelColor(latest.level) }}>{latest.level}<span style={outOf}>/10</span></span>
          <div style={{ display: "grid", gap: 1 }}>
            <span style={latestMeta}>latest · {latest.context}</span>
            <span style={latestSub}>{latest.zoneLabel} · {formatUtcDateLabel(latest.ymd, { month: "short", day: "numeric" })}</span>
          </div>
          {recent.length > 1 ? <Sparkline readings={recent} /> : null}
        </div>
      ) : (
        <div style={emptyReading}>No readings yet — tap a number below to start the trend.</div>
      )}

      <TodayReadingControl zoneId={injury.primaryZoneId} current={injury.todayReadingLevel} />
    </section>
  );
}

// Compact bar sparkline of recent levels (0–10), oldest → newest.
function Sparkline({ readings }: { readings: InjuryPanelData["recent"] }) {
  return (
    <div style={spark} title="Recent readings (oldest → newest)">
      {readings.map((r, i) => (
        <span
          key={i}
          style={{
            ...sparkBar,
            height: `${Math.max(10, (r.level / 10) * 100)}%`,
            background: levelColor(r.level),
          }}
          title={`${r.level}/10 · ${formatUtcDateLabel(r.ymd, { month: "short", day: "numeric" })}`}
        />
      ))}
    </div>
  );
}

const card = {
  display: "grid",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 13,
  border: "1px solid rgba(248,113,113,0.22)",
  background: "rgba(248,113,113,0.05)",
} as const;

const headRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
} as const;

const title = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(255,255,255,0.92)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const sub = { fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)" } as const;

const logLink = {
  fontSize: 11.5,
  fontWeight: 800,
  color: "rgba(255,255,255,0.66)",
  textDecoration: "none",
  flexShrink: 0,
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
} as const;

const latestRow = { display: "flex", alignItems: "center", gap: 14 } as const;

const bigLevel = { fontSize: 30, fontWeight: 900, lineHeight: 1 } as const;
const outOf = { fontSize: 13, fontWeight: 800, opacity: 0.6 } as const;

const latestMeta = { fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,0.8)" } as const;
const latestSub = { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)" } as const;

const spark = {
  display: "flex",
  alignItems: "flex-end",
  gap: 3,
  height: 34,
  marginLeft: "auto",
  flexShrink: 0,
} as const;

const sparkBar = { width: 5, borderRadius: 2, flexShrink: 0 } as const;

const emptyReading = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "rgba(255,255,255,0.6)",
  lineHeight: 1.5,
} as const;
