import { prisma } from "@/lib/prisma";
import { climbOutcomeColor, climbOutcomeBg, climbOutcomeLabel } from "@/lib/climb-types";
import type { ClimbOutcome, ClimbGradeSystem } from "@/lib/climb-types";
import { SectionCard, EmptyState, StatGrid } from "./ui";

function gradeSort(grade: string, system: ClimbGradeSystem): number {
  if (system === "BOULDER_V") {
    return parseInt(grade.replace(/^V/, ""), 10) ?? 0;
  }
  const m = grade.match(/^5\.(\d+)([abcd]?)$/i);
  if (!m) return 0;
  const sub = ({ "": 0, a: 0, b: 1, c: 2, d: 3 } as Record<string, number>)[m[2].toLowerCase()] ?? 0;
  return parseInt(m[1], 10) * 4 + sub;
}

const ORDERED_OUTCOMES: ClimbOutcome[] = ["FLASH", "ONSIGHT", "SEND", "REDPOINT", "FELL", "PROJECT"];

export default async function ClimbingProgressView() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  const attempts = await prisma.climbAttempt.findMany({
    where: { sessionLog: { performedAt: { gte: cutoff } } },
    select: {
      id: true,
      grade: true,
      gradeSystem: true,
      outcome: true,
      sessionLogId: true,
      sessionLog: {
        select: {
          performedAt: true,
          climbLocation: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { sessionLog: { performedAt: "desc" } },
  });

  if (attempts.length === 0) {
    return (
      <SectionCard title="Climbing" subtitle="Grade pyramid and session stats.">
        <EmptyState message="No climbing sessions in the last 4 weeks." />
      </SectionCard>
    );
  }

  const sessionIds = new Set(attempts.map((a) => a.sessionLogId));
  const totalSessions = sessionIds.size;
  const totalAttempts = attempts.length;

  const lastPerformedAt = attempts[0]?.sessionLog.performedAt;
  const lastLabel = lastPerformedAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastPerformedAt)
    : null;

  // Grade pyramid data: grade → outcome → count, per gradeSystem
  type PyramidRow = { grade: string; system: ClimbGradeSystem; counts: Partial<Record<ClimbOutcome, number>>; total: number };
  const pyramidMap = new Map<string, PyramidRow>();
  for (const a of attempts) {
    const key = `${a.gradeSystem}::${a.grade}`;
    const existing = pyramidMap.get(key) ?? { grade: a.grade, system: a.gradeSystem, counts: {}, total: 0 };
    existing.counts[a.outcome] = (existing.counts[a.outcome] ?? 0) + 1;
    existing.total++;
    pyramidMap.set(key, existing);
  }

  // Sort by grade ascending per system
  const boulderRows = Array.from(pyramidMap.values())
    .filter((r) => r.system === "BOULDER_V")
    .sort((a, b) => gradeSort(a.grade, "BOULDER_V") - gradeSort(b.grade, "BOULDER_V"));
  const yosemiteRows = Array.from(pyramidMap.values())
    .filter((r) => r.system === "YOSEMITE")
    .sort((a, b) => gradeSort(a.grade, "YOSEMITE") - gradeSort(b.grade, "YOSEMITE"));

  // Hardest flash/send
  const flashOutcomes = new Set<ClimbOutcome>(["FLASH", "ONSIGHT"]);
  const sendOutcomes = new Set<ClimbOutcome>(["SEND", "REDPOINT", "FLASH", "ONSIGHT"]);

  function hardest(rows: PyramidRow[], filter: Set<ClimbOutcome>): string | null {
    const eligible = rows.filter((r) => ORDERED_OUTCOMES.some((o) => filter.has(o) && (r.counts[o] ?? 0) > 0));
    if (eligible.length === 0) return null;
    return eligible[eligible.length - 1].grade;
  }

  const hardestBoulderFlash = hardest(boulderRows, flashOutcomes);
  const hardestBoulderSend = hardest(boulderRows, sendOutcomes);
  const hardestYosemiteFlash = hardest(yosemiteRows, flashOutcomes);
  const hardestYosemiteSend = hardest(yosemiteRows, sendOutcomes);

  // Location breakdown
  const locationCounts = new Map<string, { name: string; sessions: Set<string> }>();
  for (const a of attempts) {
    if (!a.sessionLog.climbLocation) continue;
    const loc = a.sessionLog.climbLocation;
    const existing = locationCounts.get(loc.id) ?? { name: loc.name, sessions: new Set() };
    existing.sessions.add(a.sessionLogId);
    locationCounts.set(loc.id, existing);
  }
  const locations = Array.from(locationCounts.values()).sort((a, b) => b.sessions.size - a.sessions.size);

  const allRows = [...boulderRows, ...yosemiteRows];
  const maxTotal = Math.max(...allRows.map((r) => r.total), 1);

  const statsItems = [
    { label: "Sessions (4w)", value: String(totalSessions) },
    { label: "Total climbs", value: String(totalAttempts) },
    ...(hardestBoulderFlash ? [{ label: "Best flash (V)", value: hardestBoulderFlash, accent: "rgba(251,191,36,0.9)" }] : []),
    ...(hardestBoulderSend && hardestBoulderSend !== hardestBoulderFlash ? [{ label: "Best send (V)", value: hardestBoulderSend, accent: "rgba(74,222,128,0.9)" }] : []),
    ...(hardestYosemiteFlash ? [{ label: "Best onsight", value: hardestYosemiteFlash, accent: "rgba(251,191,36,0.9)" }] : []),
    ...(hardestYosemiteSend && hardestYosemiteSend !== hardestYosemiteFlash ? [{ label: "Best send", value: hardestYosemiteSend, accent: "rgba(74,222,128,0.9)" }] : []),
    ...(lastLabel ? [{ label: "Last session", value: lastLabel }] : []),
  ];

  return (
    <SectionCard
      title="Climbing"
      subtitle="Grade pyramid and attempt breakdown — last 4 weeks."
    >
      <div style={{ display: "grid", gap: 16, padding: "0 2px" }}>
        <StatGrid items={statsItems} />

        {allRows.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={pyramidLabelStyle}>Grade pyramid</div>
            {[
              { label: "Bouldering (V)", rows: boulderRows },
              { label: "Sport / Trad", rows: yosemiteRows },
            ]
              .filter(({ rows }) => rows.length > 0)
              .map(({ label, rows }) => (
                <div key={label} style={{ display: "grid", gap: 4 }}>
                  {boulderRows.length > 0 && yosemiteRows.length > 0 && (
                    <div style={subLabelStyle}>{label}</div>
                  )}
                  {[...rows].reverse().map((row) => (
                    <GradePyramidRow key={row.grade} row={row} maxTotal={maxTotal} />
                  ))}
                </div>
              ))}
          </div>
        )}

        {locations.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={pyramidLabelStyle}>Locations</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {locations.map((loc) => (
                <span key={loc.name} style={locationChipStyle}>
                  {loc.name}
                  <span style={{ opacity: 0.6, fontSize: 10, fontWeight: 700 }}>
                    {" "}{loc.sessions.size}×
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function GradePyramidRow({
  row,
  maxTotal,
}: {
  row: { grade: string; system: ClimbGradeSystem; counts: Partial<Record<ClimbOutcome, number>>; total: number };
  maxTotal: number;
}) {
  const barMaxPct = 72; // leave room for grade label on mobile
  const totalPct = (row.total / maxTotal) * barMaxPct;

  const segments: Array<{ outcome: ClimbOutcome; count: number }> = ORDERED_OUTCOMES
    .map((o) => ({ outcome: o, count: row.counts[o] ?? 0 }))
    .filter((s) => s.count > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85, textAlign: "right" }}>{row.grade}</span>
      <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.05)", gap: 1 }}>
        {segments.map(({ outcome, count }) => {
          const segPct = (count / row.total) * totalPct;
          return (
            <div
              key={outcome}
              title={`${climbOutcomeLabel(outcome, row.system)}: ${count}`}
              style={{
                width: `${segPct}%`,
                background: climbOutcomeColor(outcome),
                minWidth: count > 0 ? 4 : 0,
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
      <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, minWidth: 22, textAlign: "right" }}>{row.total}</span>
    </div>
  );
}

const pyramidLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const subLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.45,
  marginTop: 4,
};

const locationChipStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(78,148,255,0.1)",
  border: "1px solid rgba(78,148,255,0.2)",
  display: "inline-flex",
  gap: 4,
  alignItems: "center",
};
