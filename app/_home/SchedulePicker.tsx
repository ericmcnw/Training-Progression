"use client";

// SchedulePicker — bottom-sheet (mobile) / centered modal (desktop) for
// scheduling a routine onto a specific day from the WeekAtGlance detail
// panel. Mirrors the QuickAddMenu's RoutinePicker pattern (search input,
// domain-grouped list) so the two surfaces feel consistent.

import { useState, useTransition, useMemo, type CSSProperties } from "react";
import Popover from "./Popover";
import type { QuickPickRoutine } from "./types";
import { COLOR, DOMAIN_LABEL } from "./tokens";
import { domainAccent } from "./client-utils";
import { scheduleRoutineForDay, scheduleEnduranceTypeForDay } from "./schedule-actions";

export type ScheduleActivityType = {
  id: string;
  slug: string;
  name: string;
  familyId: string;
  familyName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  ymd: string;
  dateLabel: string;
  routines: QuickPickRoutine[];
  /** Endurance activity types — enables the typed-endurance shortcut section
   *  at the top of the picker. Empty array = section hidden (cleanly
   *  degrades on databases that haven't run the endurance seed). */
  activityTypes?: ScheduleActivityType[];
};

const DOMAIN_ORDER = ["strength", "cardio", "mobility", "sport", "lifestyle"] as const;

export default function SchedulePicker({ open, onClose, ymd, dateLabel, routines, activityTypes = [] }: Props) {
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pickEnduranceType(activityTypeId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleEnduranceTypeForDay({ activityTypeId, ymd });
        reset();
        onClose();
      } catch {
        setError("Couldn't add endurance to schedule. Try again.");
      }
    });
  }

  // Group activity types by family for the header row so the user sees
  // hierarchy (Running ▸ Run / Trail Run / …). Each row is collapsible
  // implicitly via overflow scroll on mobile.
  const enduranceGroups = useMemo(() => {
    const byFamily = new Map<string, { familyId: string; familyName: string; types: ScheduleActivityType[] }>();
    for (const t of activityTypes) {
      const cur = byFamily.get(t.familyId) ?? { familyId: t.familyId, familyName: t.familyName, types: [] };
      cur.types.push(t);
      byFamily.set(t.familyId, cur);
    }
    return [...byFamily.values()];
  }, [activityTypes]);

  function reset() {
    setFilter("");
    setError(null);
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function pick(routineId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleRoutineForDay({ routineId, ymd });
        reset();
        onClose();
      } catch {
        setError("Couldn't add to schedule. Try again.");
      }
    });
  }

  // Filter, then group by domain for clean scanning. Empty groups are
  // suppressed so a search like "row" doesn't leave four "no matches"
  // section labels behind.
  const grouped = useMemo(() => {
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
    const ordered: Array<{ domain: string; label: string; items: QuickPickRoutine[] }> = [];
    for (const domain of DOMAIN_ORDER) {
      const items = byDomain.get(domain);
      if (items && items.length > 0) {
        ordered.push({ domain, label: DOMAIN_LABEL[domain] ?? domain, items });
        byDomain.delete(domain);
      }
    }
    // Any leftover domains we don't have in DOMAIN_ORDER (e.g. legacy values)
    // get appended in alphabetical order so they're still visible.
    for (const [domain, items] of Array.from(byDomain.entries()).sort()) {
      ordered.push({ domain, label: DOMAIN_LABEL[domain] ?? domain, items });
    }
    return ordered;
  }, [routines, filter]);

  const totalShown = grouped.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Popover open={open} onClose={handleClose} title="Add to schedule" subtitle={dateLabel} desktopWidth={400}>
      {/* Typed endurance shortcut — surfaces all enabled activity types
          so the user can schedule "Run on Tuesday" or "Hike on Saturday"
          without creating a routine. Hidden when no types are seeded. */}
      {enduranceGroups.length > 0 && (
        <div style={enduranceShortcutBlock}>
          <div style={enduranceShortcutHeader}>🏃 Endurance — pick an activity</div>
          <div style={{ display: "grid", gap: 6 }}>
            {enduranceGroups.map((g) => (
              <div key={g.familyId} style={{ display: "grid", gap: 4 }}>
                <div style={enduranceFamilyLabel}>{g.familyName}</div>
                <div style={endurancePillRow}>
                  {g.types.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickEnduranceType(t.id)}
                      disabled={pending}
                      style={endurancePill}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={searchRow}>
        {/* No autoFocus — opening the picker shouldn't pop the soft
            keyboard. Users can scroll the list first and tap into search
            only when they want to filter. */}
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search routines…"
          style={searchInput}
          disabled={pending}
        />
      </div>

      {error ? (
        <div role="alert" style={errorText}>
          {error}
        </div>
      ) : null}

      {totalShown === 0 ? (
        <div style={emptyState}>No routines match.</div>
      ) : (
        <div style={list}>
          {grouped.map((group) => (
            <div key={group.domain} style={groupShell}>
              <div style={groupLabel}>{group.label}</div>
              <ul style={groupList}>
                {group.items.map((r) => (
                  <li key={r.routineId}>
                    <button
                      type="button"
                      onClick={() => pick(r.routineId)}
                      disabled={pending}
                      style={pickerItem}
                    >
                      <span style={{ ...pickerDot, background: domainAccent(r.domain) }} aria-hidden />
                      <span style={pickerItemText}>{r.routineName}</span>
                      <span style={pickerKind}>{r.kind.toLowerCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

// Typed-endurance shortcut block at the top of the picker. Soft tint
// matches the goal-builder's endurance picker so the type/family
// shortcuts feel like a related affordance across the app.
const enduranceShortcutBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 10,
  padding: 10,
  borderRadius: 10,
  background: "rgba(78,148,255,0.04)",
  border: "1px solid rgba(78,148,255,0.18)",
};

const enduranceShortcutHeader: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  color: "rgba(191,219,254,0.95)",
};

const enduranceFamilyLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};

const endurancePillRow: CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const endurancePill: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const searchRow: CSSProperties = {
  display: "flex",
  gap: 6,
};

// Intentionally no fontSize here — globals.css enforces a 16px floor on
// inputs to prevent iOS Safari from auto-zooming the viewport on focus.
// Inline styles win over the global rule, so any explicit fontSize < 16px
// would re-enable the zoom.
const searchInput: CSSProperties = {
  flex: 1,
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.text,
};

const list: CSSProperties = {
  display: "grid",
  gap: 12,
  maxHeight: "60vh",
  overflowY: "auto",
};

const groupShell: CSSProperties = {
  display: "grid",
  gap: 6,
};

const groupLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
  paddingInline: 2,
};

const groupList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
};

const pickerItem: CSSProperties = {
  all: "unset",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.02)",
  color: COLOR.text,
  cursor: "pointer",
  minHeight: 40,
  width: "100%",
  boxSizing: "border-box",
};

const pickerDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const pickerItemText: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pickerKind: CSSProperties = {
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
  padding: "12px 6px",
  fontStyle: "italic",
};

const errorText: CSSProperties = {
  fontSize: 12,
  color: COLOR.red,
  fontWeight: 700,
  padding: "4px 2px",
};
