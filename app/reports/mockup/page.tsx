// MOCKUP — hardcoded sample data, real components. Renders what the
// monthly report would look like with the design proposed in chat. Tap
// the Print button to see how it falls on paper.
//
// Once we commit to building the real reports, this whole file goes
// away and the components get extracted into app/reports/_shared/.

"use client";

import Link from "next/link";

// ─── Sample data ─────────────────────────────────────────────────────────────

const MONTH_LABEL = "May 2026";
const MONTH_RANGE = "Apr 27 – May 31";
const PRINT_TIMESTAMP = "Printed Thu, May 21 2026";

const TOTALS = {
  sessions: 18,
  sets: 287,
  volumeLb: 41200,
  cardioMi: 38.4,
  durationMin: 24 * 60 + 35,
};

const TOTALS_DELTA = {
  sessions: +3,
  sets: +44,
  volumeLb: +6800,
  cardioMi: -2.1,
  durationMin: +180,
};

// 5 weeks × 7 days; counts ≈ session count that day.
const HEATMAP: number[][] = [
  [0, 1, 1, 0, 2, 0, 0], // week 1
  [1, 0, 1, 1, 0, 2, 0], // week 2
  [0, 1, 1, 0, 1, 1, 0], // week 3
  [1, 0, 1, 1, 1, 0, 1], // week 4
  [0, 1, 0, 0, 0, 0, 0], // week 5 (partial)
];

const DOMAIN_BREAKDOWN = [
  { domain: "Strength", color: "#fbbf24", pct: 38 },
  { domain: "Cardio", color: "#60a5fa", pct: 28 },
  { domain: "Sport", color: "#a78bfa", pct: 17 },
  { domain: "Mobility", color: "#34d399", pct: 11 },
  { domain: "Lifestyle", color: "#f87171", pct: 6 },
];

const SESSIONS_PER_WEEK = [
  { label: "Apr 27", count: 4 },
  { label: "May 4", count: 5 },
  { label: "May 11", count: 4 },
  { label: "May 18", count: 4 },
  { label: "May 25", count: 1 },
];

const FREQUENCY_GOALS = [
  { name: "Pull Strength", target: "3× / week", weekResults: [1, 1, 0, 1, 0], current: "3/3 this week" },
  { name: "Push Strength", target: "3× / week", weekResults: [1, 1, 1, 1, 0], current: "3/3 this week" },
  { name: "Legs", target: "2× / week", weekResults: [1, 0, 1, 1, 0], current: "2/2 this week" },
  { name: "Running", target: "3× / week", weekResults: [0, 1, 0, 1, 0], current: "1/3 this week" },
  { name: "Mobility", target: "1× / day", weekResults: [1, 1, 0, 0, 0], current: "behind" },
];

const TOP_EXERCISES = [
  { name: "Pull-ups", sessions: 9, sets: 36, volumeLb: 4860, trend: [3, 4, 5, 5, 6, 6, 7, 7] },
  { name: "Bench Press", sessions: 7, sets: 28, volumeLb: 8400, trend: [185, 185, 190, 195, 195, 200, 205, 210] },
  { name: "Back Squat", sessions: 6, sets: 24, volumeLb: 10560, trend: [225, 235, 235, 245, 250, 255, 260, 265] },
  { name: "Overhead Press", sessions: 5, sets: 20, volumeLb: 3200, trend: [110, 115, 115, 120, 120, 125, 125, 130] },
  { name: "Deadlift", sessions: 4, sets: 16, volumeLb: 9600, trend: [285, 295, 305, 315, 320, 325, 330, 335] },
  { name: "Pistol Squat", sessions: 4, sets: 16, volumeLb: 1280, trend: [3, 4, 4, 5, 5, 6, 7, 8] },
  { name: "Dips", sessions: 3, sets: 12, volumeLb: 1680, trend: [5, 6, 7, 8, 9, 9, 10, 10] },
];

const PRS = [
  { kind: "weight", label: "Bench Press", value: "210 lb × 3", note: "+5 lb from previous best" },
  { kind: "weight", label: "Back Squat", value: "265 lb × 5", note: "+10 lb from previous best" },
  { kind: "weight", label: "Deadlift", value: "335 lb × 1", note: "+5 lb from previous best" },
  { kind: "pace", label: "5K Run", value: "23:18", note: "0:42 faster than previous best" },
  { kind: "endurance", label: "Longest Run", value: "8.2 mi", note: "personal distance high" },
  { kind: "streak", label: "Pull Strength streak", value: "11 weeks", note: "new best" },
];

const NOTABLE_SESSIONS = [
  { date: "May 18", routine: "Heavy Pull", note: "210×3 bench PR, biggest volume day this month", volume: "8,200 lb" },
  { date: "May 11", routine: "Long Run", note: "8.2 mi at 7:42/mi avg", duration: "1:03:14" },
  { date: "May 6",  routine: "Heavy Squat", note: "265×5 squat PR", volume: "6,400 lb" },
  { date: "May 14", routine: "Climbing Session", note: "5.11a flash, project sent", duration: "2:15:00" },
  { date: "Apr 29", routine: "Deadlift Day", note: "335×1 PR", volume: "4,900 lb" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReportMockupPage() {
  return (
    <main style={pageStyle}>
      {/* MOCKUP banner — print-hidden */}
      <div className="reportPrintHide" style={mockupBannerStyle}>
        <span style={{ fontWeight: 900, letterSpacing: 0.4, textTransform: "uppercase", fontSize: 11 }}>
          Mockup · hardcoded sample data
        </span>
        <span style={{ opacity: 0.7, fontSize: 12 }}>
          Tap Print to preview how it falls on paper. Yearly would use the
          same components with month-sized cells and 12 months in the
          heatmap. Weekly drops the "compared to last" deltas and adds the
          day-by-day session detail already present at /reports/weekly.
        </span>
      </div>

      {/* Report sheet — scoped so print styles can target it */}
      <article className="reportSheet" style={sheetStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div>
            <div className="reportPrintHide" style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 8 }}>
              <Link href="/reports/mockup" style={crumbStyle}>Reports</Link>
              <span style={{ opacity: 0.35 }}>/</span>
              <span style={{ ...crumbStyle, opacity: 0.85 }}>Monthly</span>
            </div>
            <h1 style={titleStyle}>Monthly Report</h1>
            <div style={periodStyle}>
              <span style={{ fontSize: 22, fontWeight: 900 }}>{MONTH_LABEL}</span>
              <span style={{ opacity: 0.55, fontSize: 14, marginLeft: 12 }}>{MONTH_RANGE}</span>
            </div>
          </div>
          <div className="reportPrintHide" style={headerActionsStyle}>
            <button type="button" style={navBtnStyle}>← Prev</button>
            <button type="button" style={navBtnStyle}>Next →</button>
            <button
              type="button"
              style={printBtnStyle}
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
          <div className="reportPrintOnly" style={printStampStyle}>{PRINT_TIMESTAMP}</div>
        </header>

        {/* Totals */}
        <Section label="Totals">
          <div style={totalsGridStyle}>
            <TotalCard label="Sessions" value={String(TOTALS.sessions)} delta={TOTALS_DELTA.sessions} />
            <TotalCard label="Sets"     value={String(TOTALS.sets)}     delta={TOTALS_DELTA.sets} />
            <TotalCard label="Volume"   value={`${(TOTALS.volumeLb / 1000).toFixed(1)}k lb`} delta={TOTALS_DELTA.volumeLb} deltaUnit="lb" />
            <TotalCard label="Cardio"   value={`${TOTALS.cardioMi.toFixed(1)} mi`} delta={TOTALS_DELTA.cardioMi} deltaUnit="mi" deltaPrecision={1} />
            <TotalCard label="Active"   value={formatDuration(TOTALS.durationMin)} delta={TOTALS_DELTA.durationMin} deltaUnit="min" />
          </div>
          <div style={comparedLineStyle}>Δ compared to <strong>Apr 2026</strong></div>
        </Section>

        {/* Calendar + Domain breakdown — 2-col on wide, stacked on narrow */}
        <div style={twoColStyle}>
          <Section label="Activity calendar">
            <CalendarHeatmap data={HEATMAP} />
            <HeatmapLegend />
          </Section>

          <Section label="Where the work went">
            <DomainBreakdown data={DOMAIN_BREAKDOWN} />
          </Section>
        </div>

        {/* Sessions per week */}
        <Section label="Sessions per week">
          <SessionsBarChart data={SESSIONS_PER_WEEK} />
        </Section>

        {/* Frequency goals retrospective */}
        <Section label="Frequency goal hit-rate">
          <FrequencyGoalGrid goals={FREQUENCY_GOALS} />
        </Section>

        {/* PRs / highlights */}
        <Section label="Personal records & highlights">
          <PRsGrid items={PRS} />
        </Section>

        {/* Top exercises */}
        <Section label="Top exercises by volume">
          <TopExercisesTable rows={TOP_EXERCISES} />
        </Section>

        {/* Notable sessions */}
        <Section label="Notable sessions">
          <NotableSessions items={NOTABLE_SESSIONS} />
        </Section>

        {/* Footer note */}
        <div style={footerNoteStyle}>
          Personal training summary · generated from Progression Tracker
        </div>
      </article>
    </main>
  );
}

// ─── Section card ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="reportSection" style={sectionStyle}>
      <div style={sectionHeaderStyle}>{label}</div>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  );
}

// ─── Total card ──────────────────────────────────────────────────────────────

function TotalCard({
  label,
  value,
  delta,
  deltaUnit,
  deltaPrecision = 0,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaUnit?: string;
  deltaPrecision?: number;
}) {
  const positive = (delta ?? 0) > 0;
  const negative = (delta ?? 0) < 0;
  const deltaText =
    delta === undefined || delta === 0
      ? null
      : `${delta > 0 ? "+" : ""}${delta.toFixed(deltaPrecision)}${deltaUnit ? ` ${deltaUnit}` : ""}`;
  return (
    <div style={totalCardStyle}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.5, opacity: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, letterSpacing: -0.5 }}>{value}</div>
      {deltaText ? (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            marginTop: 4,
            color: positive ? "rgba(84,203,130,0.95)" : negative ? "rgba(248,113,113,0.95)" : "inherit",
          }}
        >
          {deltaText}
        </div>
      ) : null}
    </div>
  );
}

// ─── Calendar heatmap ────────────────────────────────────────────────────────

function CalendarHeatmap({ data }: { data: number[][] }) {
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const max = Math.max(2, ...data.flat());
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, alignItems: "start" }}>
      <div style={{ display: "grid", gridTemplateRows: "repeat(5, 1fr)", gap: 4, alignItems: "center" }}>
        {data.map((_, w) => (
          <span key={w} style={{ fontSize: 9, opacity: 0.55, fontWeight: 800, textAlign: "right", paddingRight: 4 }}>
            W{w + 1}
          </span>
        ))}
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {dayLabels.map((d, i) => (
            <span key={i} style={{ fontSize: 9, opacity: 0.45, fontWeight: 800, textAlign: "center" }}>{d}</span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(5, 1fr)", gap: 4 }}>
          {data.flat().map((count, i) => {
            const intensity = count === 0 ? 0 : Math.min(1, count / max);
            return (
              <div
                key={i}
                title={`${count} session${count === 1 ? "" : "s"}`}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 4,
                  background:
                    count === 0
                      ? "rgba(255,255,255,0.04)"
                      : `rgba(251,191,36,${0.25 + intensity * 0.7})`,
                  border:
                    count === 0
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid rgba(251,191,36,0.4)",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 10, opacity: 0.55 }}>
      <span>Less</span>
      <div style={{ display: "flex", gap: 3 }}>
        {[0.12, 0.3, 0.55, 0.8, 0.95].map((a, i) => (
          <div key={i} style={{
            width: 12, height: 12, borderRadius: 3,
            background: `rgba(251,191,36,${a})`,
            border: "1px solid rgba(251,191,36,0.35)"
          }} />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

// ─── Domain breakdown ────────────────────────────────────────────────────────

function DomainBreakdown({ data }: { data: { domain: string; color: string; pct: number }[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Stacked bar */}
      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        {data.map((d) => (
          <div key={d.domain} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.domain}: ${d.pct}%`} />
        ))}
      </div>
      {/* Legend rows */}
      <div style={{ display: "grid", gap: 6 }}>
        {data.map((d) => (
          <div key={d.domain} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 8, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
            <span style={{ fontSize: 13 }}>{d.domain}</span>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sessions per week (SVG bars) ────────────────────────────────────────────

function SessionsBarChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 100 / data.length;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 100 }}>
      {data.map((d, i) => {
        const h = (d.count / max) * 24;
        const x = i * barWidth + barWidth * 0.15;
        const w = barWidth * 0.7;
        const y = 26 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="rgba(132,204,255,0.85)" rx="0.5" />
            <text x={x + w / 2} y={y - 1} fontSize="2.5" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontWeight="800">{d.count}</text>
            <text x={x + w / 2} y={29} fontSize="2.2" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontWeight="700">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Frequency goals retrospective ───────────────────────────────────────────

function FrequencyGoalGrid({ goals }: { goals: typeof FREQUENCY_GOALS }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {goals.map((g) => (
        <div key={g.name} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{g.name}</div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>{g.target}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {g.weekResults.map((hit, i) => (
              <div
                key={i}
                title={`Week ${i + 1}: ${hit ? "hit" : "missed"}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: hit ? "rgba(84,203,130,0.85)" : "rgba(248,113,113,0.18)",
                  border: hit ? "1px solid rgba(84,203,130,0.55)" : "1px solid rgba(248,113,113,0.3)",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.65, minWidth: 100, textAlign: "right" }}>{g.current}</div>
        </div>
      ))}
    </div>
  );
}

// ─── PRs grid ────────────────────────────────────────────────────────────────

function PRsGrid({ items }: { items: typeof PRS }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
      {items.map((pr, i) => (
        <div key={i} style={prCardStyle}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.5 }}>
            {prKindLabel(pr.kind)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 3 }}>{pr.label}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(251,191,36,0.95)", letterSpacing: -0.3, marginTop: 6 }}>
            {pr.value}
          </div>
          <div style={{ fontSize: 11, opacity: 0.62, marginTop: 4 }}>{pr.note}</div>
        </div>
      ))}
    </div>
  );
}

function prKindLabel(kind: string) {
  if (kind === "weight") return "Heaviest lift";
  if (kind === "pace") return "Fastest pace";
  if (kind === "endurance") return "Longest";
  if (kind === "streak") return "Streak";
  return kind;
}

// ─── Top exercises table ─────────────────────────────────────────────────────

function TopExercisesTable({ rows }: { rows: typeof TOP_EXERCISES }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "rgba(255,255,255,0.45)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <th style={thStyle}>Exercise</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Sessions</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Sets</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Volume</th>
            <th style={thStyle}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <td style={tdStyle}><strong>{r.name}</strong></td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{r.sessions}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{r.sets}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{r.volumeLb.toLocaleString()} lb</td>
              <td style={{ ...tdStyle, width: 120 }}><Sparkline data={r.trend} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${20 - ((v - min) / range) * 18}`)
    .join(" ");
  const last = data[data.length - 1];
  const first = data[0];
  const up = last > first;
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: "100%", height: 22 }}>
      <polyline
        points={points}
        fill="none"
        stroke={up ? "rgba(84,203,130,0.9)" : "rgba(248,113,113,0.85)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Notable sessions ────────────────────────────────────────────────────────

function NotableSessions({ items }: { items: typeof NOTABLE_SESSIONS }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((s, i) => (
        <div key={i} style={notableRowStyle}>
          <div style={{ width: 56, fontSize: 11, fontWeight: 800, opacity: 0.55 }}>{s.date}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{s.routine}</div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{s.note}</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 700, textAlign: "right" }}>
            {s.volume ?? s.duration}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: "20px 14px 80px",
  display: "grid",
  gap: 20,
};

const mockupBannerStyle: React.CSSProperties = {
  border: "1px dashed rgba(129,140,248,0.4)",
  background: "rgba(129,140,248,0.06)",
  borderRadius: 12,
  padding: "10px 14px",
  display: "grid",
  gap: 4,
  color: "rgba(199,210,254,0.9)",
};

const sheetStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
};

const crumbStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  opacity: 0.6,
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  margin: 0,
  letterSpacing: -0.5,
};

const periodStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  marginTop: 6,
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const navBtnStyle: React.CSSProperties = {
  minHeight: 36,
  padding: "6px 12px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const printBtnStyle: React.CSSProperties = {
  ...navBtnStyle,
  border: "1px solid rgba(251,191,36,0.45)",
  background: "rgba(251,191,36,0.12)",
  color: "rgba(254,243,199,0.95)",
};

const printStampStyle: React.CSSProperties = {
  display: "none",
  fontSize: 11,
  opacity: 0.7,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "rgba(128,128,128,0.10)",
  borderBottom: "1px solid rgba(128,128,128,0.18)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const sectionBodyStyle: React.CSSProperties = {
  padding: 16,
};

const totalsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const totalCardStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const comparedLineStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 11,
  opacity: 0.55,
};

const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const prCardStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  background: "rgba(251,191,36,0.05)",
  border: "1px solid rgba(251,191,36,0.22)",
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 800,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
};

const notableRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  paddingBottom: 10,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const footerNoteStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.45,
  textAlign: "center",
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid rgba(255,255,255,0.06)",
};
