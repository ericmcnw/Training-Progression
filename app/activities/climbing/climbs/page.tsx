import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  climbOutcomeLabel,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";
import { SectionCard, SectionLinkButton, TargetHeader, EmptyState } from "@/app/progress/ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Outcome groupings the user actually thinks in. "Sent" = anything you stuck;
// "Project" = working on it; "Falls" = attempts that didn't go.
type OutcomeFilter = "all" | "sent" | "project" | "falls";

const SENT_OUTCOMES = new Set<ClimbOutcome>(["FLASH", "ONSIGHT", "SEND", "REDPOINT"]);

function attemptMatchesOutcomeFilter(outcome: ClimbOutcome, filter: OutcomeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "sent") return SENT_OUTCOMES.has(outcome);
  if (filter === "project") return outcome === "PROJECT";
  if (filter === "falls") return outcome === "FELL";
  return true;
}

type VenueFilter = "all" | "indoor" | "outdoor";

function venueOf(templateKey: string | null | undefined, locationType: "GYM" | "CRAG" | null | undefined): "GYM" | "CRAG" | null {
  if (templateKey?.startsWith("indoor-") || locationType === "GYM") return "GYM";
  if (templateKey?.startsWith("outdoor-") || locationType === "CRAG") return "CRAG";
  return null;
}

function gradeSort(grade: string, system: ClimbGradeSystem): number {
  if (system === "BOULDER_V") return parseInt(grade.replace(/^V/, ""), 10) || 0;
  const m = grade.match(/^5\.(\d+)([abcd]?)$/i);
  if (!m) return 0;
  const sub = ({ "": 0, a: 0, b: 1, c: 2, d: 3 } as Record<string, number>)[m[2].toLowerCase()] ?? 0;
  return parseInt(m[1], 10) * 4 + sub;
}

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
  return `/activities/climbing/climbs${qs ? `?${qs}` : ""}`;
}

export default async function ClimbsBrowsePage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const venueFilter = (getParam(searchParams, "venue") ?? "all") as VenueFilter;
  const outcomeFilter = (getParam(searchParams, "outcome") ?? "all") as OutcomeFilter;
  const locationFilter = getParam(searchParams, "location") ?? "all";
  const gradeFilter = getParam(searchParams, "grade") ?? "all";
  const search = (getParam(searchParams, "q") ?? "").trim().toLowerCase();

  const [allAttempts, allLocations] = await Promise.all([
    prisma.climbAttempt.findMany({
      orderBy: { sessionLog: { performedAt: "desc" } },
      select: {
        id: true,
        grade: true,
        gradeSystem: true,
        outcome: true,
        area: true,
        notes: true,
        sessionLogId: true,
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
  ]);

  // Filter pipeline
  const filtered = allAttempts.filter((a) => {
    const v = venueOf(a.sessionLog.routine.sessionDetails?.template?.key, a.sessionLog.climbLocation?.type);
    if (venueFilter === "indoor" && v !== "GYM") return false;
    if (venueFilter === "outdoor" && v !== "CRAG") return false;

    if (locationFilter !== "all" && a.sessionLog.climbLocation?.id !== locationFilter) return false;

    if (gradeFilter !== "all" && a.grade !== gradeFilter) return false;

    if (!attemptMatchesOutcomeFilter(a.outcome, outcomeFilter)) return false;

    if (search) {
      const haystack = [
        a.grade.toLowerCase(),
        a.area?.toLowerCase() ?? "",
        a.notes?.toLowerCase() ?? "",
        a.problem?.name.toLowerCase() ?? "",
        a.sessionLog.climbLocation?.name.toLowerCase() ?? "",
      ].join(" ");
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  // Available grades for the filter dropdown — distinct grades across the
  // current pre-grade-filter pipeline (so users can switch grades without
  // resetting venue/location).
  const gradeCandidates = allAttempts.filter((a) => {
    const v = venueOf(a.sessionLog.routine.sessionDetails?.template?.key, a.sessionLog.climbLocation?.type);
    if (venueFilter === "indoor" && v !== "GYM") return false;
    if (venueFilter === "outdoor" && v !== "CRAG") return false;
    if (locationFilter !== "all" && a.sessionLog.climbLocation?.id !== locationFilter) return false;
    return true;
  });
  const distinctGrades = Array.from(
    new Map(
      gradeCandidates.map((a) => [`${a.gradeSystem}::${a.grade}`, { grade: a.grade, system: a.gradeSystem }])
    ).values()
  ).sort((a, b) => gradeSort(b.grade, b.system) - gradeSort(a.grade, a.system));

  // Group filtered attempts by location for display.
  type Group = {
    locationId: string | null;
    locationName: string;
    locationType: "GYM" | "CRAG" | null;
    lastVisit: Date | null;
    attempts: typeof filtered;
  };
  const groupMap = new Map<string, Group>();
  for (const a of filtered) {
    const loc = a.sessionLog.climbLocation;
    const key = loc?.id ?? "__no_location__";
    const entry = groupMap.get(key) ?? {
      locationId: loc?.id ?? null,
      locationName: loc?.name ?? "Unspecified location",
      locationType: loc?.type ?? null,
      lastVisit: null,
      attempts: [],
    };
    entry.attempts.push(a);
    if (!entry.lastVisit || a.sessionLog.performedAt > entry.lastVisit) {
      entry.lastVisit = a.sessionLog.performedAt;
    }
    groupMap.set(key, entry);
  }
  const groups = [...groupMap.values()].sort(
    (g1, g2) => (g2.lastVisit?.getTime() ?? 0) - (g1.lastVisit?.getTime() ?? 0)
  );

  const totalAttempts = filtered.length;
  const sentCount = filtered.filter((a) => SENT_OUTCOMES.has(a.outcome)).length;
  const projectCount = filtered.filter((a) => a.outcome === "PROJECT").length;

  return (
    <>
      <TargetHeader
        section="sports"
        title="My Climbs"
        eyebrow="Climbing"
        subtitle="Every climb you've logged. Filter by venue, location, grade, or outcome — useful when you're heading back to a spot."
        basePath="/activities/climbing/climbs"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        actions={<SectionLinkButton href="/activities/climbing" label="Back to climbing" />}
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        {/* Summary chips + filter controls */}
        <SectionCard title="Filters" subtitle={`${totalAttempts} climb${totalAttempts !== 1 ? "s" : ""} matching · ${sentCount} sent · ${projectCount} project${projectCount !== 1 ? "s" : ""}`}>
          <div style={{ display: "grid", gap: 12 }}>
            {/* Venue toggle */}
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

            {/* Outcome toggle */}
            <FilterPillRow
              label="Outcome"
              options={[
                { value: "all", label: "All" },
                { value: "sent", label: "Sent" },
                { value: "project", label: "Projects" },
                { value: "falls", label: "Falls" },
              ]}
              active={outcomeFilter}
              hrefFor={(v) => buildHref(searchParams, { outcome: v === "all" ? undefined : v })}
            />

            {/* Location pills (a row of compact pills — feels lighter than a dropdown for ~5 locations) */}
            {allLocations.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={filterLabelStyle}>Location</div>
                <div style={pillRowStyle}>
                  <Link href={buildHref(searchParams, { location: undefined })} style={locationFilter === "all" ? pillActiveStyle : pillStyle}>
                    All locations
                  </Link>
                  {allLocations.map((loc) => (
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

            {/* Grade filter (compact pill row, grades from the current venue+location slice) */}
            {distinctGrades.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={filterLabelStyle}>Grade</div>
                <div style={pillRowStyle}>
                  <Link href={buildHref(searchParams, { grade: undefined })} style={gradeFilter === "all" ? pillActiveStyle : pillStyle}>
                    All grades
                  </Link>
                  {distinctGrades.map((g) => (
                    <Link
                      key={`${g.system}-${g.grade}`}
                      href={buildHref(searchParams, { grade: g.grade })}
                      style={gradeFilter === g.grade ? pillActiveStyle : pillStyle}
                    >
                      {g.grade}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Free-text search */}
            <form action="/activities/climbing/climbs" method="get" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {/* Preserve current filters on submit */}
              {venueFilter !== "all" && <input type="hidden" name="venue" value={venueFilter} />}
              {outcomeFilter !== "all" && <input type="hidden" name="outcome" value={outcomeFilter} />}
              {locationFilter !== "all" && <input type="hidden" name="location" value={locationFilter} />}
              {gradeFilter !== "all" && <input type="hidden" name="grade" value={gradeFilter} />}
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="Search grade, area, notes, problem name…"
                style={searchInputStyle}
              />
              <button type="submit" style={searchBtnStyle}>Search</button>
              {(venueFilter !== "all" || outcomeFilter !== "all" || locationFilter !== "all" || gradeFilter !== "all" || search) && (
                <Link href="/activities/climbing/climbs" style={searchBtnStyle}>Reset</Link>
              )}
            </form>
          </div>
        </SectionCard>

        {/* Grouped attempts */}
        {groups.length === 0 ? (
          <SectionCard title="No climbs match" subtitle="Try removing a filter or expanding the venue/grade selection.">
            <EmptyState message="No climbs match the current filters." />
          </SectionCard>
        ) : (
          groups.map((group) => (
            <SectionCard
              key={group.locationId ?? "__nl__"}
              title={group.locationName}
              subtitle={`${group.attempts.length} climb${group.attempts.length !== 1 ? "s" : ""}${group.lastVisit ? ` · last visit ${formatAppDate(group.lastVisit, { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
              actions={
                <span style={venueChipStyle(group.locationType)}>
                  {group.locationType === "GYM" ? "Indoor" : group.locationType === "CRAG" ? "Outdoor" : "—"}
                </span>
              }
            >
              <ClimbList attempts={group.attempts} />
            </SectionCard>
          ))
        )}
      </div>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

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

type AttemptRow = {
  id: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  area: string | null;
  notes: string | null;
  sessionLogId: string;
  problem: { name: string } | null;
  sessionLog: {
    performedAt: Date;
    routineId: string;
    climbLocation: { id: string; name: string; type: "GYM" | "CRAG" } | null;
    routine: {
      name: string;
      sessionDetails: { template: { key: string } | null } | null;
    };
  };
};

function ClimbList({ attempts }: { attempts: AttemptRow[] }) {
  // Sub-group by date so users can scan their visits.
  const byDate = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const dateKey = a.sessionLog.performedAt.toISOString().slice(0, 10);
    const list = byDate.get(dateKey) ?? [];
    list.push(a);
    byDate.set(dateKey, list);
  }
  const dateGroups = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {dateGroups.map(([dateKey, dateAttempts]) => {
        const date = new Date(dateAttempts[0].sessionLog.performedAt);
        const dateLabel = formatAppDate(date, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        const sessionRoutineId = dateAttempts[0].sessionLog.routineId;
        const sessionLogId = dateAttempts[0].sessionLogId;
        const routineName = dateAttempts[0].sessionLog.routine.name;
        return (
          <div key={dateKey} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>{dateLabel}</span>
              <Link
                href={`/routines/${sessionRoutineId}/logs/${sessionLogId}/details`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.65,
                  textDecoration: "none",
                  color: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {routineName} →
              </Link>
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              {dateAttempts.map((a) => (
                <ClimbRow key={a.id} attempt={a} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClimbRow({ attempt }: { attempt: AttemptRow }) {
  const outcomeColor = climbOutcomeColor(attempt.outcome);
  const outcomeBg = climbOutcomeBg(attempt.outcome);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 900,
          padding: "4px 10px",
          borderRadius: 8,
          background: outcomeBg,
          color: outcomeColor,
          border: `1px solid ${outcomeColor.replace("0.9)", "0.32)")}`,
          minWidth: 44,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {attempt.grade}
      </span>
      <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: outcomeColor }}>
          {climbOutcomeLabel(attempt.outcome, attempt.gradeSystem)}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, opacity: 0.7 }}>
          {attempt.problem?.name && (
            <span style={{ fontWeight: 700 }}>{attempt.problem.name}</span>
          )}
          {attempt.area && <span>· {attempt.area}</span>}
          {attempt.notes && (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              · {attempt.notes}
            </span>
          )}
        </div>
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

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
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

const searchInputStyle: React.CSSProperties = {
  flex: "1 1 220px",
  minWidth: 0,
  padding: "8px 12px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
};

const searchBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

function venueChipStyle(type: "GYM" | "CRAG" | null): React.CSSProperties {
  const color =
    type === "GYM"
      ? "rgba(78,148,255,0.85)"
      : type === "CRAG"
      ? "rgba(74,222,128,0.85)"
      : "rgba(255,255,255,0.55)";
  return {
    fontSize: 10,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 999,
    border: `1px solid ${color.replace("0.85)", "0.3)")}`,
    background: color.replace("0.85)", "0.10)"),
    color,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  };
}
