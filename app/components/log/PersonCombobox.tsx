"use client";

// Searchable / creatable person input. Type to filter people you've logged
// before (the shared pool), tap a suggestion to pick, or just keep what you
// typed to add a new person — names are stored verbatim in the log's
// sportData, so "creating" is implicit. Used by Spikeball (teammate +
// opponents) and any future sport with people fields.

import { useId, useRef, useState, type CSSProperties } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";

export default function PersonCombobox({
  value,
  onChange,
  people,
  placeholder = "Search or add a person",
}: {
  value: string;
  onChange: (next: string) => void;
  people: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  const query = value.trim().toLowerCase();
  const matches = people.filter((p) => p.toLowerCase().includes(query)).slice(0, 8);
  const exact = people.some((p) => p.toLowerCase() === query);
  const showCreate = query.length > 0 && !exact;

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        style={inputStyle}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a suggestion mousedown/tap registers before we close.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {open && (matches.length > 0 || showCreate) ? (
        <div id={listId} role="listbox" style={dropdownStyle}>
          {matches.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={p.toLowerCase() === query}
              style={optionStyle}
              // Pick on mousedown (fires before the input's blur) so a mobile
              // tap always registers — deferring to onClick drops the tap on
              // iOS when the blur closes the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
            >
              {p}
            </button>
          ))}
          {showCreate ? (
            <button
              type="button"
              style={{ ...optionStyle, opacity: 0.9 }}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(value.trim());
              }}
            >
              <span style={{ opacity: 0.6 }}>Add</span> “{value.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 30,
  maxHeight: 240,
  overflowY: "auto",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(17,24,39,0.98)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
  display: "grid",
  padding: 4,
  gap: 2,
};

const optionStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
