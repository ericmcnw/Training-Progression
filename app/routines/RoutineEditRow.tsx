"use client";

import { useState } from "react";

const CATEGORY_OPTIONS = [
  "Running",
  "Strength",
  "Climbing",
  "Mobility",
  "Recovery",
  "Habits",
  "General",
  "Custom…",
];

export default function RoutineEditRow({
  routineId,
  name: initialName,
  category: initialCategory,
  timesPerWeek: initialTimesPerWeek,
  onSaveAction,
  onRemoveAction,
}: {
  routineId: string;
  name: string;
  category: string;
  timesPerWeek: number | null;
  onSaveAction: (fd: FormData) => Promise<void>;
  onRemoveAction: (fd: FormData) => Promise<void>;
}) {
  const isPreset = CATEGORY_OPTIONS.includes(initialCategory);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(initialName);
  const [categoryPick, setCategoryPick] = useState(isPreset ? initialCategory : "Custom…");
  const [customCategory, setCustomCategory] = useState(isPreset ? "" : initialCategory);
  const [timesPerWeek, setTimesPerWeek] = useState(
    initialTimesPerWeek === null ? "" : String(initialTimesPerWeek)
  );

  const showCustom = categoryPick === "Custom…";

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}>
          Edit
        </button>
      ) : (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.03)",
            display: "grid",
            gap: 10,
            gridTemplateColumns: "1fr 180px 160px 140px",
            alignItems: "center",
            minWidth: 620,
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} />

          <select value={categoryPick} onChange={(e) => setCategoryPick(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder={showCustom ? "Custom category" : "—"}
            disabled={!showCustom}
            style={{ opacity: showCustom ? 1 : 0.45 }}
          />

          <input
            value={timesPerWeek}
            onChange={(e) => setTimesPerWeek(e.target.value)}
            placeholder="times/week"
            inputMode="numeric"
          />

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
            <form
              action={async (fd) => {
                fd.set("routineId", routineId);
                fd.set("name", name);
                fd.set("category", categoryPick === "Custom…" ? "__custom__" : categoryPick);
                fd.set("customCategory", customCategory);
                fd.set("timesPerWeek", timesPerWeek);
                await onSaveAction(fd);
                setOpen(false); // ✅ closes edit UI after save
              }}
            >
              <button type="submit">Save</button>
            </form>

            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>

            <form
              action={async (fd) => {
                fd.set("routineId", routineId);
                await onRemoveAction(fd);
              }}
            >
              <button type="submit">Remove</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}