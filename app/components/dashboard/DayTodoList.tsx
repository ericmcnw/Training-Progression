"use client";

// Day to-do list — date-bound checklist for "random not-important" things
// (laundry, doctor's appointment). Distinct visual language from routines:
//   • neutral sky color (not a domain accent)
//   • square checkbox (vs. circular routine dots)
//   • simple inline + Add input at the bottom
//
// Lives in two places:
//   • TodayActionsBar — todays's todos as inline check chips
//   • WaG detail card — selected day's todos with full add/delete UI
//
// Surface picks which "slot" of the component to render via the `mode` prop.

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  createDayTodo,
  deleteDayTodo,
  getCarryForwardSuggestions,
  toggleDayTodo,
} from "./day-todo-actions";

export type DayTodoItem = {
  id: string;
  ymd: string;
  label: string;
  done: boolean;
};

export default function DayTodoList({
  ymd,
  todos,
  mode = "panel",
}: {
  ymd: string;
  todos: DayTodoItem[];
  mode?: "panel" | "chips";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; label: string; ymd: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  function refresh() {
    router.refresh();
  }

  function onToggle(todo: DayTodoItem) {
    startTransition(async () => {
      await toggleDayTodo(todo.id, !todo.done);
      refresh();
    });
  }

  function onDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this to-do?")) return;
    startTransition(async () => {
      await deleteDayTodo(id);
      refresh();
    });
  }

  function onSubmit(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("ymd", ymd);
    fd.set("label", trimmed);
    setDraft("");
    setShowSuggestions(false);
    startTransition(async () => {
      await createDayTodo(fd);
      refresh();
    });
  }

  async function loadSuggestions() {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
      return;
    }
    const next = await getCarryForwardSuggestions(ymd);
    setSuggestions(next);
    setShowSuggestions(next.length > 0);
  }

  // Compact chips mode — renders just the todo chips (no add UI). Used in
  // TodayActionsBar where space is precious and todos are added from the
  // detail card.
  if (mode === "chips") {
    if (todos.length === 0) return null;
    return (
      <>
        {todos.map((todo) => (
          <button
            key={todo.id}
            type="button"
            onClick={() => onToggle(todo)}
            disabled={pending}
            style={chipBase(todo.done)}
            title={`${todo.label} — tap to toggle`}
          >
            <span style={chipBox(todo.done)} aria-hidden="true">
              {todo.done ? "✓" : ""}
            </span>
            <span style={chipName(todo.done)}>{todo.label}</span>
          </button>
        ))}
      </>
    );
  }

  // Full panel mode — used in the WaG detail card.
  const undone = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div style={panel}>
      <div style={panelHeader}>
        <span style={panelLabel}>DAY TO-DOS</span>
        {todos.length > 0 ? (
          <span style={panelCount}>{done.length}/{todos.length}</span>
        ) : null}
      </div>

      {todos.length === 0 ? (
        <div style={emptyHint}>Nothing yet — add a quick task below.</div>
      ) : (
        <div style={list}>
          {undone.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} pending={pending} />
          ))}
          {done.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} pending={pending} />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(draft);
        }}
        style={addRow}
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Hide carry-forward suggestions once the user starts typing —
            // they're composing something new, not picking from history.
            if (e.target.value.trim().length > 0) setShowSuggestions(false);
          }}
          onFocus={() => {
            setAdding(true);
            if (draft.trim().length === 0) void loadSuggestions();
          }}
          onBlur={() => setTimeout(() => setAdding(false), 120)}
          placeholder="+ Add a quick task…"
          style={addInput}
          maxLength={200}
        />
        {draft.trim().length > 0 ? (
          <button type="submit" style={addBtn} disabled={pending}>
            Add
          </button>
        ) : null}
      </form>

      {adding && showSuggestions && suggestions.length > 0 ? (
        <div style={suggestPanel}>
          <div style={suggestLabel}>UNFINISHED FROM RECENT DAYS</div>
          <div style={suggestList}>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  // Use mousedown so we beat the input's onBlur dismissal
                  e.preventDefault();
                  onSubmit(s.label);
                }}
                style={suggestChip}
                title={`Carried from ${s.ymd}`}
              >
                <span style={{ opacity: 0.6, fontSize: 10, marginRight: 5 }}>↻</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
  pending,
}: {
  todo: DayTodoItem;
  onToggle: (t: DayTodoItem) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div style={rowCard(todo.done)}>
      <button
        type="button"
        onClick={() => onToggle(todo)}
        style={rowCheckBtn(todo.done)}
        disabled={pending}
        aria-label={todo.done ? "Mark as not done" : "Mark as done"}
      >
        {todo.done ? "✓" : ""}
      </button>
      <span style={rowLabel(todo.done)}>{todo.label}</span>
      <button
        type="button"
        onClick={() => onDelete(todo.id)}
        style={rowDeleteBtn}
        disabled={pending}
        aria-label="Delete todo"
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}

const SKY = "rgba(125,211,252,";

const panel: CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 8,
  paddingTop: 10,
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const panelHeader: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  paddingLeft: 2,
};

const panelLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  color: SKY + "0.85)",
  opacity: 0.85,
};

const panelCount: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.55,
  padding: "1px 5px",
  borderRadius: 6,
  background: SKY + "0.10)",
};

const emptyHint: CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  fontStyle: "italic",
  paddingLeft: 2,
  marginTop: 2,
};

const list: CSSProperties = {
  display: "grid",
  gap: 3,
};

function rowCard(done: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px 1fr 22px",
    gap: 8,
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: 8,
    border: `1px solid ${SKY}${done ? "0.18" : "0.20"})`,
    background: done ? SKY + "0.05)" : "rgba(255,255,255,0.01)",
  };
}

function rowCheckBtn(done: boolean): CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `1.5px solid ${SKY}${done ? "0.85" : "0.45"})`,
    background: done ? SKY + "0.85)" : "transparent",
    color: done ? "rgba(15,23,42,0.95)" : "transparent",
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function rowLabel(done: boolean): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 600,
    opacity: done ? 0.55 : 1,
    textDecoration: done ? "line-through" : "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

const rowDeleteBtn: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.35)",
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};

const addRow: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  marginTop: 4,
};

const addInput: CSSProperties = {
  flex: 1,
  fontSize: 12.5,
  padding: "7px 10px",
  borderRadius: 8,
  border: `1px solid ${SKY}0.22)`,
  background: "rgba(255,255,255,0.02)",
  color: "inherit",
  outline: "none",
  minWidth: 0,
};

const addBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "6px 11px",
  borderRadius: 8,
  border: `1px solid ${SKY}0.45)`,
  background: SKY + "0.12)",
  color: SKY + "0.95)",
  cursor: "pointer",
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const suggestPanel: CSSProperties = {
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px dashed ${SKY}0.28)`,
  background: SKY + "0.04)",
  display: "grid",
  gap: 6,
};

const suggestLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.5,
  opacity: 0.55,
};

const suggestList: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const suggestChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 9px",
  borderRadius: 999,
  border: `1px solid ${SKY}0.32)`,
  background: SKY + "0.08)",
  color: "inherit",
  cursor: "pointer",
};

function chipBase(done: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px 5px 7px",
    borderRadius: 999,
    border: `1px solid ${SKY}${done ? "0.45" : "0.28"})`,
    background: done ? SKY + "0.16)" : SKY + "0.06)",
    color: "inherit",
    cursor: "pointer",
    minHeight: 30,
  };
}

function chipBox(done: boolean): CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: `1.5px solid ${SKY}${done ? "0.85" : "0.45"})`,
    background: done ? SKY + "0.85)" : "transparent",
    color: done ? "rgba(15,23,42,0.95)" : "transparent",
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function chipName(done: boolean): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    opacity: done ? 0.7 : 1,
    textDecoration: done ? "line-through" : "none",
    maxWidth: 160,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}
