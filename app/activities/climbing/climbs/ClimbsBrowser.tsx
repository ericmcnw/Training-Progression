"use client";

// Instant climb database. All filtering happens client-side over the
// pre-loaded attempt list (single-user scale — a few hundred rows), so
// search-as-you-type and filter taps update the results with zero page
// reloads. Filters sync to the URL via replaceState so deep links from
// location pages (?location=X&area=Y) still seed the view and refresh
// keeps state, without polluting back-button history.
//
// Layout: one compact filter card —
//   row 1: search (instant)
//   row 2: Venue · Outcome · Range segmented pills
//   row 3: Location / Area / Grade native selects (compact on mobile,
//          no more giant pill walls)
// — then results grouped by location with date sub-groups.

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  climbOutcomeLabel,
  climbOutcomesForDiscipline,
  gradeSort,
  type ClimbGradeSystem,
  type ClimbOutcome,
  type ClimbingDiscipline,
} from "@/lib/climb-types";
import { climbingGradeOptionsForDiscipline } from "@/lib/session-templates";
import { buildProjectRollup } from "@/lib/climb-stats";
import { updateClimbAttempt } from "./actions";

export type BrowserAttempt = {
  id: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  discipline: ClimbingDiscipline;
  areaId: string | null;
  areaName: string | null;
  notes: string | null;
  problemId: string | null;
  problemName: string | null;
  movesCompleted: number | null;
  totalMoves: number | null;
  sessionLogId: string;
  routineId: string;
  routineName: string;
  performedAt: Date;
  locationId: string | null;
  locationName: string | null;
  venue: "GYM" | "CRAG" | null;
};

export type BrowserLocation = { id: string; name: string; type: "GYM" | "CRAG" };
export type BrowserArea = { id: string; name: string; locationId: string };

type VenueFilter = "all" | "indoor" | "outdoor";
// "falls" only surfaces when legacy FELL rows exist — the outcome was
// retired from the logger, so for most data it's an empty bucket and the
// option simply doesn't render. Legacy "working" deep-links map to
// "project".
type OutcomeFilter = "all" | "flashed" | "sent" | "project" | "falls";
type ActivityFilter = "all" | "active" | "dormant";
type RangeFilter = "7d" | "4w" | "12w" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<RangeFilter, "all">, number> = {
  "7d": 7, "4w": 28, "12w": 84, "1y": 365,
};
const ACTIVE_PROJECT_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

const FLASH_OUTCOMES = new Set<ClimbOutcome>(["FLASH", "ONSIGHT"]);
const SEND_OUTCOMES_ONLY = new Set<ClimbOutcome>(["SEND", "REDPOINT"]);
const CLEAN_OUTCOMES = new Set<ClimbOutcome>(["FLASH", "ONSIGHT", "SEND", "REDPOINT"]);

export type ClimbsBrowserInitial = {
  q?: string;
  venue?: VenueFilter;
  outcome?: OutcomeFilter;
  location?: string;
  area?: string;
  grade?: string;
  range?: RangeFilter;
};

export default function ClimbsBrowser({
  attempts,
  locations,
  areas,
  initial,
}: {
  attempts: BrowserAttempt[];
  locations: BrowserLocation[];
  areas: BrowserArea[];
  initial: ClimbsBrowserInitial;
}) {
  // Local copy of the attempt list so inline edits land without a reload.
  const [rows, setRows] = useState(attempts);
  function applyEdit(updated: { id: string; grade: string; outcome: ClimbOutcome; notes: string | null; areaId: string | null; areaName: string | null }) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  const [q, setQ] = useState(initial.q ?? "");
  const [venue, setVenue] = useState<VenueFilter>(initial.venue ?? "all");
  const [outcome, setOutcome] = useState<OutcomeFilter>(
    // Legacy "working" filter (projects + recent falls) folded into project view.
    (initial.outcome as string) === "working" ? "project" : initial.outcome ?? "all"
  );
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [locationId, setLocationId] = useState(initial.location ?? "all");
  const [areaId, setAreaId] = useState(initial.area ?? "all");
  const [grade, setGrade] = useState(initial.grade ?? "all");
  const [range, setRange] = useState<RangeFilter>(initial.range ?? "1y");

  const projectsView = outcome === "project";

  // URL sync — replaceState so the back button leaves the page, not the
  // filter history (same decision as every other filter surface).
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (venue !== "all") params.set("venue", venue);
    if (outcome !== "all") params.set("outcome", outcome);
    if (locationId !== "all") params.set("location", locationId);
    if (areaId !== "all") params.set("area", areaId);
    if (grade !== "all") params.set("grade", grade);
    if (range !== "1y") params.set("range", range);
    const qs = params.toString();
    window.history.replaceState(null, "", `/activities/climbing/climbs${qs ? `?${qs}` : ""}`);
  }, [q, venue, outcome, locationId, areaId, grade, range]);

  const now = useMemo(() => new Date(), []);
  const cutoff = range === "all" ? null : new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000);

  const locationAreas = useMemo(
    () => (locationId === "all" ? [] : areas.filter((a) => a.locationId === locationId)),
    [areas, locationId]
  );

  // Shared slice — every filter EXCEPT outcome + range. The attempts list
  // view applies outcome + range on top; the projects view runs the
  // rollup over this slice (range intentionally ignored there: a project
  // is defined by its full attempt history, and a dormant project older
  // than the range window silently vanishing would read as data loss).
  const baseFiltered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return rows.filter((a) => {
      if (venue === "indoor" && a.venue !== "GYM") return false;
      if (venue === "outdoor" && a.venue !== "CRAG") return false;
      if (locationId !== "all" && a.locationId !== locationId) return false;
      if (areaId !== "all") {
        const expected = locationAreas.find((x) => x.id === areaId)?.name.toLowerCase() ?? null;
        const attemptArea = a.areaName?.trim().toLowerCase() ?? null;
        if (a.areaId !== areaId && attemptArea !== expected) return false;
      }
      if (grade !== "all" && a.grade !== grade) return false;
      if (search) {
        const haystack = [
          a.grade, a.areaName ?? "", a.notes ?? "", a.problemName ?? "", a.locationName ?? "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [rows, venue, locationId, areaId, grade, q, locationAreas]);

  const filtered = useMemo(() => {
    return baseFiltered.filter((a) => {
      if (cutoff && a.performedAt < cutoff) return false;
      if (outcome === "flashed" && !FLASH_OUTCOMES.has(a.outcome)) return false;
      if (outcome === "sent" && !SEND_OUTCOMES_ONLY.has(a.outcome)) return false;
      if (outcome === "falls" && a.outcome !== "FELL") return false;
      return true;
    });
  }, [baseFiltered, cutoff, outcome]);

  // ── Projects view — per-problem rollup over the base slice ──────────────
  const projects = useMemo(() => {
    if (!projectsView) return [];
    const rollup = buildProjectRollup(
      baseFiltered.map((a) => ({
        id: a.id,
        problemId: a.problemId,
        outcome: a.outcome,
        grade: a.grade,
        gradeSystem: a.gradeSystem,
        movesCompleted: a.movesCompleted,
        totalMoves: a.totalMoves,
        notes: a.notes,
        performedAt: a.performedAt,
      })),
      { now }
    );
    const activeCutoff = new Date(now.getTime() - ACTIVE_PROJECT_WINDOW_MS);
    // Decorate with name + location from any attempt on the problem.
    const attemptByProblem = new Map<string, BrowserAttempt>();
    for (const a of baseFiltered) {
      if (a.problemId && !attemptByProblem.has(a.problemId)) attemptByProblem.set(a.problemId, a);
    }
    return rollup
      .map((r) => {
        const sample = attemptByProblem.get(r.problemId);
        return {
          ...r,
          problemName: sample?.problemName ?? "Unnamed",
          locationId: sample?.locationId ?? null,
          locationName: sample?.locationName ?? null,
          isActive: r.lastAttempt >= activeCutoff,
        };
      })
      .filter((p) => {
        if (activity === "active") return p.isActive;
        if (activity === "dormant") return !p.isActive;
        return true;
      });
  }, [projectsView, baseFiltered, now, activity]);

  // ── Data-driven outcome options — buckets only render when matching
  // climbs actually exist, so retired outcomes (FELL) don't leave a
  // permanently-empty filter sitting in the UI. ─────────────────────────
  const outcomeOptions = useMemo(() => {
    const hasFlash = rows.some((a) => FLASH_OUTCOMES.has(a.outcome));
    const hasSent = rows.some((a) => SEND_OUTCOMES_ONLY.has(a.outcome));
    const hasProject = rows.some((a) => a.outcome === "PROJECT" || (a.problemId && !CLEAN_OUTCOMES.has(a.outcome)));
    const hasFalls = rows.some((a) => a.outcome === "FELL");
    const options: Array<[string, string]> = [["all", "All"]];
    if (hasFlash) options.push(["flashed", "⚡ Flashed"]);
    if (hasSent) options.push(["sent", "Sent"]);
    if (hasProject) options.push(["project", "Projects"]);
    if (hasFalls) options.push(["falls", "Falls"]);
    return options;
  }, [rows]);

  // Grade options follow the venue+location+range slice so switching grade
  // never strands you on an empty list.
  const gradeOptions = useMemo(() => {
    const candidates = rows.filter((a) => {
      if (cutoff && a.performedAt < cutoff) return false;
      if (venue === "indoor" && a.venue !== "GYM") return false;
      if (venue === "outdoor" && a.venue !== "CRAG") return false;
      if (locationId !== "all" && a.locationId !== locationId) return false;
      return true;
    });
    return Array.from(
      new Map(candidates.map((a) => [`${a.gradeSystem}::${a.grade}`, { grade: a.grade, system: a.gradeSystem }])).values()
    ).sort((a, b) => gradeSort(b.grade, b.system) - gradeSort(a.grade, a.system));
  }, [rows, cutoff, venue, locationId]);

  // Group by location, most-recent first; date sub-groups inside.
  const groups = useMemo(() => {
    type Group = {
      locationId: string | null;
      locationName: string;
      venue: "GYM" | "CRAG" | null;
      lastVisit: Date | null;
      attempts: BrowserAttempt[];
    };
    const map = new Map<string, Group>();
    for (const a of filtered) {
      const key = a.locationId ?? "__nl__";
      const g = map.get(key) ?? {
        locationId: a.locationId,
        locationName: a.locationName ?? "Unspecified location",
        venue: a.venue,
        lastVisit: null,
        attempts: [],
      };
      g.attempts.push(a);
      if (!g.lastVisit || a.performedAt > g.lastVisit) g.lastVisit = a.performedAt;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => (b.lastVisit?.getTime() ?? 0) - (a.lastVisit?.getTime() ?? 0));
  }, [filtered]);

  const sentCount = filtered.filter((a) => CLEAN_OUTCOMES.has(a.outcome)).length;
  const anyFilter =
    q.trim() !== "" || venue !== "all" || outcome !== "all" || locationId !== "all" ||
    areaId !== "all" || grade !== "all" || range !== "1y" || activity !== "all";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* ── Filter card ────────────────────────────────────────────── */}
      <div style={filterCardStyle}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, grade, area, notes, location…"
          style={searchInputStyle}
          aria-label="Search climbs"
        />

        <div style={segmentRowStyle}>
          <Segmented
            value={venue}
            onChange={(v) => setVenue(v as VenueFilter)}
            options={[["all", "All"], ["indoor", "🏠 Indoor"], ["outdoor", "🪨 Outdoor"]]}
          />
          {outcomeOptions.length > 1 ? (
            <Segmented
              value={outcome}
              onChange={(v) => setOutcome(v as OutcomeFilter)}
              options={outcomeOptions}
            />
          ) : null}
          {/* Range hides in projects view — a project is its full attempt
              history; date-windowing it would silently drop dormant ones. */}
          {projectsView ? (
            <Segmented
              value={activity}
              onChange={(v) => setActivity(v as ActivityFilter)}
              options={[["all", "All"], ["active", "Active"], ["dormant", "Dormant"]]}
            />
          ) : (
            <Segmented
              value={range}
              onChange={(v) => setRange(v as RangeFilter)}
              options={[["7d", "7d"], ["4w", "4w"], ["12w", "12w"], ["1y", "1y"], ["all", "All time"]]}
            />
          )}
        </div>

        <div style={selectRowStyle}>
          <select
            value={locationId}
            onChange={(e) => { setLocationId(e.target.value); setAreaId("all"); }}
            style={selectStyle}
            aria-label="Filter by location"
          >
            <option value="all">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.type === "GYM" ? "🏠" : "🪨"} {l.name}
              </option>
            ))}
          </select>
          {locationId !== "all" && locationAreas.length > 0 ? (
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} style={selectStyle} aria-label="Filter by area">
              <option value="all">All areas</option>
              {locationAreas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          ) : null}
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle} aria-label="Filter by grade">
            <option value="all">All grades</option>
            {gradeOptions.map((g) => (
              <option key={`${g.system}-${g.grade}`} value={g.grade}>{g.grade}</option>
            ))}
          </select>
          {anyFilter ? (
            <button
              type="button"
              onClick={() => {
                setQ(""); setVenue("all"); setOutcome("all"); setActivity("all");
                setLocationId("all"); setAreaId("all"); setGrade("all"); setRange("1y");
              }}
              style={resetBtnStyle}
            >
              Reset
            </button>
          ) : null}
        </div>

        <div style={summaryLineStyle}>
          {projectsView
            ? `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${projects.filter((p) => p.isActive).length} active`
            : `${filtered.length} climb${filtered.length !== 1 ? "s" : ""} · ${sentCount} clean`}
        </div>
      </div>

      {/* ── Results — projects view renders per-problem rollup cards ── */}
      {projectsView ? (
        <ProjectGroups projects={projects} now={now} />
      ) : groups.length === 0 ? (
        <div style={emptyCardStyle}>No climbs match — try removing a filter.</div>
      ) : (
        groups.map((group) => (
          <section key={group.locationId ?? "__nl__"} style={groupCardStyle}>
            <div style={groupHeaderStyle}>
              <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 900 }}>
                  {group.venue === "GYM" ? "🏠 " : group.venue === "CRAG" ? "🪨 " : ""}{group.locationName}
                </span>
                <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
                  {group.attempts.length} climb{group.attempts.length !== 1 ? "s" : ""}
                  {group.lastVisit ? ` · last visit ${relativeFromNow(group.lastVisit, now)}` : ""}
                </span>
              </div>
              {group.locationId ? (
                <Link href={`/activities/climbing/locations/${encodeURIComponent(group.locationId)}`} style={detailLinkStyle}>
                  Details →
                </Link>
              ) : null}
            </div>
            <ClimbList
              attempts={group.attempts}
              areaOptions={areas.filter((a) => a.locationId === group.locationId).map((a) => a.name)}
              onSaved={applyEdit}
            />
          </section>
        ))
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div style={segmentedStyle} role="group">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={value === v ? segmentActiveStyle : segmentStyle}
          aria-pressed={value === v}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type EditResult = { id: string; grade: string; outcome: ClimbOutcome; notes: string | null; areaId: string | null; areaName: string | null };

function ClimbList({
  attempts,
  areaOptions,
  onSaved,
}: {
  attempts: BrowserAttempt[];
  areaOptions: string[];
  onSaved: (updated: EditResult) => void;
}) {
  const byDate = new Map<string, BrowserAttempt[]>();
  for (const a of attempts) {
    const key = a.performedAt.toISOString().slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(a);
    byDate.set(key, list);
  }
  const dateGroups = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {dateGroups.map(([dateKey, dateAttempts]) => {
        const first = dateAttempts[0];
        return (
          <div key={dateKey} style={{ display: "grid", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>
                {formatAppDate(first.performedAt, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, opacity: 0.6 }}>
                  · {relativeFromNow(first.performedAt)}
                </span>
              </span>
              <Link
                href={`/routines/${first.routineId}/logs/${first.sessionLogId}/details`}
                style={{ fontSize: 11, fontWeight: 700, opacity: 0.65, textDecoration: "none", color: "inherit", whiteSpace: "nowrap" }}
              >
                Session →
              </Link>
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              {dateAttempts.map((a) => (
                <ClimbRow key={a.id} attempt={a} areaOptions={areaOptions} onSaved={onSaved} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type DecoratedProject = {
  problemId: string;
  problemName: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  locationId: string | null;
  locationName: string | null;
  attemptCount: number;
  lastAttempt: Date;
  bestMoves: { completed: number; total: number } | null;
  lastNotes: string | null;
  isActive: boolean;
};

function ProjectGroups({ projects, now }: { projects: DecoratedProject[]; now: Date }) {
  if (projects.length === 0) {
    return (
      <div style={emptyCardStyle}>
        No projects match. Log attempts on named problems (without a clean send) to track them here.
      </div>
    );
  }
  type Group = { locationId: string | null; locationName: string; items: DecoratedProject[] };
  const map = new Map<string, Group>();
  for (const p of projects) {
    const key = p.locationId ?? "__nl__";
    const g = map.get(key) ?? {
      locationId: p.locationId,
      locationName: p.locationName ?? "Unknown location",
      items: [],
    };
    g.items.push(p);
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.items.sort((a, b) => {
      const gd = gradeSort(b.grade, b.gradeSystem) - gradeSort(a.grade, a.gradeSystem);
      if (gd !== 0) return gd;
      return b.lastAttempt.getTime() - a.lastAttempt.getTime();
    });
  }
  const groups = [...map.values()].sort((a, b) => {
    const aLast = Math.max(...a.items.map((i) => i.lastAttempt.getTime()));
    const bLast = Math.max(...b.items.map((i) => i.lastAttempt.getTime()));
    return bLast - aLast;
  });
  return (
    <>
      {groups.map((group) => (
        <section key={group.locationId ?? "__nl__"} style={groupCardStyle}>
          <div style={groupHeaderStyle}>
            <span style={{ fontSize: 14, fontWeight: 900, flex: 1, minWidth: 0 }}>{group.locationName}</span>
            {group.locationId ? (
              <Link href={`/activities/climbing/locations/${encodeURIComponent(group.locationId)}`} style={detailLinkStyle}>
                Details →
              </Link>
            ) : null}
          </div>
          <div className="climbing-detail-grid">
            {group.items.map((p) => (
              <ProjectMiniCard key={p.problemId} project={p} now={now} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ProjectMiniCard({ project, now }: { project: DecoratedProject; now: Date }) {
  const movesPct = project.bestMoves && project.bestMoves.total > 0
    ? Math.min(100, Math.round((project.bestMoves.completed / project.bestMoves.total) * 100))
    : null;
  const inner = (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        background: project.isActive ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
        border: project.isActive ? "1px solid rgba(167,139,250,0.32)" : "1px solid rgba(255,255,255,0.06)",
        cursor: project.locationId ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={projectGradeChipStyle}>{project.grade}</span>
        <span style={{ fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.problemName}
        </span>
        <span style={project.isActive ? activeChipStyle : dormantChipStyle}>
          {project.isActive ? "ACTIVE" : "DORMANT"}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11.5, opacity: 0.75 }}>
        <span>{project.attemptCount} attempt{project.attemptCount === 1 ? "" : "s"}</span>
        {project.bestMoves && project.bestMoves.total > 0 ? (
          <span>· {project.bestMoves.completed}/{project.bestMoves.total} moves</span>
        ) : null}
        <span>· last {formatAppDate(project.lastAttempt, { month: "short", day: "numeric" })} ({relativeFromNow(project.lastAttempt, now)})</span>
      </div>
      {movesPct !== null ? (
        <div style={movesTrackStyle} aria-hidden>
          <div style={{ ...movesFillStyle, width: `${movesPct}%` }} />
        </div>
      ) : null}
      {project.lastNotes ? (
        <p
          style={{
            fontSize: 12, lineHeight: 1.4, margin: 0, opacity: 0.85, fontStyle: "italic",
            whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
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

function ClimbRow({
  attempt,
  areaOptions,
  onSaved,
}: {
  attempt: BrowserAttempt;
  areaOptions: string[];
  onSaved: (updated: EditResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftGrade, setDraftGrade] = useState(attempt.grade);
  const [draftOutcome, setDraftOutcome] = useState<ClimbOutcome>(attempt.outcome);
  const [draftArea, setDraftArea] = useState(attempt.areaName ?? "");
  const [draftNotes, setDraftNotes] = useState(attempt.notes ?? "");

  const color = climbOutcomeColor(attempt.outcome);
  const bg = climbOutcomeBg(attempt.outcome);

  function startEdit() {
    setDraftGrade(attempt.grade);
    setDraftOutcome(attempt.outcome);
    setDraftArea(attempt.areaName ?? "");
    setDraftNotes(attempt.notes ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateClimbAttempt({
        id: attempt.id,
        grade: draftGrade,
        outcome: draftOutcome,
        notes: draftNotes.trim() || null,
        areaName: draftArea.trim() || null,
      });
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    // Grade options for the attempt's discipline; current grade kept even
    // if it's somehow off-list (legacy data).
    const grades = climbingGradeOptionsForDiscipline(attempt.discipline);
    const gradeList = grades.includes(draftGrade) ? grades : [draftGrade, ...grades];
    const outcomes = climbOutcomesForDiscipline(attempt.discipline);
    const datalistId = `climb-edit-areas-${attempt.id}`;
    return (
      <div style={{ ...climbRowStyle, display: "grid", gap: 8, alignItems: "stretch" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <select value={draftGrade} onChange={(e) => setDraftGrade(e.target.value)} style={editSelectStyle} aria-label="Grade">
            {gradeList.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {outcomes.map((o) => {
            const oc = climbOutcomeColor(o);
            const active = draftOutcome === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => setDraftOutcome(o)}
                style={{
                  padding: "6px 11px",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: active ? oc : "rgba(255,255,255,0.12)",
                  background: active ? climbOutcomeBg(o) : "rgba(255,255,255,0.04)",
                  color: active ? oc : "rgba(255,255,255,0.75)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                aria-pressed={active}
              >
                {climbOutcomeLabel(o, attempt.gradeSystem)}
              </button>
            );
          })}
        </div>
        <input
          value={draftArea}
          onChange={(e) => setDraftArea(e.target.value)}
          list={datalistId}
          placeholder="Area (optional)"
          style={editInputStyle}
          aria-label="Area"
        />
        <datalist id={datalistId}>
          {areaOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="Notes (optional)"
          style={editInputStyle}
          aria-label="Notes"
        />
        {error ? <div style={editErrorStyle}>{error}</div> : null}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setEditing(false)} style={editGhostBtnStyle} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={save} style={editSaveBtnStyle} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={climbRowStyle}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 900,
          padding: "4px 10px",
          borderRadius: 8,
          background: bg,
          color,
          border: `1px solid ${color.replace("0.9)", "0.32)")}`,
          minWidth: 44,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {attempt.grade}
      </span>
      <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>
          {climbOutcomeLabel(attempt.outcome, attempt.gradeSystem)}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, opacity: 0.7 }}>
          {attempt.problemName ? <span style={{ fontWeight: 700 }}>{attempt.problemName}</span> : null}
          {attempt.areaName ? <span>· {attempt.areaName}</span> : null}
          {attempt.notes ? (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              · {attempt.notes}
            </span>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={startEdit} style={rowEditBtnStyle} title="Edit climb" aria-label="Edit climb">
        ✎
      </button>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const filterCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
};

// fontSize 16 — iOS Safari auto-zoom guard (CLAUDE.md rule 3a). The old
// page's search input was 13px and zoomed on focus.
const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
};

const segmentRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const segmentedStyle: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  overflow: "hidden",
  flexWrap: "nowrap",
};

const segmentStyle: CSSProperties = {
  padding: "6px 11px",
  minHeight: 34,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.75)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const segmentActiveStyle: CSSProperties = {
  ...segmentStyle,
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
};

const selectRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

// fontSize 16 — iOS zoom guard on selects too.
const selectStyle: CSSProperties = {
  flex: "1 1 150px",
  minWidth: 0,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
  cursor: "pointer",
};

const resetBtnStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  flexShrink: 0,
};

const summaryLineStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  opacity: 0.6,
};

const emptyCardStyle: CSSProperties = {
  padding: "24px 14px",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.12)",
  textAlign: "center",
  fontSize: 13,
  opacity: 0.6,
};

const groupCardStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
};

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const detailLinkStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid rgba(120,190,255,0.32)",
  background: "rgba(120,190,255,0.10)",
  color: "rgba(191,219,254,0.95)",
  textDecoration: "none",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const climbRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
};

const rowEditBtnStyle: CSSProperties = {
  width: 30,
  height: 30,
  minHeight: 0,
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  color: "rgba(255,255,255,0.5)",
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

// Editor inputs — fontSize 16 (iOS zoom guard, rule 3a).
const editInputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
};

const editSelectStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 700,
  outline: "none",
  cursor: "pointer",
};

const editGhostBtnStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "rgba(255,255,255,0.75)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const editSaveBtnStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const editErrorStyle: CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};

const projectGradeChipStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  padding: "4px 10px",
  borderRadius: 8,
  background: "rgba(167,139,250,0.12)",
  color: "rgba(196,181,253,0.95)",
  border: "1px solid rgba(167,139,250,0.32)",
  minWidth: 44,
  textAlign: "center",
  flexShrink: 0,
};

const activeChipStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid rgba(167,139,250,0.4)",
  background: "rgba(167,139,250,0.14)",
  color: "rgba(196,181,253,0.95)",
  letterSpacing: 0.5,
  flexShrink: 0,
};

const dormantChipStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.6)",
  letterSpacing: 0.5,
  flexShrink: 0,
};

const movesTrackStyle: CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const movesFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "rgba(167,139,250,0.85)",
};
