"use client";

// Rotation builder — create a rotation, then add/order slots, set each slot's
// primary routine, and map covering activities (routines or sport/endurance
// tags). All edits go through server actions and revalidate /plan. Collapsed
// behind a details toggle on the Plan page so the display stays the default.

import { useState, useTransition, type CSSProperties } from "react";
import { domainColor } from "@/lib/routines";
import {
  addCoverage,
  addSlot,
  createRotation,
  deleteRotation,
  deleteSlot,
  moveSlot,
  removeCoverage,
  renameRotation,
  updateSlot,
} from "./rotation-actions";

export type BuilderRoutine = { id: string; name: string; domain: string };
export type BuilderTag = { tag: string; label: string; icon: string | null };
export type BuilderCoverage = { id: string; routineId: string | null; tag: string | null };
export type BuilderSlot = {
  id: string;
  name: string;
  primaryRoutineId: string | null;
  coverage: BuilderCoverage[];
};

export default function RotationBuilder({
  rotation,
  slots,
  routines,
  tags,
}: {
  rotation: { id: string; name: string } | null;
  slots: BuilderSlot[];
  routines: BuilderRoutine[];
  tags: BuilderTag[];
}) {
  const [pending, startTransition] = useTransition();
  const [newRotationName, setNewRotationName] = useState("");
  const [newSlotName, setNewSlotName] = useState("");

  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn());

  if (!rotation) {
    return (
      <div style={createCard}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Create a rotation</div>
        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          A rotation is an ordered list of sessions (Push / Pull / Legs, Upper / Lower, your own
          split). Log one and the next is recommended automatically.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newRotationName}
            onChange={(e) => setNewRotationName(e.target.value)}
            placeholder="e.g. Push / Pull / Legs"
            style={inputStyle}
          />
          <button
            type="button"
            disabled={pending || !newRotationName.trim()}
            onClick={() => run(async () => {
              await createRotation(newRotationName);
              setNewRotationName("");
            })}
            style={primaryBtn}
          >
            Create
          </button>
        </div>
      </div>
    );
  }

  return (
    <details style={builderShell}>
      <summary style={builderSummary}>⚙︎ Edit rotation</summary>
      <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
        {/* Rotation name + delete */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            defaultValue={rotation.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value.trim() !== rotation.name) {
                run(() => renameRotation(rotation.id, e.target.value));
              }
            }}
            style={{ ...inputStyle, flex: 1 }}
            aria-label="Rotation name"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this rotation? Your training logs are not affected.")) {
                run(() => deleteRotation(rotation.id));
              }
            }}
            style={dangerBtn}
          >
            Delete
          </button>
        </div>

        {/* Slots */}
        <div style={{ display: "grid", gap: 10 }}>
          {slots.map((slot, idx) => (
            <SlotEditor
              key={slot.id}
              slot={slot}
              isFirst={idx === 0}
              isLast={idx === slots.length - 1}
              routines={routines}
              tags={tags}
              pending={pending}
              run={run}
            />
          ))}
        </div>

        {/* Add slot */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newSlotName}
            onChange={(e) => setNewSlotName(e.target.value)}
            placeholder="Add a slot (e.g. Push)"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSlotName.trim()) {
                e.preventDefault();
                run(async () => {
                  await addSlot(rotation.id, newSlotName);
                  setNewSlotName("");
                });
              }
            }}
          />
          <button
            type="button"
            disabled={pending || !newSlotName.trim()}
            onClick={() => run(async () => {
              await addSlot(rotation.id, newSlotName);
              setNewSlotName("");
            })}
            style={primaryBtn}
          >
            + Slot
          </button>
        </div>
      </div>
    </details>
  );
}

function SlotEditor({
  slot,
  isFirst,
  isLast,
  routines,
  tags,
  pending,
  run,
}: {
  slot: BuilderSlot;
  isFirst: boolean;
  isLast: boolean;
  routines: BuilderRoutine[];
  tags: BuilderTag[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const coverageRoutineIds = new Set(slot.coverage.map((c) => c.routineId).filter(Boolean));
  const coverageTagSet = new Set(slot.coverage.map((c) => c.tag).filter(Boolean));

  return (
    <div style={slotCard}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          defaultValue={slot.name}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value.trim() !== slot.name) {
              run(() => updateSlot(slot.id, { name: e.target.value }));
            }
          }}
          style={{ ...inputStyle, flex: 1, fontWeight: 800 }}
          aria-label="Slot name"
        />
        <button type="button" disabled={pending || isFirst} onClick={() => run(() => moveSlot(slot.id, "up"))} style={iconBtn} aria-label="Move up">↑</button>
        <button type="button" disabled={pending || isLast} onClick={() => run(() => moveSlot(slot.id, "down"))} style={iconBtn} aria-label="Move down">↓</button>
        <button type="button" disabled={pending} onClick={() => run(() => deleteSlot(slot.id))} style={iconBtnDanger} aria-label="Delete slot">✕</button>
      </div>

      {/* Primary routine */}
      <label style={fieldLabel}>
        Primary routine
        <select
          value={slot.primaryRoutineId ?? ""}
          onChange={(e) => run(() => updateSlot(slot.id, { primaryRoutineId: e.target.value || null }))}
          style={selectStyle}
        >
          <option value="">None (covered by activities only)</option>
          {routines.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      {/* Coverage */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={fieldLabelText}>Also counts as</div>
        {slot.coverage.length > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {slot.coverage.map((c) => {
              const tag = c.tag ? tags.find((t) => t.tag === c.tag) : null;
              const routine = c.routineId ? routines.find((r) => r.id === c.routineId) : null;
              const label = tag ? `${tag.icon ?? ""} ${tag.label}`.trim() : routine?.name ?? "(removed)";
              return (
                <button key={c.id} type="button" disabled={pending} onClick={() => run(() => removeCoverage(c.id))} style={coverageChip} title="Remove">
                  {label} <span style={{ opacity: 0.6 }}>✕</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select
            value=""
            onChange={(e) => { if (e.target.value) run(() => addCoverage(slot.id, { tag: e.target.value })); }}
            style={{ ...selectStyle, flex: "1 1 140px" }}
            disabled={pending}
            aria-label="Add covering sport/activity"
          >
            <option value="">+ Sport / activity…</option>
            {tags.filter((t) => !coverageTagSet.has(t.tag)).map((t) => (
              <option key={t.tag} value={t.tag}>{t.icon ? `${t.icon} ` : ""}{t.label}</option>
            ))}
          </select>
          <select
            value=""
            onChange={(e) => { if (e.target.value) run(() => addCoverage(slot.id, { routineId: e.target.value })); }}
            style={{ ...selectStyle, flex: "1 1 140px" }}
            disabled={pending}
            aria-label="Add covering routine"
          >
            <option value="">+ Routine…</option>
            {routines.filter((r) => r.id !== slot.primaryRoutineId && !coverageRoutineIds.has(r.id)).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <span aria-hidden style={{ ...slotAccent, background: domainColor("sport") }} />
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const createCard: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
};

const builderShell: CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 12,
  marginTop: 4,
};

const builderSummary: CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.3,
  opacity: 0.8,
  listStyle: "none",
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
};

const slotCard: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 10,
  padding: "12px 12px 12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  overflow: "hidden",
};

const slotAccent: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: 3,
};

// fontSize 16 — iOS zoom guard (CLAUDE.md rule 3a).
const inputStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
  minWidth: 0,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  fontWeight: 700,
  cursor: "pointer",
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};

const fieldLabelText: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};

const primaryBtn: CSSProperties = {
  padding: "9px 16px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerBtn: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,113,113,0.95)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const iconBtn: CSSProperties = {
  width: 34,
  height: 34,
  minHeight: 34,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  flexShrink: 0,
};

const iconBtnDanger: CSSProperties = {
  ...iconBtn,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.06)",
  color: "rgba(248,113,113,0.9)",
};

const coverageChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid rgba(120,190,255,0.35)",
  background: "rgba(120,190,255,0.10)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
};
