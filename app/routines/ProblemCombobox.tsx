"use client";

import { useRef, useState, type CSSProperties } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import type { ClimbProblemBasic } from "@/lib/climb-types";

export type ProblemPick = { problemId: string; name: string };

// Searchable climb-name picker for the climb log — the name-side twin of
// AreaCombobox. Offers:
//   • saved ClimbProblems at the picked location (linked by id on pick,
//     shown with grade + prior-send count), and
//   • names typed earlier this session (no id yet — the server resolves
//     both entries to one ClimbProblem on save)
// so logging a repeat of a climb never means re-typing its name. Typing
// filters; an unmatched query becomes a fresh problem on save.
export default function ProblemCombobox({
  problemId,
  name,
  savedProblems,
  sessionNames,
  onPick,
}: {
  problemId: string;
  name: string;
  savedProblems: ClimbProblemBasic[];
  /** Distinct climb names typed elsewhere this session — become options. */
  sessionNames: string[];
  onPick: (pick: ProblemPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Set by choose() so the blur it triggers doesn't run commit() with the
  // stale typed query and overwrite the just-picked climb.
  const skipCommit = useRef(false);

  const selectedName = problemId
    ? savedProblems.find((p) => p.id === problemId)?.name ?? ""
    : name;

  const options: Array<{ id: string | null; name: string; tag: string }> = [
    ...savedProblems.map((p) => {
      const sends = p.priorSendCount ?? 0;
      return {
        id: p.id as string | null,
        name: p.name,
        tag: sends > 0 ? `${p.grade} · ↻${sends}×` : p.grade,
      };
    }),
    ...sessionNames
      .filter(
        (n) =>
          n.trim() &&
          !savedProblems.some((p) => p.name.toLowerCase() === n.toLowerCase())
      )
      .map((n) => ({ id: null, name: n, tag: "this session" })),
  ];

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const exactExists = options.some((o) => o.name.toLowerCase() === q);
  const showCreate = query.trim().length > 0 && !exactExists;

  function choose(pick: ProblemPick) {
    skipCommit.current = true;
    onPick(pick);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  // Commit whatever's in the box when focus leaves: empty clears the
  // name, an exact saved-name match links the id, anything else becomes
  // a free-text name resolved on save.
  function commit() {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      if (selectedName) onPick({ problemId: "", name: "" });
    } else {
      const saved = savedProblems.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase()
      );
      onPick(saved ? { problemId: saved.id, name: "" } : { problemId: "", name: trimmed });
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <div style={wrapStyle}>
      <input
        ref={inputRef}
        type="text"
        placeholder={options.length > 0 ? "Search or add climb" : "Climb / route name (optional)"}
        value={open ? query : selectedName}
        onFocus={() => {
          setOpen(true);
          setQuery(selectedName);
        }}
        onChange={(e) => {
          if (!open) setOpen(true);
          setQuery(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
        }}
        style={{ ...inputStyle, width: "100%" }}
        aria-label="Climb name"
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div style={dropdownStyle} role="listbox">
          {filtered.map((o) => {
            const isOn = o.id ? o.id === problemId : !problemId && o.name === name;
            return (
              <button
                key={(o.id ?? "new") + ":" + o.name}
                type="button"
                role="option"
                aria-selected={isOn}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.id ? { problemId: o.id, name: "" } : { problemId: "", name: o.name });
                }}
                style={isOn ? rowActiveStyle : rowStyle}
              >
                <span style={rowMainStyle}>{o.name}</span>
                <span style={rowTagStyle}>{o.tag}</span>
              </button>
            );
          })}
          {showCreate && (
            <>
              {filtered.length > 0 ? <div style={dividerStyle} /> : null}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose({ problemId: "", name: query.trim() });
                }}
                style={createRowStyle}
              >
                <span aria-hidden="true">✏️</span>
                <span style={rowMainStyle}>Create &ldquo;{query.trim()}&rdquo;</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = { position: "relative", flex: "2 1 160px", minWidth: 0 };

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 40,
  maxHeight: 220,
  overflowY: "auto",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.14)",
  background: "rgba(20,22,26,0.98)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
  padding: 4,
  display: "grid",
  gap: 2,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  textAlign: "left",
  padding: "9px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const rowActiveStyle: CSSProperties = {
  ...rowStyle,
  background: "rgba(51,255,122,0.12)",
  color: "rgba(51,255,122,0.95)",
};

const rowMainStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const rowTagStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.5,
};

const createRowStyle: CSSProperties = {
  ...rowStyle,
  color: "rgba(56,189,248,0.95)",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.08)",
  margin: "2px 4px",
};
