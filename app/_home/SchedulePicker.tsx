"use client";

// SchedulePicker — mirrors the /log routines list so users see the
// same mental model when scheduling vs logging:
//
//   STRENGTH   ▾   collapsible — tap a saved workout to schedule it
//   ENDURANCE  ▾   collapsible — activity-type pills + saved cardio routines
//   SPORTS     ▾   collapsible — sport tiles (instant-schedule) + legacy sport routines
//   MOBILITY   ▾   collapsible — saved mobility routines
//   LIFESTYLE  ▾   collapsible — saved habit/lifestyle routines
//
// One tap = scheduled for the chosen day, modal closes. Render-only
// for picking; the actual logging happens later when the day arrives.
// Search bar at the top filters the routine items within sections
// without collapsing the section headers (sections with no matches
// auto-hide).

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import Popover from "./Popover";
import type { QuickPickRoutine } from "./types";
import { COLOR, DOMAIN_LABEL } from "./tokens";
import { domainAccent } from "./client-utils";
import {
  scheduleEnduranceTypeForDay,
  scheduleRoutineForDay,
  scheduleSportForDay,
} from "./schedule-actions";

export type ScheduleActivityType = {
  id: string;
  slug: string;
  name: string;
  familyId: string;
  familyName: string;
};

export type ScheduleSport = {
  slug: string;
  label: string;
  eyebrow: string;
  color: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  ymd: string;
  dateLabel: string;
  routines: QuickPickRoutine[];
  /** Endurance activity types — populates the ENDURANCE section's
   *  type-pill row. Empty array means no typed-endurance shortcut
   *  (the section still shows saved cardio routines). */
  activityTypes?: ScheduleActivityType[];
  /** Sports the user has added on /log. Populates SPORTS section
   *  tiles, each instant-schedules the sport's synthetic routine. */
  sports?: ScheduleSport[];
};

// Order matches /log so the schedule picker reads identical.
const DOMAIN_ORDER = ["strength", "cardio", "sport", "mobility", "lifestyle"] as const;
type Domain = (typeof DOMAIN_ORDER)[number];

// Per-domain accent colors for the section header. Match the
// /log domain colors + sports-chart palette so the visual ties
// across the app.
const DOMAIN_ACCENT: Record<Domain, string> = {
  strength: "rgba(74,222,128,0.9)",
  cardio: "rgba(78,148,255,0.9)",
  sport: "rgba(251,146,60,0.9)",
  mobility: "rgba(167,139,250,0.9)",
  lifestyle: "rgba(244,114,182,0.9)",
};

const DOMAIN_DISPLAY_LABEL: Record<Domain, string> = {
  strength: "Strength",
  cardio: "Endurance",
  sport: "Sports",
  mobility: "Mobility",
  lifestyle: "Lifestyle",
};

export default function SchedulePicker({
  open,
  onClose,
  ymd,
  dateLabel,
  routines,
  activityTypes = [],
  sports = [],
}: Props) {
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // All sections collapsed by default — matches /log's behavior so
  // both surfaces read the same. Search auto-expands matching
  // sections so the user can scan hits without manual tapping.
  const [openSections, setOpenSections] = useState<Record<Domain, boolean>>({
    strength: false,
    cardio: false,
    sport: false,
    mobility: false,
    lifestyle: false,
  });

  // Reset everything when the modal closes so the next open feels
  // fresh (no stale filter, no leftover open/closed memory).
  useEffect(() => {
    if (!open) {
      setFilter("");
      setError(null);
    }
  }, [open]);

  function pickRoutine(routineId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleRoutineForDay({ routineId, ymd });
        onClose();
      } catch {
        setError("Couldn't add to schedule. Try again.");
      }
    });
  }

  function pickEnduranceType(activityTypeId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleEnduranceTypeForDay({ activityTypeId, ymd });
        onClose();
      } catch {
        setError("Couldn't add endurance to schedule. Try again.");
      }
    });
  }

  function pickSport(sportSlug: string) {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleSportForDay({ sportSlug, ymd });
        onClose();
      } catch {
        setError("Couldn't add sport to schedule. Try again.");
      }
    });
  }

  // Group activity types by family for the ENDURANCE section row
  // (Running ▸ Run / Trail Run / …). Family is the visual grouping
  // the user already sees on the endurance dashboard.
  const enduranceGroups = useMemo(() => {
    const byFamily = new Map<
      string,
      { familyId: string; familyName: string; types: ScheduleActivityType[] }
    >();
    for (const t of activityTypes) {
      const cur = byFamily.get(t.familyId) ?? {
        familyId: t.familyId,
        familyName: t.familyName,
        types: [],
      };
      cur.types.push(t);
      byFamily.set(t.familyId, cur);
    }
    return [...byFamily.values()];
  }, [activityTypes]);

  // Bucket the saved routines by domain.
  const routinesByDomain = useMemo(() => {
    const norm = filter.trim().toLowerCase();
    const filtered = norm
      ? routines.filter((r) => r.routineName.toLowerCase().includes(norm))
      : routines;
    const byDomain = new Map<string, QuickPickRoutine[]>();
    for (const r of filtered) {
      const key = (r.domain ?? "general").toLowerCase();
      const list = byDomain.get(key) ?? [];
      list.push(r);
      byDomain.set(key, list);
    }
    return byDomain;
  }, [routines, filter]);

  // Whether a section should render at all. Filtering hides empty
  // sections so a search like "row" doesn't leave four empty headers.
  // Sport section also surfaces when sports tiles exist even with no
  // legacy sport routines; endurance section ditto for type pills.
  function sectionHasContent(domain: Domain): boolean {
    const norm = filter.trim().toLowerCase();
    const hasRoutines = (routinesByDomain.get(domain) ?? []).length > 0;
    if (domain === "cardio") {
      const typesMatch = norm
        ? enduranceGroups.some((g) =>
            g.types.some(
              (t) => t.name.toLowerCase().includes(norm) || g.familyName.toLowerCase().includes(norm),
            ),
          )
        : enduranceGroups.length > 0;
      return hasRoutines || typesMatch;
    }
    if (domain === "sport") {
      const sportsMatch = norm
        ? sports.some(
            (s) => s.label.toLowerCase().includes(norm) || s.eyebrow.toLowerCase().includes(norm),
          )
        : sports.length > 0;
      return hasRoutines || sportsMatch;
    }
    return hasRoutines;
  }

  function toggleSection(d: Domain) {
    setOpenSections((prev) => ({ ...prev, [d]: !prev[d] }));
  }

  // When searching, force-open every matching section so the user
  // can see hits without having to expand each one. Empty filter
  // restores the user's open/closed choices.
  const effectiveOpen: Record<Domain, boolean> = useMemo(() => {
    if (filter.trim() === "") return openSections;
    const expanded: Record<Domain, boolean> = { ...openSections };
    for (const d of DOMAIN_ORDER) {
      if (sectionHasContent(d)) expanded[d] = true;
    }
    return expanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, openSections, routinesByDomain, enduranceGroups, sports]);

  return (
    <Popover
      open={open}
      onClose={onClose}
      title="Add to schedule"
      subtitle={dateLabel}
      desktopWidth={440}
    >
      <div style={searchRow}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search routines, sports, endurance types…"
          style={searchInput}
          disabled={pending}
        />
      </div>

      {error ? (
        <div role="alert" style={errorText}>
          {error}
        </div>
      ) : null}

      <div style={sectionStack}>
        {DOMAIN_ORDER.map((domain) => {
          if (!sectionHasContent(domain)) return null;
          const isOpen = effectiveOpen[domain];
          const accent = DOMAIN_ACCENT[domain];
          const label = DOMAIN_DISPLAY_LABEL[domain];
          const sectionRoutines = routinesByDomain.get(domain) ?? [];
          const norm = filter.trim().toLowerCase();

          return (
            <section
              key={domain}
              style={{ ...sectionShell, borderLeft: `3px solid ${accent}` }}
            >
              <button
                type="button"
                onClick={() => toggleSection(domain)}
                style={sectionHeader}
                aria-expanded={isOpen}
              >
                <span style={sectionCaret} aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
                <span style={{ ...sectionTitle, color: accent }}>{label}</span>
                <span style={sectionCount}>
                  {countForSection(domain, sectionRoutines.length, sports, enduranceGroups, norm)}
                </span>
              </button>

              {isOpen ? (
                <div style={sectionBody}>
                  {/* ENDURANCE — activity type pills first, then saved routines */}
                  {domain === "cardio" && enduranceGroups.length > 0 ? (
                    <div style={typePillBlock}>
                      {enduranceGroups.map((g) => {
                        const matchedTypes = norm
                          ? g.types.filter((t) => t.name.toLowerCase().includes(norm))
                          : g.types;
                        if (matchedTypes.length === 0) return null;
                        return (
                          <div key={g.familyId} style={typeFamilyStack}>
                            <div style={typeFamilyLabel}>{g.familyName}</div>
                            <div style={typePillRow}>
                              {matchedTypes.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => pickEnduranceType(t.id)}
                                  disabled={pending}
                                  style={typePill}
                                >
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* SPORTS — sport tiles. Each tile instant-schedules
                      the sport's synthetic routine for the picked day. */}
                  {domain === "sport" && sports.length > 0 ? (
                    <div style={sportTileGrid}>
                      {sports
                        .filter((s) =>
                          norm
                            ? s.label.toLowerCase().includes(norm) ||
                              s.eyebrow.toLowerCase().includes(norm)
                            : true,
                        )
                        .map((sport) => (
                          <button
                            key={sport.slug}
                            type="button"
                            onClick={() => pickSport(sport.slug)}
                            disabled={pending}
                            style={{
                              ...sportTile,
                              borderLeft: `3px solid ${sport.color}`,
                            }}
                          >
                            <span style={sportTileEyebrow}>{sport.eyebrow}</span>
                            <span style={sportTileLabel}>{sport.label}</span>
                          </button>
                        ))}
                    </div>
                  ) : null}

                  {/* Saved routines — shared layout across all
                      domains. Empty when filter matches nothing. */}
                  {sectionRoutines.length > 0 ? (
                    <ul style={routineList}>
                      {sectionRoutines.map((r) => (
                        <li key={r.routineId}>
                          <button
                            type="button"
                            onClick={() => pickRoutine(r.routineId)}
                            disabled={pending}
                            style={routineRow}
                          >
                            <span
                              style={{
                                ...routineDot,
                                background: domainAccent(r.domain),
                              }}
                              aria-hidden
                            />
                            <span style={routineRowText}>{r.routineName}</span>
                            <span style={routineRowKind}>{r.kind.toLowerCase()}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}

        {/* All-empty hint — fired only when filtering wipes out
            everything; the user knows there's nothing to pick. */}
        {filter.trim() !== "" &&
        !DOMAIN_ORDER.some((d) => sectionHasContent(d)) ? (
          <div style={emptyState}>No matches in routines, sports, or endurance types.</div>
        ) : null}
      </div>
    </Popover>
  );
}

// Builds the "(N)" badge after a section title. Counts whatever is
// visible inside that section given the current filter.
function countForSection(
  domain: Domain,
  routineCount: number,
  sports: ScheduleSport[],
  enduranceGroups: Array<{ types: ScheduleActivityType[]; familyName: string }>,
  norm: string,
): string {
  if (domain === "cardio") {
    const typeCount = norm
      ? enduranceGroups.reduce(
          (sum, g) =>
            sum + g.types.filter((t) => t.name.toLowerCase().includes(norm)).length,
          0,
        )
      : enduranceGroups.reduce((sum, g) => sum + g.types.length, 0);
    const total = routineCount + typeCount;
    return total === 0 ? "" : `${total}`;
  }
  if (domain === "sport") {
    const sportCount = norm
      ? sports.filter(
          (s) =>
            s.label.toLowerCase().includes(norm) || s.eyebrow.toLowerCase().includes(norm),
        ).length
      : sports.length;
    const total = routineCount + sportCount;
    return total === 0 ? "" : `${total}`;
  }
  return routineCount === 0 ? "" : `${routineCount}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const searchRow: CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 10,
};

// 16px floor on font-size enforced via globals; explicit boxSizing
// + width:100% so the input doesn't overflow on narrow modals.
const searchInput: CSSProperties = {
  flex: 1,
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.text,
};

const sectionStack: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 8,
  maxHeight: "60vh",
  overflowY: "auto",
  overflowX: "clip",
  minWidth: 0,
};

const sectionShell: CSSProperties = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.018)",
  overflow: "hidden",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.025)",
  border: "none",
  width: "100%",
  cursor: "pointer",
  textAlign: "left",
  color: "inherit",
};

const sectionCaret: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
  width: 12,
  flexShrink: 0,
};

const sectionTitle: CSSProperties = {
  flex: 1,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const sectionCount: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  flexShrink: 0,
};

const sectionBody: CSSProperties = {
  padding: "10px 12px 12px",
  display: "grid",
  gap: 10,
  minWidth: 0,
};

// Endurance activity type pills — grouped by family.
const typePillBlock: CSSProperties = {
  display: "grid",
  gap: 8,
};

const typeFamilyStack: CSSProperties = {
  display: "grid",
  gap: 5,
};

const typeFamilyLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};

const typePillRow: CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const typePill: CSSProperties = {
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid rgba(78,148,255,0.32)",
  background: "rgba(78,148,255,0.08)",
  color: "rgba(191,219,254,0.95)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 36,
};

// Sport tiles — each instant-schedules the sport's synthetic routine.
const sportTileGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 6,
};

const sportTile: CSSProperties = {
  display: "grid",
  gap: 2,
  textAlign: "left",
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.025)",
  color: "inherit",
  cursor: "pointer",
  minHeight: 52,
};

const sportTileEyebrow: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const sportTileLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: -0.1,
};

// Saved routines.
const routineList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
};

const routineRow: CSSProperties = {
  all: "unset",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 11px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
  color: COLOR.text,
  cursor: "pointer",
  minHeight: 44,
  width: "100%",
  boxSizing: "border-box",
};

const routineDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const routineRowText: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const routineRowKind: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  flexShrink: 0,
};

const emptyState: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  padding: "16px 6px",
  fontStyle: "italic",
  textAlign: "center",
};

const errorText: CSSProperties = {
  fontSize: 12,
  color: COLOR.red,
  fontWeight: 700,
  padding: "4px 2px",
  marginBottom: 6,
};
