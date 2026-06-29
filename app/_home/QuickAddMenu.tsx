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
import { COLOR } from "./tokens";
import Popover from "./Popover";
import { createDayTodo } from "@/app/components/dashboard/day-todo-actions";
import { createDaySpan } from "./day-span-actions";
import QuickLogPicker, { type Domain } from "./QuickLogPicker";

const AWAY_KINDS: Array<{ value: string; label: string }> = [
  { value: "vacation", label: "🏖️ Vacation" },
  { value: "travel", label: "✈️ Travel" },
  { value: "away", label: "📍 Away" },
  { value: "sick", label: "🤒 Sick" },
  { value: "rest", label: "😴 Rest" },
];
import type { ScheduleActivityType, ScheduleSport } from "./SchedulePicker";

type Props = {
  open: boolean;
  onClose: () => void;
  routines: QuickPickRoutine[];
  activityTypes?: ScheduleActivityType[];
  sports?: ScheduleSport[];
  /** Bubbled up to the Fab so it can mount the right sport log
   *  sheet (climbing / golf / generic). */
  onSportSelected: (sport: ScheduleSport) => void;
  /** Opens the freeform "Activity" log sheet (mounted at the Fab). */
  onLogActivity: () => void;
  /** Opens the multi-day backpacking trip sheet (mounted at the Fab). */
  onLogBackpacking: () => void;
  today: string;
};

export default function QuickAddMenu({
  open,
  onClose,
  routines,
  activityTypes,
  sports,
  onSportSelected,
  onLogActivity,
  onLogBackpacking,
  today,
}: Props) {
  const { openDrawer } = useLogDrawer();
  // Picker view: null = top-level menu. A Domain value opens the unified
  // picker with that section pre-expanded ("all" = nothing pre-expanded).
  const [picker, setPicker] = useState<"all" | Domain | null>(null);
  const [todoLabel, setTodoLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const [todoError, setTodoError] = useState<string | null>(null);

  // "Mark time away" inline form — a multi-day span (vacation / travel / etc.)
  // that draws a bar across the WaG, explaining a dip in activity.
  const [awayOpen, setAwayOpen] = useState(false);
  const [awayKind, setAwayKind] = useState("vacation");
  const [awayLabel, setAwayLabel] = useState("");
  const [awayStart, setAwayStart] = useState(today);
  const [awayEnd, setAwayEnd] = useState(today);
  const [awayError, setAwayError] = useState<string | null>(null);

  function saveAway() {
    const label = awayLabel.trim();
    if (!label) { setAwayError("Add a label."); return; }
    if (!awayStart || !awayEnd) { setAwayError("Pick start and end dates."); return; }
    setAwayError(null);
    startTransition(async () => {
      try {
        await createDaySpan({ kind: awayKind, label, startYmd: awayStart, endYmd: awayEnd });
        setAwayOpen(false);
        setAwayLabel("");
        onClose();
      } catch {
        setAwayError("Couldn't save. Try again.");
      }
    });
  }

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
      onClose={() => { setPicker(null); setFilter(""); onClose(); }}
      title="Quick add"
      desktopWidth={380}
    >
      {picker === null ? (
        <>
          <div style={section}>
            <div style={sectionLabel}>Log</div>
            <button type="button" onClick={() => setPicker("all")} style={menuItem}>
              <span style={menuItemIcon}>＋</span>
              <span style={menuItemText}>Log a routine</span>
              <span style={menuItemChevron}>›</span>
            </button>
            {/* Direct shortcuts into the new type-based flows — endurance
                type pills and sport tiles were buried two levels deep
                behind "Log a routine"; these land with the right section
                already expanded. */}
            {(activityTypes?.length ?? 0) > 0 ? (
              <button type="button" onClick={() => setPicker("cardio")} style={menuItem}>
                <span style={{ ...menuItemIcon, color: "rgba(147,197,253,0.95)", background: "rgba(78,148,255,0.12)", borderColor: "rgba(78,148,255,0.32)" }}>🏃</span>
                <span style={menuItemText}>Log endurance</span>
                <span style={menuItemChevron}>›</span>
              </button>
            ) : null}
            {(sports?.length ?? 0) > 0 ? (
              <button type="button" onClick={() => setPicker("sport")} style={menuItem}>
                <span style={{ ...menuItemIcon, color: "rgba(253,186,116,0.95)", background: "rgba(251,146,60,0.12)", borderColor: "rgba(251,146,60,0.32)" }}>🧗</span>
                <span style={menuItemText}>Log a sport session</span>
                <span style={menuItemChevron}>›</span>
              </button>
            ) : null}
            {/* Backpacking — a multi-day endurance trip with its own rich
                logger. Direct entry (no "add it as a sport" hop). */}
            <button type="button" onClick={() => { onLogBackpacking(); onClose(); }} style={menuItem}>
              <span style={{ ...menuItemIcon, color: "rgba(147,197,253,0.95)", background: "rgba(78,148,255,0.12)", borderColor: "rgba(78,148,255,0.32)" }}>🎒</span>
              <span style={menuItemText}>Log backpacking trip</span>
              <span style={menuItemChevron}>›</span>
            </button>
            {/* Freeform catch-all — mixed/casual movement that fits no
                template. Mounts the Activity sheet at the Fab level. */}
            <button type="button" onClick={() => { onLogActivity(); onClose(); }} style={menuItem}>
              <span style={{ ...menuItemIcon, color: "rgba(94,234,212,0.95)", background: "rgba(45,212,191,0.12)", borderColor: "rgba(45,212,191,0.32)" }}>🤸</span>
              <span style={menuItemText}>Log activity</span>
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

            {!awayOpen ? (
              <button type="button" onClick={() => setAwayOpen(true)} style={menuItem}>
                <span style={{ ...menuItemIcon, color: "rgba(253,224,140,0.95)", background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.32)" }}>🏖️</span>
                <span style={menuItemText}>Mark time away</span>
                <span style={menuItemChevron}>›</span>
              </button>
            ) : (
              <div style={awayForm}>
                <select value={awayKind} onChange={(e) => setAwayKind(e.target.value)} style={awayInput}>
                  {AWAY_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={awayLabel}
                  onChange={(e) => setAwayLabel(e.target.value)}
                  placeholder="Label (e.g. Hawaii)"
                  style={awayInput}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="date" value={awayStart} onChange={(e) => setAwayStart(e.target.value)} style={awayInput} aria-label="Start date" />
                  <input type="date" value={awayEnd} onChange={(e) => setAwayEnd(e.target.value)} style={awayInput} aria-label="End date" />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={saveAway} disabled={pending || !awayLabel.trim()} style={addButton}>
                    Save
                  </button>
                  <button type="button" onClick={() => { setAwayOpen(false); setAwayError(null); }} style={backButton}>
                    Cancel
                  </button>
                </div>
                {awayError ? (
                  <div role="alert" style={{ color: COLOR.red, fontSize: 11, fontWeight: 700 }}>{awayError}</div>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={section}>
          <div style={pickerHeader}>
            <button type="button" onClick={() => { setPicker(null); setFilter(""); }} style={backButton}>
              ‹ back
            </button>
          </div>
          <QuickLogPicker
            // Remount per entry mode so the shortcut's pre-expanded section
            // applies even after the user previously browsed another view.
            key={picker}
            routines={routines}
            activityTypes={activityTypes}
            sports={sports}
            initialOpenSection={picker === "all" ? undefined : picker}
            onSportSelected={(sport) => {
              onSportSelected(sport);
              onClose();
            }}
            onClose={onClose}
            filter={filter}
            onFilter={setFilter}
          />
        </div>
      )}
    </Popover>
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

const awayForm: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  borderRadius: 12,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
};

// fontSize 16 explicit so the <select> + date inputs don't trigger iOS zoom
// (globals.css floors <input> but not every control).
const awayInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.text,
  fontSize: 16,
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

