"use client";

// QuickLogPicker — the "Log a routine" subview of the FAB menu.
// Mirrors SchedulePicker's collapsible domain structure so the home
// FAB and the schedule picker read identically (and identical to the
// /log page's domain sections).
//
//   STRENGTH   ▾   saved workout routines
//   ENDURANCE  ▾   activity-type pills + saved cardio routines
//   SPORTS     ▾   sport tiles + legacy sport routines
//   MOBILITY   ▾   saved mobility routines
//   LIFESTYLE  ▾   saved habit routines
//
// All actions log immediately for today (rather than scheduling for
// a future day). Sport tiles bubble up via onSportSelected so the
// parent can mount the sport-specific log sheet (each sport has its
// own rich form — ClimbLogSheet, GolfLogSheet, generic LogSheet).
// Endurance type taps open the LogDrawer against the synthetic
// Endurance routine; the user picks the type in the form.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { QuickPickRoutine } from "./types";
import { COLOR } from "./tokens";
import { domainAccent } from "./client-utils";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import type { ScheduleActivityType, ScheduleSport } from "./SchedulePicker";

type Props = {
  routines: QuickPickRoutine[];
  activityTypes?: ScheduleActivityType[];
  sports?: ScheduleSport[];
  /** Called when the user picks a sport tile. Parent mounts the
   *  sport-specific log sheet (which already handles all the rich
   *  fields per sport). */
  onSportSelected: (sport: ScheduleSport) => void;
  onClose: () => void;
  filter: string;
  onFilter: (next: string) => void;
  /** Section to start expanded — the FAB's "Log endurance" / "Log a
   *  sport" shortcuts land here with the relevant section already open
   *  so the tiles/pills are one tap away instead of three. */
  initialOpenSection?: Domain;
};

const DOMAIN_ORDER = ["strength", "cardio", "sport", "mobility", "lifestyle"] as const;
export type Domain = (typeof DOMAIN_ORDER)[number];

const DOMAIN_DISPLAY_LABEL: Record<Domain, string> = {
  strength: "Strength",
  cardio: "Endurance",
  sport: "Sports",
  mobility: "Mobility",
  lifestyle: "Lifestyle",
};

export default function QuickLogPicker({
  routines,
  activityTypes = [],
  sports = [],
  onSportSelected,
  onClose,
  filter,
  onFilter,
  initialOpenSection,
}: Props) {
  const { openDrawer, setDrawerState } = useLogDrawer();

  // All sections collapsed by default (except an explicit shortcut
  // target). Search auto-expands matching sections so a typed query
  // surfaces hits immediately.
  const [openSections, setOpenSections] = useState<Record<Domain, boolean>>({
    strength: initialOpenSection === "strength",
    cardio: initialOpenSection === "cardio",
    sport: initialOpenSection === "sport",
    mobility: initialOpenSection === "mobility",
    lifestyle: initialOpenSection === "lifestyle",
  });

  useEffect(() => {
    // Reset state when the menu remounts.
  }, []);

  function pickRoutine(routineId: string) {
    openDrawer(routineId);
    onClose();
  }

  function pickEnduranceType(activityTypeId: string) {
    // Open the LogDrawer against the synthetic Endurance routine with
    // the tapped type pre-selected — LogDrawer's cardio branch reads
    // presetActivityTypeId from drawer state, so "Trail Run" lands on
    // a form already set to Trail Run instead of asking again.
    setDrawerState(SYNTHETIC_ENDURANCE_ROUTINE_ID, { presetActivityTypeId: activityTypeId });
    openDrawer(SYNTHETIC_ENDURANCE_ROUTINE_ID);
    onClose();
  }

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

  function sectionHasContent(domain: Domain): boolean {
    const norm = filter.trim().toLowerCase();
    const hasRoutines = (routinesByDomain.get(domain) ?? []).length > 0;
    if (domain === "cardio") {
      const typesMatch = norm
        ? enduranceGroups.some((g) =>
            g.types.some(
              (t) => t.name.toLowerCase().includes(norm) || g.familyName.toLowerCase().includes(norm)
            )
          )
        : enduranceGroups.length > 0;
      return hasRoutines || typesMatch;
    }
    if (domain === "sport") {
      const sportsMatch = norm
        ? sports.some(
            (s) => s.label.toLowerCase().includes(norm) || s.eyebrow.toLowerCase().includes(norm)
          )
        : sports.length > 0;
      return hasRoutines || sportsMatch;
    }
    return hasRoutines;
  }

  function toggleSection(d: Domain) {
    setOpenSections((prev) => ({ ...prev, [d]: !prev[d] }));
  }

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
    <div style={{ display: "grid", gap: 10 }}>
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        placeholder="Search routines, sports, endurance types…"
        style={searchInput}
      />

      <div style={sectionStack}>
        {DOMAIN_ORDER.map((domain) => {
          if (!sectionHasContent(domain)) return null;
          const isOpen = effectiveOpen[domain];
          const accent = domainAccent(domain);
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
              </button>

              {isOpen ? (
                <div style={sectionBody}>
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

                  {domain === "sport" && sports.length > 0 ? (
                    <div style={sportTileGrid}>
                      {sports
                        .filter((s) =>
                          norm
                            ? s.label.toLowerCase().includes(norm) ||
                              s.eyebrow.toLowerCase().includes(norm)
                            : true
                        )
                        .map((sport) => (
                          <button
                            key={sport.slug}
                            type="button"
                            onClick={() => onSportSelected(sport)}
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

                  {sectionRoutines.length > 0 ? (
                    <ul style={routineList}>
                      {sectionRoutines.map((r) => (
                        <li key={r.routineId}>
                          <button
                            type="button"
                            onClick={() => pickRoutine(r.routineId)}
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

        {filter.trim() !== "" && !DOMAIN_ORDER.some((d) => sectionHasContent(d)) ? (
          <div style={emptyState}>No matches in routines, sports, or endurance types.</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Styles (mirror SchedulePicker so the visual is identical) ──────────────

const searchInput: CSSProperties = {
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

// No inner maxHeight/overflow — the Popover body is the single scroll
// container. The old nested 60vh scroll area fought the sheet's own
// scrolling on iOS and the expanded sections ended up unscrollable.
const sectionStack: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 8,
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

const sectionBody: CSSProperties = {
  padding: "10px 12px 12px",
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const typePillBlock: CSSProperties = { display: "grid", gap: 8 };
const typeFamilyStack: CSSProperties = { display: "grid", gap: 5 };
const typeFamilyLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};
const typePillRow: CSSProperties = { display: "flex", gap: 5, flexWrap: "wrap" };
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
const routineDot: CSSProperties = { width: 8, height: 8, borderRadius: 999, flexShrink: 0 };
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
