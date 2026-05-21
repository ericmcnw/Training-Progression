"use client";

// QuickAddMenu — the bottom-sheet / popover that opens from the FAB.
// Two sections:
//   LOG — links into existing flows (routine picker, pain log, ad-hoc).
//   PLAN — inline to-do add for today.

import Link from "next/link";
import { useState, useTransition, type CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { QUICK_LOG_ROUTINE_ID } from "@/app/components/LogDrawer";
import type { QuickPickRoutine } from "./types";
import { COLOR, RADIUS } from "./tokens";
import { domainAccent } from "./client-utils";
import Popover from "./Popover";
import { createDayTodo } from "@/app/components/dashboard/day-todo-actions";

type Props = {
  open: boolean;
  onClose: () => void;
  routines: QuickPickRoutine[];
  today: string;
};

export default function QuickAddMenu({ open, onClose, routines, today }: Props) {
  const { openDrawer } = useLogDrawer();
  const [picker, setPicker] = useState(false);
  const [todoLabel, setTodoLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const [todoError, setTodoError] = useState<string | null>(null);

  function addTodo() {
    const trimmed = todoLabel.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("ymd", today);
    fd.set("label", trimmed);
    setTodoError(null);
    startTransition(async () => {
      try {
        await createDayTodo(fd);
        setTodoLabel("");
        onClose();
      } catch {
        // Surface failure instead of silently swallowing — user thinks the
        // todo saved but it didn't. Keep the label in the input so they can
        // retry without retyping.
        setTodoError("Couldn't save. Tap Add again.");
      }
    });
  }

  return (
    <Popover
      open={open}
      onClose={() => { setPicker(false); setFilter(""); onClose(); }}
      title="Quick add"
      desktopWidth={380}
    >
      {!picker ? (
        <>
          <div style={section}>
            <div style={sectionLabel}>Log</div>
            <button type="button" onClick={() => setPicker(true)} style={menuItem}>
              <span style={menuItemIcon}>＋</span>
              <span style={menuItemText}>Log a routine</span>
              <span style={menuItemChevron}>›</span>
            </button>
            <button
              type="button"
              onClick={() => {
                openDrawer(QUICK_LOG_ROUTINE_ID);
                onClose();
              }}
              style={menuItem}
            >
              <span style={menuItemIcon}>⚡</span>
              <span style={menuItemText}>Quick workout (no routine)</span>
              <span style={menuItemChevron}>›</span>
            </button>
            <Link href="/body/log-pain" style={menuItem} onClick={onClose}>
              <span style={{ ...menuItemIcon, color: COLOR.red, background: COLOR.redSoft, borderColor: "rgba(248,113,113,0.30)" }}>!</span>
              <span style={menuItemText}>Log pain / symptom</span>
              <span style={menuItemChevron}>›</span>
            </Link>
            <Link href="/log" style={menuItem} onClick={onClose}>
              <span style={menuItemIcon}>⋯</span>
              <span style={menuItemText}>Log something else</span>
              <span style={menuItemChevron}>›</span>
            </Link>
          </div>

          <div style={section}>
            <div style={sectionLabel}>Plan</div>
            <div style={addRow}>
              <input
                type="text"
                value={todoLabel}
                onChange={(e) => setTodoLabel(e.target.value)}
                placeholder="Add a to-do for today…"
                style={addInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTodo();
                  }
                }}
              />
              <button type="button" onClick={addTodo} disabled={pending || !todoLabel.trim()} style={addButton}>
                Add
              </button>
            </div>
            {todoError ? (
              <div role="alert" style={{ color: COLOR.red, fontSize: 11, marginTop: 6, fontWeight: 700 }}>
                {todoError}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <RoutinePicker
          routines={routines}
          today={today}
          filter={filter}
          onFilter={setFilter}
          onBack={() => { setPicker(false); setFilter(""); }}
          onClose={onClose}
        />
      )}
    </Popover>
  );
}

function RoutinePicker({
  routines,
  today,
  filter,
  onFilter,
  onBack,
  onClose,
}: {
  routines: QuickPickRoutine[];
  today: string;
  filter: string;
  onFilter: (next: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { openDrawer } = useLogDrawer();
  const norm = filter.trim().toLowerCase();
  const filtered = norm
    ? routines.filter((r) => r.routineName.toLowerCase().includes(norm))
    : routines;

  return (
    <div style={section}>
      <div style={pickerHeader}>
        <button type="button" onClick={onBack} style={backButton}>‹ back</button>
        {/* No autoFocus — opening the picker shouldn't pop the soft
            keyboard. Users can scroll the list first and tap into search
            only when they want to filter. */}
        <input
          type="text"
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder="Search routines…"
          style={searchInput}
        />
      </div>
      {filtered.length === 0 ? (
        <div style={emptyState}>No routines match.</div>
      ) : (
        <ul style={pickerList}>
          {filtered.slice(0, 50).map((r) => (
            <li key={r.routineId}>
              <button
                type="button"
                style={{ ...pickerItem, background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
                onClick={() => {
                  openDrawer(r.routineId, { defaultDate: today });
                  onClose();
                }}
              >
                <span style={{ ...pickerDot, background: domainAccent(r.domain) }} aria-hidden />
                <span style={pickerItemText}>{r.routineName}</span>
                <span style={pickerKind}>{r.kind.toLowerCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── styles

const section: CSSProperties = { display: "grid", gap: 6 };

const sectionLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: COLOR.textDim,
  marginTop: 4,
};

const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
  color: COLOR.text,
  textDecoration: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  textAlign: "left",
  minHeight: 44,
};

const menuItemIcon: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: `1px solid rgba(51,255,122,0.30)`,
  background: COLOR.successSoft,
  color: COLOR.success,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 900,
  flexShrink: 0,
};

const menuItemText: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 800,
};

const menuItemChevron: CSSProperties = {
  fontSize: 16,
  color: COLOR.textFaint,
  fontWeight: 800,
};

const addRow: CSSProperties = {
  display: "flex",
  gap: 6,
};

// No inline fontSize — globals.css floors inputs to 16px to prevent iOS
// Safari from auto-zooming the viewport when this input takes focus.
const addInput: CSSProperties = {
  flex: 1,
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.text,
};

const addButton: CSSProperties = {
  minHeight: 40,
  padding: "8px 14px",
  borderRadius: 10,
  border: `1px solid rgba(51,255,122,0.35)`,
  background: COLOR.successSoft,
  color: COLOR.success,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const pickerHeader: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const backButton: CSSProperties = {
  minHeight: 36,
  padding: "4px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.textDim,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

// No inline fontSize — globals.css floors inputs to 16px to prevent iOS
// Safari from auto-zooming the viewport when this input takes focus.
const searchInput: CSSProperties = {
  flex: 1,
  minHeight: 36,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.text,
};

const pickerList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
  maxHeight: "55vh",
  overflowY: "auto",
};

const pickerItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.02)",
  color: COLOR.text,
  textDecoration: "none",
  minHeight: 40,
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
};

const emptyState: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  padding: "12px 6px",
  fontStyle: "italic",
};
