"use client";

// "Also did" — a few strength sets logged alongside a sport session, e.g.
// pull-ups after climbing. Deliberately lighter than the full workout editor:
// starting a whole strength log for three sets is more work than the sets,
// which is exactly why they never got recorded.
//
// Collapsed until opened, and the library loads lazily on first open so the
// sport sheet's initial render is unchanged.

import { useEffect, useRef, useState } from "react";
import { inputStyle } from "./[id]/log/form-ui";
import {
  loadSessionExerciseOptions,
  type SessionExerciseOption,
} from "@/app/log/climb-log-actions";

export type ExtraSetRow = { setNumber: number; reps?: string; seconds?: string; weightLb?: string };

export type ExtraExercise = {
  localId: string;
  exerciseId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  rows: ExtraSetRow[];
};

type LibraryExercise = { id: string; name: string; unit: "REPS" | "TIME"; supportsWeight: boolean };

/** Shape the log actions take. Rows without a primary metric are dropped —
 *  a weight-only row isn't a set, same rule the workout form applies. */
export function toExerciseInput(value: ExtraExercise[]) {
  return value
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: entry.rows
        .filter((row) => (entry.unit === "REPS" ? row.reps?.trim() : row.seconds?.trim()))
        .map((row, index) => ({
          setNumber: index + 1,
          reps: row.reps?.trim() ? Number(row.reps) : null,
          seconds: row.seconds?.trim() ? Number(row.seconds) : null,
          weightLb: row.weightLb?.trim() ? Number(row.weightLb) : null,
        })),
    }))
    .filter((entry) => entry.sets.length > 0);
}

export function countExtraSets(value: ExtraExercise[]) {
  return toExerciseInput(value).reduce((sum, entry) => sum + entry.sets.length, 0);
}

function newLocalId() {
  return Math.random().toString(36).slice(2);
}

function blockFromOption(option: SessionExerciseOption | LibraryExercise): ExtraExercise {
  const last = "lastSets" in option ? option.lastSets : [];
  const rows: ExtraSetRow[] =
    last.length > 0
      ? last.map((set, index) => ({
          setNumber: index + 1,
          reps: set.reps != null ? String(set.reps) : undefined,
          seconds: set.seconds != null ? String(set.seconds) : undefined,
          weightLb: set.weightLb != null ? String(set.weightLb) : undefined,
        }))
      : [{ setNumber: 1 }, { setNumber: 2 }];
  return {
    localId: newLocalId(),
    exerciseId: option.id,
    name: option.name,
    unit: option.unit,
    supportsWeight: option.supportsWeight,
    rows,
  };
}

export default function SessionExtraSets({
  value,
  onChange,
  sportSlug,
  startOpen = false,
}: {
  value: ExtraExercise[];
  onChange: (next: ExtraExercise[]) => void;
  /** Ranks the quick-add chips — exercises tagged for this sport, most-logged
   *  first. Falls back to general strength when omitted. */
  sportSlug?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen || value.length > 0);
  const [options, setOptions] = useState<{ recent: SessionExerciseOption[]; all: LibraryExercise[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    setLoading(true);
    loadSessionExerciseOptions(sportSlug)
      .then(setOptions)
      .catch(() => setOptions({ recent: [], all: [] }))
      .finally(() => setLoading(false));
  }, [open, sportSlug]);

  function addExercise(option: SessionExerciseOption | LibraryExercise) {
    onChange([...value, blockFromOption(option)]);
    setQuery("");
    setShowAll(false);
  }

  function updateRow(localId: string, setNumber: number, key: keyof ExtraSetRow, next: string) {
    onChange(
      value.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              rows: entry.rows.map((row) => (row.setNumber === setNumber ? { ...row, [key]: next } : row)),
            }
          : entry
      )
    );
  }

  const setCount = countExtraSets(value);
  const chips = (options?.recent ?? []).filter((option) => !value.some((entry) => entry.exerciseId === option.id));
  const matches = query.trim()
    ? (options?.all ?? [])
        .filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div style={styles.card}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={styles.header}>
        <span style={styles.headerLabel}>Also did</span>
        <span style={styles.headerMeta}>
          {setCount > 0
            ? `${value.length} exercise${value.length === 1 ? "" : "s"} · ${setCount} set${setCount === 1 ? "" : "s"}`
            : "optional"}
        </span>
        <span style={{ ...styles.chevron, transform: open ? "rotate(180deg)" : "none" }} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div style={styles.body}>
          {value.map((entry) => (
            <div key={entry.localId} style={styles.block}>
              <div style={styles.blockHead}>
                <span style={styles.blockName}>{entry.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((item) => item.localId !== entry.localId))}
                  style={styles.removeBtn}
                  aria-label={`Remove ${entry.name}`}
                >
                  ✕
                </button>
              </div>
              {entry.rows.map((row) => (
                <div key={row.setNumber} style={styles.row}>
                  <span style={styles.setNum}>{row.setNumber}</span>
                  {entry.supportsWeight && (
                    <input
                      type="number"
                      inputMode="decimal"
                      value={row.weightLb ?? ""}
                      placeholder="lb"
                      onChange={(e) => updateRow(entry.localId, row.setNumber, "weightLb", e.target.value)}
                      style={styles.cell}
                      aria-label={`${entry.name} set ${row.setNumber} weight`}
                    />
                  )}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={(entry.unit === "REPS" ? row.reps : row.seconds) ?? ""}
                    placeholder={entry.unit === "REPS" ? "reps" : "sec"}
                    onChange={(e) =>
                      updateRow(
                        entry.localId,
                        row.setNumber,
                        entry.unit === "REPS" ? "reps" : "seconds",
                        e.target.value
                      )
                    }
                    style={styles.cell}
                    aria-label={`${entry.name} set ${row.setNumber} ${entry.unit === "REPS" ? "reps" : "seconds"}`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onChange(
                    value.map((item) =>
                      item.localId === entry.localId
                        ? { ...item, rows: [...item.rows, { setNumber: item.rows.length + 1 }] }
                        : item
                    )
                  )
                }
                style={styles.addSetBtn}
              >
                + set
              </button>
            </div>
          ))}

          {loading && <div style={styles.hint}>Loading exercises…</div>}

          {!loading && chips.length > 0 && (
            <div style={styles.chipRow}>
              {chips.map((option) => (
                <button key={option.id} type="button" onClick={() => addExercise(option)} style={styles.chip}>
                  + {option.name}
                </button>
              ))}
            </div>
          )}

          {!loading && options && (
            <>
              {showAll ? (
                <>
                  <input
                    type="text"
                    value={query}
                    placeholder="Search exercises…"
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ ...inputStyle, marginTop: 4 }}
                    aria-label="Search exercises"
                  />
                  {matches.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => addExercise(option)}
                      style={styles.matchRow}
                    >
                      {option.name}
                    </button>
                  ))}
                </>
              ) : (
                <button type="button" onClick={() => setShowAll(true)} style={styles.otherBtn}>
                  Something else…
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid rgba(128,128,128,0.32)",
    borderRadius: 14,
    background: "rgba(128,128,128,0.05)",
    overflow: "hidden",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 48,
    padding: "0 14px",
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
  } as React.CSSProperties,
  headerLabel: { fontWeight: 800, fontSize: 14 } as React.CSSProperties,
  headerMeta: { marginLeft: "auto", fontSize: 12, opacity: 0.6, fontWeight: 700 } as React.CSSProperties,
  chevron: { fontSize: 12, opacity: 0.5, transition: "transform 160ms ease" } as React.CSSProperties,
  body: { display: "grid", gap: 10, padding: "0 12px 12px" } as React.CSSProperties,
  block: {
    display: "grid",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.28)",
    background: "rgba(0,0,0,0.15)",
  } as React.CSSProperties,
  blockHead: { display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  blockName: { fontWeight: 800, fontSize: 14, flex: 1, minWidth: 0 } as React.CSSProperties,
  removeBtn: {
    minWidth: 44,
    minHeight: 44,
    border: "none",
    background: "transparent",
    color: "inherit",
    opacity: 0.55,
    fontSize: 15,
    cursor: "pointer",
    touchAction: "manipulation",
  } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  setNum: { width: 16, fontSize: 13, fontWeight: 800, opacity: 0.55 } as React.CSSProperties,
  cell: { ...inputStyle, flex: 1, minWidth: 0, textAlign: "center", padding: "8px 6px" } as React.CSSProperties,
  addSetBtn: {
    minHeight: 44,
    border: "1px dashed rgba(128,128,128,0.45)",
    borderRadius: 10,
    background: "transparent",
    color: "inherit",
    fontSize: 13,
    fontWeight: 700,
    opacity: 0.75,
    cursor: "pointer",
    touchAction: "manipulation",
  } as React.CSSProperties,
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 } as React.CSSProperties,
  chip: {
    minHeight: 44,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(132,204,255,0.4)",
    background: "rgba(132,204,255,0.08)",
    color: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    touchAction: "manipulation",
  } as React.CSSProperties,
  otherBtn: {
    minHeight: 44,
    borderRadius: 10,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "transparent",
    color: "inherit",
    fontSize: 13,
    fontWeight: 700,
    opacity: 0.8,
    cursor: "pointer",
    touchAction: "manipulation",
  } as React.CSSProperties,
  hint: { fontSize: 12, opacity: 0.6 } as React.CSSProperties,
  matchRow: {
    minHeight: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(128,128,128,0.28)",
    background: "rgba(255,255,255,0.02)",
    color: "inherit",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "left",
    cursor: "pointer",
    touchAction: "manipulation",
  } as React.CSSProperties,
};
