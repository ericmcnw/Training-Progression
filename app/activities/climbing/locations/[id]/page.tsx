// Location detail page — the centerpiece of the climbing UX. Aggregates
// everything we know about one ClimbLocation: hero stats, mini-map, scoped
// pyramid, photos, problem library, session history, and management
// actions.
//
// Single parallel data load. All filtering / grouping happens in-memory
// using helpers from lib/climb-stats. Mobile layout stacks vertically;
// desktop (>=980px) splits hero info into two columns via the
// .climbing-detail-grid class in app/globals.css.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  climbOutcomeLabel,
  gradeSort,
  PYRAMID_OUTCOMES,
  SENT_OUTCOMES,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";
import {
  buildPyramidRows,
  buildProjectRollup,
  hardestGrade,
  summarizeAttempts,
  type PyramidRow,
} from "@/lib/climb-stats";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { sportAccent } from "@/lib/sport-accent";
import MediaGallery, { type GalleryMediaItem } from "@/app/components/climbing/MediaGallery";
import MediaUploader from "@/app/components/climbing/MediaUploader";
import LocationDangerZone from "./LocationDangerZone";
import MiniLocationMap from "./MiniLocationMap";
import ProblemLibrary, { type ProblemLibraryEntry } from "./ProblemLibrary";
import AreaLibrary, { type AreaLibraryEntry } from "./AreaLibrary";

export const dynamic = "force-dynamic";

type Params = { id: string };

const FLASH_OUTCOMES = new Set<ClimbOutcome>(["FLASH", "ONSIGHT"]);

export default async function ClimbLocationDetailPage(props: {
  params: Promise<Params> | Params;
}) {
  const { id } = await Promise.resolve(props.params);

  const [location, attempts, problems, mediaRows, problemMediaRows, areaMediaRows, siblings, areaRows] = await Promise.all([
    prisma.climbLocation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        region: true,
        latitude: true,
        longitude: true,
        _count: { select: { routineLogs: true } },
      },
    }),
    prisma.climbAttempt.findMany({
      where: { sessionLog: { climbLocationId: id } },
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
        problem: { select: { id: true, name: true } },
        sessionLog: {
          select: {
            performedAt: true,
            routineId: true,
            routine: { select: { name: true } },
          },
        },
      },
    }),
    prisma.climbProblem.findMany({
      where: { locationId: id },
      orderBy: [{ grade: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        grade: true,
        gradeSystem: true,
        notes: true,
        onTickList: true,
      },
    }),
    prisma.climbMedia.findMany({
      where: { locationId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        url: true,
        thumbnailUrl: true,
        caption: true,
        width: true,
        height: true,
      },
    }),
    // Problem-scoped media for every problem at this location. One query +
    // in-memory grouping keeps things simple — ProblemLibrary doesn't need
    // to know which problems exist until it renders.
    prisma.climbMedia.findMany({
      where: { problem: { locationId: id } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        url: true,
        thumbnailUrl: true,
        caption: true,
        width: true,
        height: true,
        problemId: true,
      },
    }),
    // Area-scoped media for every area at this location. Same one-query +
    // in-memory grouping approach as problem media.
    prisma.climbMedia.findMany({
      where: { area: { locationId: id } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        url: true,
        thumbnailUrl: true,
        caption: true,
        width: true,
        height: true,
        areaId: true,
      },
    }),
    // Other locations — used by the merge-into dropdown in the danger zone.
    prisma.climbLocation.findMany({
      where: { id: { not: id } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    // Named sub-areas at this location. Loaded separately so an area
    // with zero attempts (just created via the picker) still shows.
    prisma.climbArea.findMany({
      where: { locationId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!location) notFound();

  // ── Stats roll-up ──────────────────────────────────────────────────────────

  const summary = summarizeAttempts(attempts);
  const lastVisit =
    attempts.length > 0 ? attempts[0].sessionLog.performedAt : null;
  const pyramidRows = buildPyramidRows(attempts);
  const hardestBoulderSend = hardestGrade(pyramidRows.boulderRows, SENT_OUTCOMES);
  const hardestYosemiteSend = hardestGrade(pyramidRows.yosemiteRows, SENT_OUTCOMES);
  const hardestBoulderFlash = hardestGrade(pyramidRows.boulderRows, FLASH_OUTCOMES);
  const hardestYosemiteFlash = hardestGrade(pyramidRows.yosemiteRows, FLASH_OUTCOMES);

  const activeProjects = buildProjectRollup(
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
    }))
  );

  // Build a problemId → rollup map so ProblemLibrary can render per-problem
  // attempt counts + last-attempt + best outcome inline.
  type ProblemRollup = {
    attemptCount: number;
    lastAttempt: Date | null;
    bestOutcome: ClimbOutcome | null;
  };
  const problemRollup = new Map<string, ProblemRollup>();
  for (const a of attempts) {
    if (!a.problemId) continue;
    const existing = problemRollup.get(a.problemId) ?? {
      attemptCount: 0,
      lastAttempt: null,
      bestOutcome: null,
    };
    existing.attemptCount += 1;
    if (!existing.lastAttempt || a.sessionLog.performedAt > existing.lastAttempt) {
      existing.lastAttempt = a.sessionLog.performedAt;
    }
    // Best outcome: clean send beats project beats fall. Track best.
    if (existing.bestOutcome === null) existing.bestOutcome = a.outcome;
    else if (
      !SENT_OUTCOMES.has(existing.bestOutcome) && SENT_OUTCOMES.has(a.outcome)
    ) {
      existing.bestOutcome = a.outcome;
    } else if (existing.bestOutcome === "FELL" && a.outcome === "PROJECT") {
      existing.bestOutcome = "PROJECT";
    }
    problemRollup.set(a.problemId, existing);
  }

  // Group problem-scoped media by problemId so each ProblemLibrary entry
  // can receive only its own gallery items. Empty arrays are fine for
  // problems without media — keeps the type clean and the prop required.
  const problemMediaByProblemId = new Map<string, GalleryMediaItem[]>();
  for (const m of problemMediaRows) {
    if (!m.problemId) continue;
    const list = problemMediaByProblemId.get(m.problemId) ?? [];
    list.push({
      id: m.id,
      kind: m.kind,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      caption: m.caption,
      width: m.width,
      height: m.height,
    });
    problemMediaByProblemId.set(m.problemId, list);
  }

  const problemEntries: ProblemLibraryEntry[] = problems.map((p) => {
    const rollup = problemRollup.get(p.id);
    return {
      id: p.id,
      name: p.name,
      grade: p.grade,
      gradeSystem: p.gradeSystem,
      notes: p.notes,
      attemptCount: rollup?.attemptCount ?? 0,
      lastAttempt: rollup?.lastAttempt ?? null,
      bestOutcome: rollup?.bestOutcome ?? null,
      onTickList: p.onTickList,
      media: problemMediaByProblemId.get(p.id) ?? [],
    };
  });

  // ── Session history (group attempts by sessionLogId) ──────────────────────

  type SessionRow = {
    sessionLogId: string;
    routineId: string;
    routineName: string;
    performedAt: Date;
    attemptCount: number;
    topSent: { grade: string; system: ClimbGradeSystem; outcome: ClimbOutcome } | null;
  };
  const sessionMap = new Map<string, SessionRow>();
  for (const a of attempts) {
    const entry = sessionMap.get(a.sessionLogId) ?? {
      sessionLogId: a.sessionLogId,
      routineId: a.sessionLog.routineId,
      routineName: a.sessionLog.routine.name,
      performedAt: a.sessionLog.performedAt,
      attemptCount: 0,
      topSent: null,
    };
    entry.attemptCount += 1;
    // Track hardest sent (or hardest attempted as fallback)
    if (SENT_OUTCOMES.has(a.outcome)) {
      if (
        !entry.topSent ||
        !SENT_OUTCOMES.has(entry.topSent.outcome) ||
        compareGrades(a.grade, a.gradeSystem, entry.topSent.grade, entry.topSent.system) > 0
      ) {
        entry.topSent = { grade: a.grade, system: a.gradeSystem, outcome: a.outcome };
      }
    } else if (!entry.topSent) {
      entry.topSent = { grade: a.grade, system: a.gradeSystem, outcome: a.outcome };
    }
    sessionMap.set(a.sessionLogId, entry);
  }
  const sessions = [...sessionMap.values()].sort(
    (a, b) => b.performedAt.getTime() - a.performedAt.getTime()
  );

  // ── Area rollup ────────────────────────────────────────────────────────────
  // Counts come from `attempts`; legacy free-text rows fall back to their
  // case-insensitive name match so they count toward the same bucket. Each
  // area card links into My Climbs with the location + area filter pre-set.
  type AreaRollup = {
    id: string;
    name: string;
    climbCount: number;
    sentCount: number;
    lastVisit: Date | null;
  };
  const areaById = new Map<string, AreaRollup>();
  const areaByNameLower = new Map<string, AreaRollup>();
  for (const a of areaRows) {
    const rollup: AreaRollup = {
      id: a.id,
      name: a.name,
      climbCount: 0,
      sentCount: 0,
      lastVisit: null,
    };
    areaById.set(a.id, rollup);
    areaByNameLower.set(a.name.toLowerCase(), rollup);
  }
  for (const a of attempts) {
    const linked = a.areaId ? areaById.get(a.areaId) : null;
    const fallback = !linked && a.area ? areaByNameLower.get(a.area.trim().toLowerCase()) : null;
    const target = linked ?? fallback ?? null;
    if (!target) continue;
    target.climbCount += 1;
    if (SENT_OUTCOMES.has(a.outcome)) target.sentCount += 1;
    if (!target.lastVisit || a.sessionLog.performedAt > target.lastVisit) {
      target.lastVisit = a.sessionLog.performedAt;
    }
  }
  // Group area-scoped media by areaId so each area card gets its own gallery.
  const areaMediaByAreaId = new Map<string, GalleryMediaItem[]>();
  for (const m of areaMediaRows) {
    if (!m.areaId) continue;
    const list = areaMediaByAreaId.get(m.areaId) ?? [];
    list.push({
      id: m.id,
      kind: m.kind,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      caption: m.caption,
      width: m.width,
      height: m.height,
    });
    areaMediaByAreaId.set(m.areaId, list);
  }

  const areaSummaries: AreaLibraryEntry[] = [...areaById.values()]
    .sort((a, b) => {
      // Areas with logs come first (descending by recency), then unused ones.
      if (a.climbCount > 0 && b.climbCount === 0) return -1;
      if (b.climbCount > 0 && a.climbCount === 0) return 1;
      if (a.lastVisit && b.lastVisit) return b.lastVisit.getTime() - a.lastVisit.getTime();
      return a.name.localeCompare(b.name);
    })
    .map((a) => ({
      id: a.id,
      name: a.name,
      climbCount: a.climbCount,
      sentCount: a.sentCount,
      lastVisit: a.lastVisit,
      media: areaMediaByAreaId.get(a.id) ?? [],
    }));

  const media: GalleryMediaItem[] = mediaRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl,
    caption: m.caption,
    width: m.width,
    height: m.height,
  }));

  const locationLabel = location.type === "GYM" ? "Gym" : "Crag";
  const hasCoords = location.latitude != null && location.longitude != null;

  return (
    <>
      {/* Slim hub-style header — replaces TargetHeader + its section-nav
          chips, which were noise on a leaf detail page. */}
      <div style={slimHeaderShellStyle}>
        <Link href="/activities/climbing" style={slimBackLinkStyle}>← Climbing</Link>
        <header style={{ display: "grid", gap: 4 }}>
          <div style={slimEyebrowStyle}>
            {location.type === "GYM" ? "🏠" : "🪨"} {locationLabel}
            {location.region ? ` · ${location.region}` : ""}
          </div>
          <h1 style={slimTitleStyle}>{location.name}</h1>
        </header>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link
            href={`/activities/climbing/climbs?location=${encodeURIComponent(location.id)}`}
            style={slimPillStyle}
          >
            📋 Browse climbs
          </Link>
          <Link href="/activities/climbing/map" style={slimPillStyle}>🗺 Map</Link>
        </div>
      </div>

      <div
        style={{
          maxWidth: "var(--app-width-wide)",
          margin: "0 auto",
          padding: "0 14px 20px",
          display: "grid",
          gap: 16,
        }}
      >
        {/* Hero stats */}
        <SectionCard title="At a glance" subtitle={`${summary.totalSessions} visit${summary.totalSessions === 1 ? "" : "s"} · ${attempts.length} climb${attempts.length === 1 ? "" : "s"} logged`}>
          <HeroStats
            sessions={summary.totalSessions}
            attempts={attempts.length}
            sentCount={summary.sentCount}
            projectCount={activeProjects.length}
            lastVisit={lastVisit}
            hardestBoulderSend={hardestBoulderSend}
            hardestBoulderFlash={hardestBoulderFlash}
            hardestYosemiteSend={hardestYosemiteSend}
            hardestYosemiteFlash={hardestYosemiteFlash}
          />
        </SectionCard>

        {/* Mini-map + scoped pyramid (2-col on desktop via .climbing-detail-grid) */}
        <div className="climbing-detail-grid">
          <SectionCard
            title="Location"
            subtitle={hasCoords ? "Drag to adjust on the map page →" : "No coordinates set"}
            actions={hasCoords ? null : <Link href="/activities/climbing/map" style={inlineLinkStyle}>Place on map →</Link>}
          >
            <MiniLocationMap
              latitude={location.latitude}
              longitude={location.longitude}
              type={location.type}
              name={location.name}
            />
          </SectionCard>

          <SectionCard title="Grade pyramid" subtitle={attempts.length === 0 ? "Log a climb to start your pyramid" : "Clean sends + projects across all visits"}>
            {pyramidRows.allRows.length === 0 ? (
              <EmptyState message="No climbs logged here yet." />
            ) : (
              <ScopedPyramid rows={pyramidRows} />
            )}
          </SectionCard>
        </div>

        {/* Photos & links */}
        <SectionCard
          title={`Photos${media.length > 0 ? ` (${media.length})` : ""}`}
          subtitle="Topos, beta shots, hero photos, and external links."
        >
          <div style={{ display: "grid", gap: 12 }}>
            <MediaUploader target={{ kind: "location", locationId: location.id }} />
            <MediaGallery items={media} emptyHint="No photos yet — add one above." />
          </div>
        </SectionCard>

        {/* Area rollup — quick links to the area-filtered climbs page,
            with attempt/sent counts per area. Hidden when this location
            has no named areas yet. */}
        {areaSummaries.length > 0 && (
          <SectionCard
            title={`Areas (${areaSummaries.length})`}
            subtitle="Sectors / walls inside this location. Tap Photos to add a topo, or Browse to filter your climbs."
          >
            <AreaLibrary locationId={location.id} entries={areaSummaries} />
          </SectionCard>
        )}

        {/* Problem library */}
        <SectionCard
          title={`Problems${problems.length > 0 ? ` (${problems.length})` : ""}`}
          subtitle={
            problems.length === 0
              ? "Named problems show up here once you log them in per-climb mode."
              : "Tap a row to see attempts, notes, and add photos."
          }
        >
          {problems.length === 0 ? (
            <EmptyState message="No named problems yet — switch to per-climb mode when logging to name routes." />
          ) : (
            <ProblemLibrary entries={problemEntries} />
          )}
        </SectionCard>

        {/* Session history */}
        <SectionCard title="Sessions" subtitle={`${sessions.length} visit${sessions.length === 1 ? "" : "s"} logged at this spot`}>
          {sessions.length === 0 ? (
            <EmptyState message="No sessions logged here yet." />
          ) : (
            <SessionList sessions={sessions} />
          )}
        </SectionCard>

        {/* Management — collapsed by default since these aren't day-to-day
            controls. Rename, type change, merge, delete all live here. */}
        <LocationDangerZone
          locationId={location.id}
          locationName={location.name}
          locationType={location.type}
          logCount={location._count.routineLogs}
          siblings={siblings}
        />
      </div>
    </>
  );
}

// ── Hero stats ──────────────────────────────────────────────────────────────

function HeroStats({
  sessions,
  attempts,
  sentCount,
  projectCount,
  lastVisit,
  hardestBoulderSend,
  hardestBoulderFlash,
  hardestYosemiteSend,
  hardestYosemiteFlash,
}: {
  sessions: number;
  attempts: number;
  sentCount: number;
  projectCount: number;
  lastVisit: Date | null;
  hardestBoulderSend: string | null;
  hardestBoulderFlash: string | null;
  hardestYosemiteSend: string | null;
  hardestYosemiteFlash: string | null;
}) {
  const cells: Array<{ label: string; value: string; accent?: string }> = [
    { label: "Visits", value: String(sessions) },
    { label: "Climbs", value: String(attempts) },
    { label: "Sent", value: String(sentCount), accent: "rgba(74,222,128,0.95)" },
    { label: "Active projects", value: String(projectCount), accent: "rgba(167,139,250,0.95)" },
    ...(hardestBoulderSend ? [{ label: "Best send (V)", value: hardestBoulderSend, accent: "rgba(74,222,128,0.9)" }] : []),
    ...(hardestBoulderFlash && hardestBoulderFlash !== hardestBoulderSend
      ? [{ label: "Best flash (V)", value: hardestBoulderFlash, accent: "rgba(251,191,36,0.9)" }]
      : []),
    ...(hardestYosemiteSend ? [{ label: "Best send", value: hardestYosemiteSend, accent: "rgba(74,222,128,0.9)" }] : []),
    ...(hardestYosemiteFlash && hardestYosemiteFlash !== hardestYosemiteSend
      ? [{ label: "Best onsight", value: hardestYosemiteFlash, accent: "rgba(251,191,36,0.9)" }]
      : []),
    ...(lastVisit
      ? [{
          label: "Last visit",
          value: formatAppDate(lastVisit, { month: "short", day: "numeric", year: "numeric" }),
        }]
      : []),
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
        gap: 8,
      }}
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "grid",
            gap: 2,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
            {cell.label}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: cell.accent ?? "inherit",
            }}
          >
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scoped pyramid (inline, simpler than the world page version) ────────────

function ScopedPyramid({ rows }: { rows: { boulderRows: PyramidRow[]; yosemiteRows: PyramidRow[] } }) {
  const sections = [
    { label: "Bouldering (V)", rows: rows.boulderRows },
    { label: "Sport / Trad", rows: rows.yosemiteRows },
  ].filter((s) => s.rows.length > 0);

  const maxTotal = Math.max(
    1,
    ...sections.flatMap((s) => s.rows.map((r) => r.total))
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {sections.map((section) => (
        <div key={section.label} style={{ display: "grid", gap: 4 }}>
          {sections.length > 1 && (
            <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.6, letterSpacing: 0.4 }}>
              {section.label}
            </div>
          )}
          {[...section.rows].reverse().map((row) => (
            <PyramidBar key={`${section.label}-${row.grade}`} row={row} maxTotal={maxTotal} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PyramidBar({ row, maxTotal }: { row: PyramidRow; maxTotal: number }) {
  const segments = PYRAMID_OUTCOMES.map((o) => ({ outcome: o, count: row.counts[o] ?? 0 })).filter((s) => s.count > 0);
  const widthPct = (row.total / maxTotal) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 900, minWidth: 38, opacity: 0.85 }}>{row.grade}</span>
      <div
        style={{
          flex: 1,
          height: 18,
          borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ display: "flex", width: `${widthPct}%`, minWidth: 4 }}>
          {segments.map((seg) => (
            <div
              key={seg.outcome}
              title={`${climbOutcomeLabel(seg.outcome, row.system)}: ${seg.count}`}
              style={{
                flex: seg.count,
                background: climbOutcomeColor(seg.outcome),
              }}
            />
          ))}
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7, minWidth: 20, textAlign: "right" }}>{row.total}</span>
    </div>
  );
}

// ── Session list ────────────────────────────────────────────────────────────

function SessionList({
  sessions,
}: {
  sessions: Array<{
    sessionLogId: string;
    routineId: string;
    routineName: string;
    performedAt: Date;
    attemptCount: number;
    topSent: { grade: string; system: ClimbGradeSystem; outcome: ClimbOutcome } | null;
  }>;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {sessions.map((s) => (
        <Link
          key={s.sessionLogId}
          href={`/routines/${s.routineId}/logs/${s.sessionLogId}/details`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <div style={{ display: "grid", gap: 1, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>
              {formatAppDate(s.performedAt, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span style={{ fontSize: 11, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.routineName} · {s.attemptCount} climb{s.attemptCount === 1 ? "" : "s"}
            </span>
          </div>
          {s.topSent && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                padding: "3px 8px",
                borderRadius: 8,
                background: climbOutcomeBg(s.topSent.outcome),
                color: climbOutcomeColor(s.topSent.outcome),
                border: `1px solid ${climbOutcomeColor(s.topSent.outcome).replace("0.9)", "0.32)").replace("0.95)", "0.32)")}`,
                flexShrink: 0,
              }}
            >
              {s.topSent.grade}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Cross-system grade comparison: prefer Yosemite when comparing across
// systems (rope climbing tends to be "harder" in the user's mental model),
// but within a system fall back to gradeSort. Returns positive when `a > b`.
function compareGrades(
  aGrade: string,
  aSystem: ClimbGradeSystem,
  bGrade: string,
  bSystem: ClimbGradeSystem
): number {
  if (aSystem !== bSystem) {
    // Mixed-system session — prefer Yosemite as the "harder" representation,
    // matching the convention used elsewhere in the climbing world page.
    return aSystem === "YOSEMITE" ? 1 : -1;
  }
  return gradeSort(aGrade, aSystem) - gradeSort(bGrade, bSystem);
}

const inlineLinkStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(160,200,255,0.95)",
  textDecoration: "none",
};

const slimHeaderShellStyle: React.CSSProperties = {
  maxWidth: "var(--app-width-wide)",
  margin: "0 auto",
  padding: "16px 14px 12px",
  display: "grid",
  gap: 8,
};

const slimBackLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
};

const slimEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const slimTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: -0.4,
  color: sportAccent("climbing"),
};

const slimPillStyle: React.CSSProperties = {
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
