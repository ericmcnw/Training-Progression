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
  gradeSort,
  SENT_OUTCOMES,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";

export type BrowserAttempt = {
  id: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  areaId: string | null;
  areaName: string | null;
  notes: string | null;
  problemName: string | null;
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
type OutcomeFilter = "all" | "sent" | "working" | "project" | "falls";
type RangeFilter = "7d" | "4w" | "12w" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<RangeFilter, "all">, number> = {
  "7d": 7, "4w": 28, "12w": 84, "1y": 365,
};
const WORKING_FALL_RECENCY_DAYS = 30;

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
  const [q, setQ] = useState(initial.q ?? "");
  const [venue, setVenue] = useState<VenueFilter>(initial.venue ?? "all");
  const [outcome, setOutcome] = useState<OutcomeFilter>(initial.outcome ?? "all");
  const [locationId, setLocationId] = useState(initial.location ?? "all");
  const [areaId, setAreaId] = useState(initial.area ?? "all");
  const [grade, setGrade] = useState(initial.grade ?? "all");
  const [range, setRange] = useState<RangeFilter>(initial.range ?? "1y");

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

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return attempts.filter((a) => {
      if (cutoff && a.performedAt < cutoff) return false;
      if (venue === "indoor" && a.venue !== "GYM") return false;
      if (venue === "outdoor" && a.venue !== "CRAG") return false;
      if (locationId !== "all" && a.locationId !== locationId) return false;
      if (areaId !== "all") {
        const expected = locationAreas.find((x) => x.id === areaId)?.name.toLowerCase() ?? null;
        const attemptArea = a.areaName?.trim().toLowerCase() ?? null;
        if (a.areaId !== areaId && attemptArea !== expected) return false;
      }
      if (grade !== "all" && a.grade !== grade) return false;
      if (outcome !== "all") {
        if (outcome === "sent" && !SENT_OUTCOMES.has(a.outcome)) return false;
        if (outcome === "project" && a.outcome !== "PROJECT") return false;
        if (outcome === "falls" && a.outcome !== "FELL") return false;
        if (outcome === "working") {
          const isProject = a.outcome === "PROJECT";
          const isRecentFall =
            a.outcome === "FELL" &&
            (now.getTime() - a.performedAt.getTime()) / 86_400_000 <= WORKING_FALL_RECENCY_DAYS;
          if (!isProject && !isRecentFall) return false;
        }
      }
      if (search) {
        const haystack = [
          a.grade, a.areaName ?? "", a.notes ?? "", a.problemName ?? "", a.locationName ?? "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [attempts, cutoff, venue, locationId, areaId, grade, outcome, q, locationAreas, now]);

  // Grade options follow the venue+location+range slice so switching grade
  // never strands you on an empty list.
  const gradeOptions = useMemo(() => {
    const candidates = attempts.filter((a) => {
      if (cutoff && a.performedAt < cutoff) return false;
      if (venue === "indoor" && a.venue !== "GYM") return false;
      if (venue === "outdoor" && a.venue !== "CRAG") return false;
      if (locationId !== "all" && a.locationId !== locationId) return false;
      return true;
    });
    return Array.from(
      new Map(candidates.map((a) => [`${a.gradeSystem}::${a.grade}`, { grade: a.grade, system: a.gradeSystem }])).values()
    ).sort((a, b) => gradeSort(b.grade, b.system) - gradeSort(a.grade, a.system));
  }, [attempts, cutoff, venue, locationId]);

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

  const sentCount = filtered.filter((a) => SENT_OUTCOMES.has(a.outcome)).length;
  const projectCount = filtered.filter((a) => a.outcome === "PROJECT").length;
  const anyFilter =
    q.trim() !== "" || venue !== "all" || outcome !== "all" || locationId !== "all" ||
    areaId !== "all" || grade !== "all" || range !== "1y";

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
          <Segmented
            value={outcome}
            onChange={(v) => setOutcome(v as OutcomeFilter)}
            options={[["all", "All"], ["sent", "Sent"], ["working", "Working"], ["project", "Projects"], ["falls", "Falls"]]}
          />
          <Segmented
            value={range}
            onChange={(v) => setRange(v as RangeFilter)}
            options={[["7d", "7d"], ["4w", "4w"], ["12w", "12w"], ["1y", "1y"], ["all", "All time"]]}
          />
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
                setQ(""); setVenue("all"); setOutcome("all"); setLocationId("all");
                setAreaId("all"); setGrade("all"); setRange("1y");
              }}
              style={resetBtnStyle}
            >
              Reset
            </button>
          ) : null}
        </div>

        <div style={summaryLineStyle}>
          {filtered.length} climb{filtered.length !== 1 ? "s" : ""} · {sentCount} sent · {projectCount} project{projectCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
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
            <ClimbList attempts={group.attempts} />
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

function ClimbList({ attempts }: { attempts: BrowserAttempt[] }) {
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
                <ClimbRow key={a.id} attempt={a} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClimbRow({ attempt }: { attempt: BrowserAttempt }) {
  const color = climbOutcomeColor(attempt.outcome);
  const bg = climbOutcomeBg(attempt.outcome);
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
