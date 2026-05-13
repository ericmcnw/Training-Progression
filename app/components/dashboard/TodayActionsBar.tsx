// Today actions bar — sits at the top of the THIS WEEK panel and gives the
// user a single-tap path to log everything that's on the docket today.
//
// Two visual groups inside one row:
//   • Habits: chip with name + inline checkbox (CompletionCheckbox)
//   • Other planned (workouts/cardio/sport): chip with name + Log link
//
// Each chip carries a domain-colored accent stripe on its left edge so the
// row reads at a glance without needing legends. Done items keep their chip
// but flip to a "✓ done" state instead of an action.

import Link from "next/link";
import type { CSSProperties } from "react";
import CompletionCheckbox from "./CompletionCheckbox";
import DayTodoList, { type DayTodoItem } from "./DayTodoList";
import { domainColor, formatRoutineTypeLabel, normalizeRoutineKind, type RoutineDomain } from "@/lib/routines";

export type TodayActionItem = {
  routineId: string;
  routineName: string;
  kind: string;
  domain: RoutineDomain;
  planned: number;
  logged: number;
};

export default function TodayActionsBar({
  todayYmd,
  todayLabel,
  items,
  todos = [],
}: {
  todayYmd: string;
  todayLabel: string;
  items: TodayActionItem[];
  todos?: DayTodoItem[];
}) {
  const habits = items.filter((i) => i.domain === "lifestyle");
  const others = items.filter((i) => i.domain !== "lifestyle");

  const habitsDone = habits.filter((h) => h.logged > 0).length;
  const othersDone = others.filter((o) => o.logged >= o.planned && o.planned > 0).length;
  const othersPending = Math.max(0, others.length - othersDone);
  const todosDone = todos.filter((t) => t.done).length;

  return (
    <div style={shell}>
      <div style={headerRow}>
        <span style={headerLabel}>TODAY</span>
        <span style={headerDate}>{todayLabel}</span>
        <span style={headerSpacer} />
        <div style={statsLine}>
          {others.length > 0 ? (
            <span style={statChip(othersPending === 0 ? "done" : "pending")}>
              {othersDone}/{others.length} planned
            </span>
          ) : null}
          {habits.length > 0 ? (
            <span style={statChip(habitsDone === habits.length ? "done" : "pending")}>
              {habitsDone}/{habits.length} habits
            </span>
          ) : null}
          {todos.length > 0 ? (
            <span style={statChip(todosDone === todos.length ? "done" : "pending")}>
              {todosDone}/{todos.length} to-dos
            </span>
          ) : null}
        </div>
      </div>

      {items.length === 0 && todos.length === 0 ? (
        <div style={emptyState}>
          Nothing planned today — rest up.{" "}
          <span style={{ opacity: 0.6 }}>Tap today in the week below to add a quick to-do.</span>
        </div>
      ) : (
        <div style={chipsRow}>
          {/* Habits first so the user sees one-tap actions before bigger Logs */}
          {habits.map((h) => (
            <HabitChip key={h.routineId} item={h} ymd={todayYmd} />
          ))}
          {others.map((o) => (
            <PlannedChip key={o.routineId} item={o} />
          ))}
          {/* Day to-dos appear inline as their own chip flavor; add UX lives
              in the WaG detail card panel-mode list instead. */}
          <DayTodoList ymd={todayYmd} todos={todos} mode="chips" />
        </div>
      )}
    </div>
  );
}

function HabitChip({ item, ymd }: { item: TodayActionItem; ymd: string }) {
  const accent = domainColor(item.domain);
  const done = item.logged > 0;
  const isCompletion = normalizeRoutineKind(item.kind) === "COMPLETION";

  // Habit-domain routines that aren't COMPLETION-kind (e.g., a daily walk
  // tracked via CARDIO) need the Log button instead of a checkbox.
  if (!isCompletion) {
    return <PlannedChip item={item} />;
  }

  return (
    <label style={chipBase(accent, done)}>
      <CompletionCheckbox
        routineId={item.routineId}
        ymd={ymd}
        done={done}
        size={18}
        ariaLabel={`Toggle ${item.routineName} for today`}
      />
      <span style={chipName(done)}>{item.routineName}</span>
    </label>
  );
}

function PlannedChip({ item }: { item: TodayActionItem }) {
  const accent = domainColor(item.domain);
  const done = item.planned > 0 && item.logged >= item.planned;
  const href = loggingHref(item);

  return (
    <Link href={href} style={chipBase(accent, done)}>
      <span style={chipName(done)}>{item.routineName}</span>
      {done ? (
        <span style={doneBadge}>✓ done</span>
      ) : (
        <span style={logBadge(accent)}>{logBadgeLabel(item)}</span>
      )}
    </Link>
  );
}

function loggingHref(item: TodayActionItem): string {
  const kind = normalizeRoutineKind(item.kind);
  if (kind === "GUIDED") return `/routines/${item.routineId}/log-guided`;
  return `/routines/${item.routineId}/log`;
}

function logBadgeLabel(item: TodayActionItem): string {
  const remaining = Math.max(0, item.planned - item.logged);
  if (item.logged > 0 && remaining > 0) return `${remaining} left`;
  return "Log";
}

const shell: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const headerLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.8,
  opacity: 0.78,
};

const headerDate: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.55,
};

const headerSpacer: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const statsLine: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

function statChip(state: "done" | "pending"): CSSProperties {
  const isDone = state === "done";
  return {
    fontSize: 10.5,
    fontWeight: 800,
    color: isDone ? "rgba(84,203,130,0.95)" : "rgba(255,255,255,0.7)",
    background: isDone ? "rgba(84,203,130,0.10)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${isDone ? "rgba(84,203,130,0.32)" : "rgba(255,255,255,0.08)"}`,
    padding: "2px 8px",
    borderRadius: 999,
    letterSpacing: 0.2,
  };
}

const chipsRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
};

const emptyState: CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
  fontStyle: "italic",
  paddingLeft: 2,
};

function chipBase(accent: string, done: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 10px 5px 8px",
    borderRadius: 999,
    border: `1px solid ${withAlpha(accent, done ? 0.45 : 0.28)}`,
    background: done
      ? `linear-gradient(180deg, ${withAlpha(accent, 0.16)}, ${withAlpha(accent, 0.07)})`
      : `linear-gradient(180deg, ${withAlpha(accent, 0.08)}, ${withAlpha(accent, 0.03)})`,
    color: "inherit",
    textDecoration: "none",
    cursor: "pointer",
    transition: "background 120ms ease, border-color 120ms ease",
    minHeight: 30,
    boxShadow: done ? `inset 0 0 0 1px ${withAlpha(accent, 0.12)}` : "none",
  };
}

function chipName(done: boolean): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.1,
    opacity: done ? 0.85 : 1,
    maxWidth: 160,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

const doneBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "rgba(84,203,130,0.95)",
  letterSpacing: 0.4,
};

function logBadge(accent: string): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    color: accent,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: 6,
    background: withAlpha(accent, 0.10),
    border: `1px solid ${withAlpha(accent, 0.28)}`,
  };
}

function withAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return rgba;
  const parts = match[1].split(",").map((p) => p.trim());
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

// Re-exported for callers that need the same kind→label translation
export { formatRoutineTypeLabel };
