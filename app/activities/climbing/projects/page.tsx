// Projects rollup view — one row per named ClimbProblem that has been
// attempted (PROJECT or FELL) and never cleanly sent. Helps answer "what
// am I working on right now?" without scrolling through every attempt.
//
// Filters:
//   - Venue (Indoor / Outdoor / All)
//   - Activity (active = touched in last 60 days vs Dormant)
//   - Location dropdown via existing pill row
//
// Each row links to its location's detail page (drilling into a single
// problem detail is deferred — for now the location page's problem library
// is the canonical place to read beta and edit notes).

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import {
  gradeSort,
  venueOf,
  type ClimbGradeSystem,
} from "@/lib/climb-types";
import { buildProjectRollup } from "@/lib/climb-stats";
import { SectionBackButton, SectionCard, SectionLinkButton, TargetHeader, EmptyState } from "@/app/progress/ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

type VenueFilter = "all" | "indoor" | "outdoor";
type ActivityFilter = "all" | "active" | "dormant";
const ACTIVE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function buildHref(params: SearchParams, overrides: Record<string, string | undefined>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") next[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/activities/climbing/projects${qs ? `?${qs}` : ""}`;
}

export default async function ClimbingProjectsPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const venueFilter = (getParam(searchParams, "venue") ?? "all") as VenueFilter;
  const activityFilter = (getParam(searchParams, "activity") ?? "all") as ActivityFilter;
  const locationFilter = getParam(searchParams, "location") ?? "all";

  const now = new Date();
  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_MS);

  // Load every attempt where a problem is named — un-named attempts can't
  // be grouped into a project rollup. Skip outcomes we don't care about for
  // detection (the rollup helper handles "no clean send" logic internally).
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
        sessionLog: {
          select: {
            performedAt: true,
            climbLocationId: true,
            climbLocation: { select: { id: true, name: true, type: true } },
            routine: {
              select: {
                sessionDetails: { select: { template: { select: { key: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.climbProblem.findMany({
      select: { id: true, name: true, grade: true, gradeSystem: true, notes: true, locationId: true },
    }),
    prisma.climbLocation.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  const problemById = new Map(problems.map((p) => [p.id, p]));

  // Apply pre-filters (venue, location) BEFORE running the project rollup
  // — keeps the active-project detection scoped to whatever slice the user
  // is asking about.
  const filteredAttempts = attempts.filter((a) => {
    const v = venueOf(
      a.sessionLog.routine.sessionDetails?.template?.key,
      a.sessionLog.climbLocation?.type ?? null
    );
    if (venueFilter === "indoor" && v !== "GYM") return false;
    if (venueFilter === "outdoor" && v !== "CRAG") return false;
    if (locationFilter !== "all" && a.sessionLog.climbLocationId !== locationFilter) return false;
    return true;
  });

  const allRollup = buildProjectRollup(
    filteredAttempts.map((a) => ({
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

  // Activity filter — applied after rollup so "active" vs "dormant" counts
  // are accurate against the same dataset the user is browsing.
  const rollup = allRollup.filter((r) => {
    if (activityFilter === "active") return r.lastAttempt >= activeCutoff;
    if (activityFilter === "dormant") return r.lastAttempt < activeCutoff;
    return true;
  });

  // Decorate each rollup row with problem name + location for rendering.
  type DecoratedProject = {
    problemId: string;
    problemName: string;
    grade: string;
    gradeSystem: ClimbGradeSystem;
    locationId: string | null;
    locationName: string | null;
    locationType: "GYM" | "CRAG" | null;
    attemptCount: number;
    lastAttempt: Date;
    bestMoves: { completed: number; total: number } | null;
    lastNotes: string | null;
    isActive: boolean;
  };
  const decorated: DecoratedProject[] = rollup.map((r) => {
    const problem = problemById.get(r.problemId);
    const location = problem?.locationId ? problemById.get(r.problemId) : null;
    void location;
    const problemLoc = problem?.locationId
      ? locations.find((l) => l.id === problem.locationId) ?? null
      : null;
    return {
      problemId: r.problemId,
      problemName: problem?.name ?? "Unnamed",
      grade: r.grade,
      gradeSystem: r.gradeSystem,
      locationId: problem?.locationId ?? null,
      locationName: problemLoc?.name ?? null,
      locationType: problemLoc?.type ?? null,
      attemptCount: r.attemptCount,
      lastAttempt: r.lastAttempt,
      bestMoves: r.bestMoves,
      lastNotes: r.lastNotes,
      isActive: r.lastAttempt >= activeCutoff,
    };
  });

  // Counts for the activity filter labels — compute from the unfiltered
  // rollup so users see "Active (12) · Dormant (5)" instead of zeros after
  // selecting one tab.
  const activeCount = allRollup.filter((r) => r.lastAttempt >= activeCutoff).length;
  const dormantCount = allRollup.length - activeCount;

  // Group by location for visual chunking. Projects without a location land
  // in an "Unknown location" group at the bottom.
  type Group = {
    locationId: string | null;
    locationName: string;
    locationType: "GYM" | "CRAG" | null;
    items: DecoratedProject[];
  };
  const groupMap = new Map<string, Group>();
  for (const p of decorated) {
    const key = p.locationId ?? "__nl__";
    const g = groupMap.get(key) ?? {
      locationId: p.locationId,
      locationName: p.locationName ?? "Unknown location",
      locationType: p.locationType,
      items: [],
    };
    g.items.push(p);
    groupMap.set(key, g);
  }
  // Sort items within each group by grade descending, then by recency.
  for (const g of groupMap.values()) {
    g.items.sort((a, b) => {
      const gd = gradeSort(b.grade, b.gradeSystem) - gradeSort(a.grade, a.gradeSystem);
      if (gd !== 0) return gd;
      return b.lastAttempt.getTime() - a.lastAttempt.getTime();
    });
  }
  // Order groups by most-recent activity.
  const groups = [...groupMap.values()].sort((a, b) => {
    const aLast = Math.max(...a.items.map((i) => i.lastAttempt.getTime()));
    const bLast = Math.max(...b.items.map((i) => i.lastAttempt.getTime()));
    return bLast - aLast;
  });

  return (
    <>
      <TargetHeader
        section="sports"
        title="Projects"
        eyebrow="Climbing"
        subtitle="Routes and problems you're working on — never cleanly sent yet."
        basePath="/activities/climbing/projects"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionLinkButton href="/activities/climbing/climbs" label="📋 All climbs" />
            <SectionLinkButton href="/activities/climbing/map" label="🗺 Map" />
            <SectionBackButton fallbackHref="/activities/climbing" label="← Back" />
          </div>
        }
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        <SectionCard
          title="Filters"
          subtitle={`${decorated.length} project${decorated.length === 1 ? "" : "s"} · ${activeCount} active · ${dormantCount} dormant`}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <FilterPillRow
              label="Activity"
              options={[
                { value: "all", label: `All (${allRollup.length})` },
                { value: "active", label: `Active (${activeCount})` },
                { value: "dormant", label: `Dormant (${dormantCount})` },
              ]}
              active={activityFilter}
              hrefFor={(v) => buildHref(searchParams, { activity: v === "all" ? undefined : v })}
            />
            <FilterPillRow
              label="Venue"
              options={[
                { value: "all", label: "All" },
                { value: "indoor", label: "Indoor" },
                { value: "outdoor", label: "Outdoor" },
              ]}
              active={venueFilter}
              hrefFor={(v) => buildHref(searchParams, { venue: v === "all" ? undefined : v })}
            />
            {locations.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={filterLabelStyle}>Location</div>
                <div style={pillRowStyle}>
                  <Link
                    href={buildHref(searchParams, { location: undefined })}
                    style={locationFilter === "all" ? pillActiveStyle : pillStyle}
                  >
                    All locations
                  </Link>
                  {locations.map((loc) => (
                    <Link
                      key={loc.id}
                      href={buildHref(searchParams, { location: loc.id })}
                      style={locationFilter === loc.id ? pillActiveStyle : pillStyle}
                    >
                      <span style={{ marginRight: 6, fontSize: 9, opacity: 0.7 }}>{loc.type === "GYM" ? "🏠" : "🪨"}</span>
                      {loc.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {groups.length === 0 ? (
          <SectionCard title="No projects" subtitle="Log a few attempts with named problems to see your projects roll up here.">
            <EmptyState message="No projects match the current filters." />
          </SectionCard>
        ) : (
          groups.map((group) => (
            <SectionCard
              key={group.locationId ?? "__nl__"}
              title={group.locationName}
              subtitle={`${group.items.length} project${group.items.length === 1 ? "" : "s"}`}
              actions={
                group.locationId ? (
                  <Link href={`/activities/climbing/locations/${encodeURIComponent(group.locationId)}`} style={detailLinkStyle}>
                    Details →
                  </Link>
                ) : null
              }
            >
              <div className="climbing-detail-grid">
                {group.items.map((p) => (
                  <ProjectCard key={p.problemId} project={p} now={now} />
                ))}
              </div>
            </SectionCard>
          ))
        )}
      </div>
    </>
  );
}

function ProjectCard({
  project,
  now,
}: {
  project: {
    problemId: string;
    problemName: string;
    grade: string;
    gradeSystem: ClimbGradeSystem;
    locationId: string | null;
    locationName: string | null;
    locationType: "GYM" | "CRAG" | null;
    attemptCount: number;
    lastAttempt: Date;
    bestMoves: { completed: number; total: number } | null;
    lastNotes: string | null;
    isActive: boolean;
  };
  now: Date;
}) {
  const inner = (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        background: project.isActive ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
        border: project.isActive
          ? "1px solid rgba(167,139,250,0.32)"
          : "1px solid rgba(255,255,255,0.06)",
        cursor: project.locationId ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={gradeChipStyle}>{project.grade}</span>
        <span style={{ fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.problemName}
        </span>
        {project.isActive ? (
          <span style={activeChipStyle}>ACTIVE</span>
        ) : (
          <span style={dormantChipStyle}>DORMANT</span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11.5, opacity: 0.75 }}>
        <span>{project.attemptCount} attempt{project.attemptCount === 1 ? "" : "s"}</span>
        {project.bestMoves && project.bestMoves.total > 0 ? (
          <span>· {project.bestMoves.completed}/{project.bestMoves.total} moves</span>
        ) : null}
        <span>· last {formatAppDate(project.lastAttempt, { month: "short", day: "numeric" })} ({relativeFromNow(project.lastAttempt, now)})</span>
      </div>
      {project.lastNotes ? (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            margin: 0,
            opacity: 0.85,
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          &ldquo;{project.lastNotes}&rdquo;
        </p>
      ) : null}
    </div>
  );

  if (!project.locationId) return inner;
  return (
    <Link
      href={`/activities/climbing/locations/${encodeURIComponent(project.locationId)}`}
      style={{ textDecoration: "none", color: "inherit" }}
      aria-label={`Open ${project.locationName} to see ${project.problemName}`}
    >
      {inner}
    </Link>
  );
}

function FilterPillRow({
  label,
  options,
  active,
  hrefFor,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={filterLabelStyle}>{label}</div>
      <div style={pillRowStyle}>
        {options.map((opt) => (
          <Link key={opt.value} href={hrefFor(opt.value)} style={active === opt.value ? pillActiveStyle : pillStyle}>
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const filterLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};

const pillRowStyle: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: 999,
  // Long-hand so `pillActiveStyle` can override `borderColor` without
  // React's mixed-shorthand rerender warning.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const pillActiveStyle: React.CSSProperties = {
  ...pillStyle,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "#bfdbfe",
};

const detailLinkStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(120,190,255,0.32)",
  background: "rgba(120,190,255,0.10)",
  color: "rgba(191,219,254,0.95)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const gradeChipStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  padding: "3px 8px",
  borderRadius: 8,
  background: "rgba(167,139,250,0.12)",
  border: "1px solid rgba(167,139,250,0.32)",
  color: "rgba(167,139,250,0.95)",
  minWidth: 38,
  textAlign: "center",
  flexShrink: 0,
};

const activeChipStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(167,139,250,0.18)",
  border: "1px solid rgba(167,139,250,0.45)",
  color: "rgba(196,181,253,0.98)",
  textTransform: "uppercase",
};

const dormantChipStyle: React.CSSProperties = {
  ...activeChipStyle,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "rgba(255,255,255,0.55)",
};
