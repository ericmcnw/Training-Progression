"use client";

// Instant project browser. The server runs the project rollup once over
// all attempts and hands the decorated rows here; activity / venue /
// location filtering is client-side so taps update instantly with no
// page reloads. URL syncs via replaceState for refresh + deep links.

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import { gradeSort, type ClimbGradeSystem } from "@/lib/climb-types";

export type BrowserProject = {
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

type ActivityFilter = "all" | "active" | "dormant";
type VenueFilter = "all" | "indoor" | "outdoor";

export type ProjectsBrowserInitial = {
  activity?: ActivityFilter;
  venue?: VenueFilter;
  location?: string;
};

export default function ProjectsBrowser({
  projects,
  locations,
  initial,
}: {
  projects: BrowserProject[];
  locations: Array<{ id: string; name: string; type: "GYM" | "CRAG" }>;
  initial: ProjectsBrowserInitial;
}) {
  const [activity, setActivity] = useState<ActivityFilter>(initial.activity ?? "all");
  const [venue, setVenue] = useState<VenueFilter>(initial.venue ?? "all");
  const [locationId, setLocationId] = useState(initial.location ?? "all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (activity !== "all") params.set("activity", activity);
    if (venue !== "all") params.set("venue", venue);
    if (locationId !== "all") params.set("location", locationId);
    const qs = params.toString();
    window.history.replaceState(null, "", `/activities/climbing/projects${qs ? `?${qs}` : ""}`);
  }, [activity, venue, locationId]);

  const now = useMemo(() => new Date(), []);

  const activeCount = projects.filter((p) => p.isActive).length;
  const dormantCount = projects.length - activeCount;

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (activity === "active" && !p.isActive) return false;
      if (activity === "dormant" && p.isActive) return false;
      if (venue === "indoor" && p.locationType !== "GYM") return false;
      if (venue === "outdoor" && p.locationType !== "CRAG") return false;
      if (locationId !== "all" && p.locationId !== locationId) return false;
      return true;
    });
  }, [projects, activity, venue, locationId]);

  // Group by location, hardest grade first inside each, most-recently
  // touched group first.
  const groups = useMemo(() => {
    type Group = {
      locationId: string | null;
      locationName: string;
      items: BrowserProject[];
    };
    const map = new Map<string, Group>();
    for (const p of filtered) {
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
    return [...map.values()].sort((a, b) => {
      const aLast = Math.max(...a.items.map((i) => i.lastAttempt.getTime()));
      const bLast = Math.max(...b.items.map((i) => i.lastAttempt.getTime()));
      return bLast - aLast;
    });
  }, [filtered]);

  const anyFilter = activity !== "all" || venue !== "all" || locationId !== "all";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* ── Filter card ────────────────────────────────────────────── */}
      <div style={filterCardStyle}>
        <div style={segmentRowStyle}>
          <Segmented
            value={activity}
            onChange={(v) => setActivity(v as ActivityFilter)}
            options={[
              ["all", `All (${projects.length})`],
              ["active", `Active (${activeCount})`],
              ["dormant", `Dormant (${dormantCount})`],
            ]}
          />
          <Segmented
            value={venue}
            onChange={(v) => setVenue(v as VenueFilter)}
            options={[["all", "All"], ["indoor", "🏠 Indoor"], ["outdoor", "🪨 Outdoor"]]}
          />
        </div>
        <div style={selectRowStyle}>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
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
          {anyFilter ? (
            <button
              type="button"
              onClick={() => { setActivity("all"); setVenue("all"); setLocationId("all"); }}
              style={resetBtnStyle}
            >
              Reset
            </button>
          ) : null}
        </div>
        <div style={summaryLineStyle}>
          {filtered.length} project{filtered.length !== 1 ? "s" : ""} shown
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div style={emptyCardStyle}>
          No projects match. Tag attempts as PROJECT (or fall on a named problem) to start tracking.
        </div>
      ) : (
        groups.map((group) => (
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
                <ProjectCard key={p.problemId} project={p} now={now} />
              ))}
            </div>
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

function ProjectCard({ project, now }: { project: BrowserProject; now: Date }) {
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
        {project.isActive ? <span style={activeChipStyle}>ACTIVE</span> : <span style={dormantChipStyle}>DORMANT</span>}
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

// ── Styles ───────────────────────────────────────────────────────────────────

const filterCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
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

const selectStyle: CSSProperties = {
  flex: "1 1 200px",
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

const gradeChipStyle: CSSProperties = {
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
