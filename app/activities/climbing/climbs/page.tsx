// My Climbs — server shell for the instant climb database. Loads every
// attempt once (single-user scale), flattens to a serializable shape with
// venue pre-resolved, and hands the whole set to ClimbsBrowser for
// client-side instant filtering. The old version re-rendered the page on
// every filter tap and stacked six pill rows in a wall; this one has a
// lightweight hub-style header and a compact three-row filter card.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { venueOf } from "@/lib/climb-types";
import { sportAccent } from "@/lib/sport-accent";
import ClimbsBrowser, {
  type BrowserAttempt,
  type ClimbsBrowserInitial,
} from "./ClimbsBrowser";

export const dynamic = "force-dynamic";

const ACCENT = sportAccent("climbing");

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClimbsBrowsePage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};

  const [allAttempts, locations, areas] = await Promise.all([
    prisma.climbAttempt.findMany({
      orderBy: { sessionLog: { performedAt: "desc" } },
      select: {
        id: true,
        grade: true,
        gradeSystem: true,
        outcome: true,
        area: true,
        areaId: true,
        climbArea: { select: { name: true } },
        notes: true,
        movesCompleted: true,
        totalMoves: true,
        sessionLogId: true,
        problemId: true,
        problem: { select: { name: true } },
        sessionLog: {
          select: {
            performedAt: true,
            routineId: true,
            climbLocation: { select: { id: true, name: true, type: true } },
            routine: {
              select: {
                name: true,
                sessionDetails: { select: { template: { select: { key: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.climbLocation.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.climbArea.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, locationId: true },
    }),
  ]);

  const attempts: BrowserAttempt[] = allAttempts.map((a) => ({
    id: a.id,
    grade: a.grade,
    gradeSystem: a.gradeSystem,
    outcome: a.outcome,
    areaId: a.areaId,
    areaName: a.climbArea?.name ?? a.area?.trim() ?? null,
    notes: a.notes,
    problemId: a.problemId,
    problemName: a.problem?.name ?? null,
    movesCompleted: a.movesCompleted,
    totalMoves: a.totalMoves,
    sessionLogId: a.sessionLogId,
    routineId: a.sessionLog.routineId,
    routineName: a.sessionLog.routine.name,
    performedAt: a.sessionLog.performedAt,
    locationId: a.sessionLog.climbLocation?.id ?? null,
    locationName: a.sessionLog.climbLocation?.name ?? null,
    venue: venueOf(
      a.sessionLog.routine.sessionDetails?.template?.key,
      a.sessionLog.climbLocation?.type ?? null
    ),
  }));

  const initial: ClimbsBrowserInitial = {
    q: getParam(searchParams, "q"),
    venue: getParam(searchParams, "venue") as ClimbsBrowserInitial["venue"],
    outcome: getParam(searchParams, "outcome") as ClimbsBrowserInitial["outcome"],
    location: getParam(searchParams, "location"),
    area: getParam(searchParams, "area"),
    grade: getParam(searchParams, "grade"),
    range: getParam(searchParams, "range") as ClimbsBrowserInitial["range"],
  };

  return (
    <div style={pageStyle}>
      <Link href="/activities/climbing" style={backLinkStyle}>← Climbing</Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Climbing</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>My Climbs</h1>
        <p style={subtitleStyle}>
          Every climb you&apos;ve logged — search and filter to find what you&apos;re after.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <Link href="/activities/climbing/map" style={siblingPillStyle}>🗺 Map</Link>
        </div>
      </header>

      <ClimbsBrowser attempts={attempts} locations={locations} areas={areas} initial={initial} />
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
