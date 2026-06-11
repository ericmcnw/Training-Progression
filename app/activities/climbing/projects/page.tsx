// Projects — server shell. Runs the project rollup once over every
// named-problem attempt, decorates rows with problem + location info,
// and hands the set to ProjectsBrowser for instant client-side
// filtering. Lightweight hub-style header replaces the old TargetHeader
// chrome (section chips were noise here).

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildProjectRollup } from "@/lib/climb-stats";
import { sportAccent } from "@/lib/sport-accent";
import ProjectsBrowser, {
  type BrowserProject,
  type ProjectsBrowserInitial,
} from "./ProjectsBrowser";

export const dynamic = "force-dynamic";

const ACCENT = sportAccent("climbing");

const ACTIVE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClimbingProjectsPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const now = new Date();
  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_MS);

  const [attempts, problems, locations] = await Promise.all([
    prisma.climbAttempt.findMany({
      where: { problemId: { not: null } },
      orderBy: { sessionLog: { performedAt: "desc" } },
      select: {
        id: true,
        problemId: true,
        outcome: true,
        grade: true,
        gradeSystem: true,
        movesCompleted: true,
        totalMoves: true,
        notes: true,
        sessionLog: { select: { performedAt: true } },
      },
    }),
    prisma.climbProblem.findMany({
      select: { id: true, name: true, locationId: true },
    }),
    prisma.climbLocation.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  const rollup = buildProjectRollup(
    attempts.map((a) => ({
      id: a.id,
      problemId: a.problemId,
      outcome: a.outcome,
      grade: a.grade,
      gradeSystem: a.gradeSystem,
      movesCompleted: a.movesCompleted,
      totalMoves: a.totalMoves,
      notes: a.notes,
      performedAt: a.sessionLog.performedAt,
    })),
    { now }
  );

  const problemById = new Map(problems.map((p) => [p.id, p]));
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const projects: BrowserProject[] = rollup.map((r) => {
    const problem = problemById.get(r.problemId);
    const location = problem?.locationId ? locationById.get(problem.locationId) ?? null : null;
    return {
      problemId: r.problemId,
      problemName: problem?.name ?? "Unnamed",
      grade: r.grade,
      gradeSystem: r.gradeSystem,
      locationId: location?.id ?? null,
      locationName: location?.name ?? null,
      locationType: location?.type ?? null,
      attemptCount: r.attemptCount,
      lastAttempt: r.lastAttempt,
      bestMoves: r.bestMoves,
      lastNotes: r.lastNotes,
      isActive: r.lastAttempt >= activeCutoff,
    };
  });

  const initial: ProjectsBrowserInitial = {
    activity: getParam(searchParams, "activity") as ProjectsBrowserInitial["activity"],
    venue: getParam(searchParams, "venue") as ProjectsBrowserInitial["venue"],
    location: getParam(searchParams, "location"),
  };

  return (
    <div style={pageStyle}>
      <Link href="/activities/climbing" style={backLinkStyle}>← Climbing</Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Climbing</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>Projects</h1>
        <p style={subtitleStyle}>
          Problems you&apos;re working on — attempted, never cleanly sent.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <Link href="/activities/climbing/climbs" style={siblingPillStyle}>📋 All climbs</Link>
          <Link href="/activities/climbing/map" style={siblingPillStyle}>🗺 Map</Link>
        </div>
      </header>

      <ProjectsBrowser projects={projects} locations={locations} initial={initial} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 16,
};

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.72,
  lineHeight: 1.5,
};

const siblingPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  textDecoration: "none",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  minHeight: 34,
};
