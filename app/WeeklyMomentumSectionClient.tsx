"use client";

import Link from "next/link";
import { formatAppDate, formatUtcDateLabel } from "@/lib/dates";

function addDays(ymd: string, plus: number) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + plus);
  return date.toISOString().slice(0, 10);
}

function formatShortWeekRangeLabel(startYmd: string) {
  const endYmd = addDays(startYmd, 6);
  const start = formatUtcDateLabel(startYmd, { month: "numeric", day: "numeric" });
  const end = formatUtcDateLabel(endYmd, { month: "numeric", day: "numeric" });
  return `${start}-${end}`;
}

function formatWeeklyPointTooltip(week: {
  label: string;
  sessions: number;
  miles: number;
  logs: Array<{ routineName: string; performedAt: string }>;
}) {
  const header = `${formatShortWeekRangeLabel(week.label)}\n${week.sessions} logs - ${week.miles.toFixed(1)} mi`;
  if (week.logs.length === 0) return `${header}\nNo sessions logged`;

  const details = week.logs.map((log) => {
    const dateLabel = formatAppDate(log.performedAt, { month: "numeric", day: "numeric" });
    return `${dateLabel}: ${log.routineName}`;
  });
  return `${header}\n${details.join("\n")}`;
}

function formatLastCompletedLabel(date: string | null) {
  if (!date) return "Never completed";
  return `Last completed ${formatAppDate(date, { month: "short", day: "numeric" })}`;
}

function SessionFractionRing({ current, target }: { current: number; target: number }) {
  const size = 86;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? current / target : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(128,128,128,0.25)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(84,203,130,0.95)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>
          {current}/{target}
        </div>
        <div style={{ fontSize: 10, opacity: 0.72 }}>sessions</div>
      </div>
    </div>
  );
}

export default function WeeklyMomentumSectionClient({
  weekDateRangeLabel,
  weekLoggedTotal,
  weekSessionTargetTotal,
  totalWeeklyCardioMiles,
  cardioTypeGroups,
  weeklySeries,
  weeklySparkPoints,
  recentCompletions,
  needsAttention,
}: {
  weekDateRangeLabel: string;
  weekLoggedTotal: number;
  weekSessionTargetTotal: number;
  totalWeeklyCardioMiles: number;
  cardioTypeGroups: Array<{
    type: string;
    miles: number;
    items: Array<{ id: string; name: string; miles: number; logs: number }>;
  }>;
  weeklySeries: Array<{
    label: string;
    sessions: number;
    miles: number;
    logs: Array<{ routineName: string; performedAt: string }>;
  }>;
  weeklySparkPoints: Array<{ x: number; y: number }>;
  recentCompletions: Array<{ id: string; name: string; lastCompletedAt: string | null }>;
  needsAttention: Array<{ id: string; name: string; lastCompletedAt: string | null }>;
}) {
  return (
    <section style={panel}>
      <div style={panelHeader}>WEEKLY MOMENTUM</div>
      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="mobileHomeWeeklyHeader" style={weeklySubheaderRow}>
            <div style={weeklySubheader}>This Week</div>
            <SessionFractionRing current={weekLoggedTotal} target={weekSessionTargetTotal} />
          </div>
          <div style={sectionSub}>{weekDateRangeLabel}</div>
        </div>

        <div style={mileageBand}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Weekly Cardio Mileage</div>
            <div style={sectionSub}>Combined miles from all cardio routines this week.</div>
          </div>
          <div style={mileageValue}>{totalWeeklyCardioMiles.toFixed(1)} mi</div>
          <details style={cardioDetails}>
            <summary data-collapsible-summary style={cardioSummary}>
              Show cardio routine breakdown
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {cardioTypeGroups.length === 0 && <div style={emptyState}>No cardio logged this week.</div>}
              {cardioTypeGroups.map((group) => (
                <div key={group.type} style={cardioGroupCard}>
                  <div className="mobileHomeCardioRow" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{group.type}</div>
                    <div style={cardioMilesPill}>{group.miles.toFixed(1)} mi</div>
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {group.items.map((item) => (
                      <div key={item.id} style={cardioRoutineRow}>
                        <span>{item.name}</span>
                        <span>{item.miles.toFixed(1)} mi ({item.logs} logs)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div style={sparkCard}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Last 4 Weeks</div>
            <div style={sectionSub}>Session count trend with weekly dots you can hover for the session list.</div>
          </div>
          <svg width="100%" height="84" viewBox="0 0 220 84" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="rgba(84,203,130,0.95)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={weeklySparkPoints.map((point) => `${point.x},${point.y}`).join(" ")}
            />
            {weeklySparkPoints.map((point, index) => {
              const week = weeklySeries[index];
              if (!week) return null;
              return (
                <g key={week.label}>
                  <title>{formatWeeklyPointTooltip(week)}</title>
                  <circle cx={point.x} cy={point.y} r="9" fill="transparent" style={{ cursor: "pointer" }} />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                    fill="rgba(84,203,130,0.98)"
                    stroke="rgba(246,252,248,0.96)"
                    strokeWidth="1.5"
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="mobileHomeSparkMeta" style={sparkMetaRow}>
            {weeklySeries.map((item) => (
              <div key={item.label} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, opacity: 0.66 }}>{formatShortWeekRangeLabel(item.label)}</div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{item.sessions} logs</div>
                <div style={{ fontSize: 11, opacity: 0.74 }}>{item.miles.toFixed(1)} mi</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link
            href="/reports/week"
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 14px",
              borderRadius: 10,
              border: "1px solid rgba(84,203,130,0.3)",
              background: "rgba(84,203,130,0.08)",
              color: "rgba(84,203,130,0.95)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            View Weekly Report →
          </Link>
        </div>

        <div className="mobileHomeTwoCol" style={twoColGrid}>
          <div style={subPanel}>
            <div style={subPanelTitle}>Recently Completed</div>
            <div style={{ display: "grid", gap: 8 }}>
              {recentCompletions.length === 0 && <div style={emptyState}>No routines completed yet.</div>}
              {recentCompletions.map((item) => (
                <div key={item.id} style={miniCardSuccess}>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={miniCardMeta}>{formatLastCompletedLabel(item.lastCompletedAt)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={subPanel}>
            <div style={subPanelTitle}>Needs Attention</div>
            <div style={{ display: "grid", gap: 8 }}>
              {needsAttention.length === 0 && <div style={emptyState}>Everything has been completed recently.</div>}
              {needsAttention.map((item) => (
                <div key={item.id} style={miniCardWarn}>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={miniCardMeta}>{formatLastCompletedLabel(item.lastCompletedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const panel: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
};

const panelHeader: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const sectionSub: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.68,
};

const sparkCard: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(84,203,130,0.10), rgba(76,163,255,0.06) 45%, rgba(255,255,255,0.02))",
  display: "grid",
  gap: 10,
};

const mileageBand: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(76,163,255,0.24)",
  background: "linear-gradient(135deg, rgba(76,163,255,0.12), rgba(84,203,130,0.07))",
  display: "grid",
  gap: 10,
};

const mileageValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  lineHeight: 1,
};

const cardioDetails: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 10,
};

const cardioSummary: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
};

const cardioGroupCard: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
};

const cardioMilesPill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(76,163,255,0.14)",
  border: "1px solid rgba(76,163,255,0.35)",
  fontSize: 11,
  fontWeight: 900,
};

const cardioRoutineRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
  opacity: 0.88,
};

const sparkMetaRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const twoColGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const weeklySubheader: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const weeklySubheaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const subPanel: React.CSSProperties = {
  borderRadius: 16,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 10,
};

const subPanelTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const miniCardSuccess: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(84,203,130,0.42)",
  background: "rgba(84,203,130,0.08)",
};

const miniCardWarn: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,199,92,0.42)",
  background: "rgba(255,199,92,0.08)",
};

const miniCardMeta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  opacity: 0.78,
};

const emptyState: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.64,
};
