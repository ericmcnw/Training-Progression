import { prisma } from "@/lib/prisma";
import {
  climbOutcomeColor,
  climbOutcomeLabel,
  PYRAMID_OUTCOMES,
  venueOf,
} from "@/lib/climb-types";
import type { ClimbOutcome, ClimbGradeSystem } from "@/lib/climb-types";
import { buildPyramidRows, hardestGrade, type PyramidRow } from "@/lib/climb-stats";
import { SectionCard, EmptyState, StatGrid } from "./ui";

type AttemptRow = {
  id: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  sessionLogId: string;
  sessionLog: {
    performedAt: Date;
    climbLocation: {
      id: string;
      name: string;
      type: "GYM" | "CRAG";
    } | null;
    routine: {
      name: string;
      sessionDetails: {
        template: {
          key: string;
        } | null;
      } | null;
    };
  };
};

function venueForAttempt(attempt: AttemptRow): "GYM" | "CRAG" | "UNKNOWN" {
  return (
    venueOf(
      attempt.sessionLog.routine.sessionDetails?.template?.key,
      attempt.sessionLog.climbLocation?.type ?? null
    ) ?? "UNKNOWN"
  );
}

export default async function ClimbingProgressView() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  const attempts: AttemptRow[] = await prisma.climbAttempt.findMany({
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
          climbLocation: { select: { id: true, name: true, type: true } },
          routine: {
            select: {
              name: true,
              sessionDetails: {
                select: {
                  template: {
                    select: {
                      key: true,
                    },
                  },
                },
              },
            },
          },
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

  const sessionIds = new Set(attempts.map((attempt) => attempt.sessionLogId));
  const totalSessions = sessionIds.size;
  const totalAttempts = attempts.length;
  const lastPerformedAt = attempts[0]?.sessionLog.performedAt ?? null;
  const lastLabel = lastPerformedAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastPerformedAt)
    : null;

  const overallRows = buildPyramidRows(attempts);
  const indoorAttempts = attempts.filter((attempt) => venueForAttempt(attempt) === "GYM");
  const outdoorAttempts = attempts.filter((attempt) => venueForAttempt(attempt) === "CRAG");
  const unclassifiedAttempts = attempts.filter((attempt) => venueForAttempt(attempt) === "UNKNOWN");
  const indoorRows = buildPyramidRows(indoorAttempts);
  const outdoorRows = buildPyramidRows(outdoorAttempts);

  const flashOutcomes = new Set<ClimbOutcome>(["FLASH", "ONSIGHT"]);
  const sendOutcomes = new Set<ClimbOutcome>(["SEND", "REDPOINT", "FLASH", "ONSIGHT"]);
  const hardestBoulderFlash = hardestGrade(overallRows.boulderRows, flashOutcomes);
  const hardestBoulderSend = hardestGrade(overallRows.boulderRows, sendOutcomes);
  const hardestYosemiteFlash = hardestGrade(overallRows.yosemiteRows, flashOutcomes);
  const hardestYosemiteSend = hardestGrade(overallRows.yosemiteRows, sendOutcomes);

  const locationCounts = new Map<string, { name: string; sessions: Set<string> }>();
  for (const attempt of attempts) {
    if (!attempt.sessionLog.climbLocation) continue;
    const location = attempt.sessionLog.climbLocation;
    const existing = locationCounts.get(location.id) ?? { name: location.name, sessions: new Set<string>() };
    existing.sessions.add(attempt.sessionLogId);
    locationCounts.set(location.id, existing);
  }
  const locations = Array.from(locationCounts.values()).sort((a, b) => b.sessions.size - a.sessions.size);

  const venueSections = [
    {
      label: "Indoor",
      rows: indoorRows,
      maxTotal: Math.max(...indoorRows.allRows.map((row) => row.total), 1),
      sessions: new Set(indoorAttempts.map((attempt) => attempt.sessionLogId)).size,
    },
    {
      label: "Outdoor",
      rows: outdoorRows,
      maxTotal: Math.max(...outdoorRows.allRows.map((row) => row.total), 1),
      sessions: new Set(outdoorAttempts.map((attempt) => attempt.sessionLogId)).size,
    },
  ].filter((section) => section.rows.allRows.length > 0);

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
    <SectionCard title="Climbing" subtitle="Indoor and outdoor grade pyramids with attempt breakdown for the last 4 weeks.">
      <div style={{ display: "grid", gap: 16, padding: "0 2px" }}>
        <StatGrid items={statsItems} />

        {venueSections.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={pyramidLabelStyle}>Grade pyramids</div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
              {venueSections.map((section) => (
                <div
                  key={section.label}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={subLabelStyle}>
                    {section.label} {section.sessions > 0 ? `(${section.sessions} session${section.sessions !== 1 ? "s" : ""})` : ""}
                  </div>
                  {[
                    { label: "Bouldering (V)", rows: section.rows.boulderRows },
                    { label: "Sport / Trad", rows: section.rows.yosemiteRows },
                  ]
                    .filter((item) => item.rows.length > 0)
                    .map((item) => (
                      <div key={`${section.label}-${item.label}`} style={{ display: "grid", gap: 4 }}>
                        {section.rows.boulderRows.length > 0 && section.rows.yosemiteRows.length > 0 ? (
                          <div style={subLabelStyle}>{item.label}</div>
                        ) : null}
                        {[...item.rows].reverse().map((row) => (
                          <GradePyramidRow key={`${section.label}-${item.label}-${row.grade}`} row={row} maxTotal={section.maxTotal} />
                        ))}
                      </div>
                    ))}
                </div>
              ))}
            </div>
            {unclassifiedAttempts.length > 0 ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.68 }}>
                {unclassifiedAttempts.length} attempt{unclassifiedAttempts.length !== 1 ? "s were" : " was"} logged without an indoor/outdoor location, so they are not included in the split pyramids.
              </div>
            ) : null}
          </div>
        ) : null}

        {locations.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={pyramidLabelStyle}>Locations</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {locations.map((location) => (
                <span key={location.name} style={locationChipStyle}>
                  {location.name}
                  <span style={{ opacity: 0.6, fontSize: 10, fontWeight: 700 }}>
                    {" "}{location.sessions.size}x
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
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
  const barMaxPct = 72;
  const totalPct = (row.total / maxTotal) * barMaxPct;
  const segments: Array<{ outcome: ClimbOutcome; count: number }> = PYRAMID_OUTCOMES
    .map((outcome) => ({ outcome, count: row.counts[outcome] ?? 0 }))
    .filter((segment) => segment.count > 0);

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
  opacity: 0.58,
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
