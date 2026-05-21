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
import { scheduleRoutineForDay } from "./schedule-actions";

type Props = {
  open: boolean;
  onClose: () => void;
  ymd: string;
  dateLabel: string;
  routines: QuickPickRoutine[];
};

const DOMAIN_ORDER = ["strength", "cardio", "mobility", "sport", "lifestyle"] as const;

export default function SchedulePicker({ open, onClose, ymd, dateLabel, routines }: Props) {
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
