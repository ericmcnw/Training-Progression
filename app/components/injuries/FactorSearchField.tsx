"use client";

// Smart tag field for aggravating factors. Type to filter the suggestion pool
// (your exercises + presets + previously-used factors); pick a match, or if
// nothing fits, hit enter / "Create …" to add exactly what you typed — which
// then joins the pool for next time. Selected factors show as removable chips.

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";

export default function FactorSearchField({
  value,
  onChange,
  suggestions,
  placeholder = "Search or add a factor…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const selectedLower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = suggestions.filter((s) => !selectedLower.has(s.toLowerCase()));
    if (!q) return pool.slice(0, 8);
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [query, suggestions, selectedLower]);

  const exactExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Boolean(q) && (selectedLower.has(q) || suggestions.some((s) => s.toLowerCase() === q));
  }, [query, suggestions, selectedLower]);

  function add(factor: string) {
    const v = factor.trim();
    if (!v || selectedLower.has(v.toLowerCase())) {
      setQuery("");
      return;
    }
    onChange([...value, v]);
    setQuery("");
  }

  function remove(factor: string) {
    onChange(value.filter((f) => f !== factor));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      const exactMatch = filtered.find((s) => s.toLowerCase() === q.toLowerCase());
      add(exactMatch ?? q);
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  const showCreate = Boolean(query.trim()) && !exactExists;
  const showDropdown = focused && (filtered.length > 0 || showCreate);

  return (
    <div style={wrap}>
      <div style={chipBox}>
        {value.map((f) => (
          <span key={f} style={chipStyle}>
            {f}
            <button type="button" onClick={() => remove(f)} style={chipX} aria-label={`Remove ${f}`}>
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder={value.length ? "" : placeholder}
          style={inputStyle}
          aria-label="Aggravating factors"
        />
      </div>
      {showDropdown && (
        <div style={dropdown}>
          {showCreate && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); add(query); }} style={createRow}>
              + Create “{query.trim()}”
            </button>
          )}
          {filtered.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); add(s); }} style={row}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const wrap: CSSProperties = { position: "relative", display: "grid", gap: 0 };

const chipBox: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  minHeight: 46,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 6px 5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(251,146,60,0.4)",
  background: "rgba(251,146,60,0.12)",
  color: "#FED7AA",
  fontSize: 12.5,
  fontWeight: 800,
};

const chipX: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  borderRadius: 999,
  border: "none",
  background: "rgba(255,255,255,0.10)",
  color: "inherit",
  fontSize: 13,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};

// fontSize 16 — iOS zoom guard.
const inputStyle: CSSProperties = {
  flex: "1 1 120px",
  minWidth: 100,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
  padding: "4px 2px",
};

const dropdown: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 30,
  maxHeight: 260,
  overflowY: "auto",
  display: "grid",
  gap: 2,
  padding: 6,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0b1422",
  boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
};

const row: CSSProperties = {
  textAlign: "left",
  padding: "9px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 40,
};

const createRow: CSSProperties = {
  ...row,
  color: "#86efac",
  fontWeight: 800,
};
