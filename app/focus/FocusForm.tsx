"use client";

// Create/edit form for a Focus + its milestones. One client component used by
// both /focus/new and /focus/[id]/edit. Saves through the single saveFocus
// action (upsert + milestone reconcile). Uses the shared form-ui tokens so it
// matches every other log form; mobile-first with a max-width column.

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { saveFocus, deleteFocus, type MilestoneFormRow } from "@/app/focus/actions";
import { inputStyle, textareaStyle, Field, FormSection, FormStack } from "@/app/routines/[id]/log/form-ui";
import type { MilestoneScopeKind, FocusStatus } from "@/generated/prisma";

export type FocusFormInitial = {
  id?: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: FocusStatus;
  targetDate: string; // YYYY-MM-DD or ""
  targetKind: "SOFT" | "HARD";
  season: string;
  phase: "" | "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN";
  handoffNote: string;
  milestones: MilestoneFormRow[];
};

type PickItem = { id: string; name: string };

const COLOR_PRESETS = [
  { label: "Green", value: "#84cc78" },
  { label: "Blue", value: "#60a5fa" },
  { label: "Amber", value: "#fbbf24" },
  { label: "Violet", value: "#c084fc" },
  { label: "Orange", value: "#fb923c" },
  { label: "Red", value: "#f87171" },
];

const STATUS_OPTS: { value: FocusStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PLANNED", label: "Planned" },
  { value: "PAUSED", label: "Paused" },
  { value: "ACHIEVED", label: "Achieved" },
  { value: "ABANDONED", label: "Abandoned" },
];

// Local row model — adds a stable key for React (DB id or a synthetic one).
type Row = MilestoneFormRow & { key: string };
let synthCounter = 0;
function freshRow(): Row {
  synthCounter += 1;
  return { key: `new-${synthCounter}`, scopeKind: "ROUTINE", scopeRef: "", label: "", targetText: "", gateKind: "NONE" };
}

export default function FocusForm({
  initial,
  routines,
  exercises,
}: {
  initial: FocusFormInitial;
  routines: PickItem[];
  exercises: PickItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color || COLOR_PRESETS[0].value);
  const [status, setStatus] = useState<FocusStatus>(initial.status);
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [targetKind, setTargetKind] = useState<"SOFT" | "HARD">(initial.targetKind);
  const [season, setSeason] = useState(initial.season);
  const [phase, setPhase] = useState<FocusFormInitial["phase"]>(initial.phase);
  const [handoffNote, setHandoffNote] = useState(initial.handoffNote);
  const [rows, setRows] = useState<Row[]>(
    initial.milestones.length
      ? initial.milestones.map((m, i) => ({ ...m, key: m.id ?? `init-${i}` }))
      : [freshRow()]
  );

  const isEdit = Boolean(initial.id);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }
  function moveRow(key: string, dir: -1 | 1) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Give your focus a name.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await saveFocus({
          id: initial.id,
          name,
          description,
          icon,
          color,
          status,
          targetDate,
          targetKind,
          season,
          phase,
          handoffNote,
          milestones: rows.map((r) => ({
            id: r.id,
            scopeKind: r.scopeKind,
            scopeRef: r.scopeRef,
            label: r.label,
            targetText: r.targetText,
            estDurationDays: r.estDurationDays,
            gateKind: r.gateKind,
            gateNote: r.gateNote,
            gatePainThreshold: r.gatePainThreshold,
            gatePainDays: r.gatePainDays,
          })),
        });
        router.push(`/focus/${id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      }
    });
  }

  function onDelete() {
    if (!initial.id) return;
    if (!window.confirm("Delete this focus and its roadmap? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteFocus(initial.id!);
        router.push("/");
        router.refresh();
      } catch {
        setError("Couldn't delete. Try again.");
      }
    });
  }

  return (
    <FormStack>
      <FormSection title="Focus">
        <Field label="Name">
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Katahdin — Knife's Edge"
            autoFocus={!isEdit}
          />
        </Field>

        <Field label="Description" hint="What is this focus, and by when?">
          <textarea
            style={textareaStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — target date, the goal, key constraints"
          />
        </Field>

        <div style={twoCol}>
          <Field label="Icon" hint="An emoji">
            <input
              style={{ ...inputStyle, textAlign: "center" }}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="⛰️"
              maxLength={4}
            />
          </Field>
          <Field label="Color">
            <div style={swatchRow}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  aria-pressed={color === c.value}
                  style={{
                    ...swatch,
                    background: c.value,
                    outline: color === c.value ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
          </Field>
        </div>

        <div style={twoCol}>
          <Field label="Season" hint="e.g. Summer '26">
            <input style={inputStyle} value={season} onChange={(e) => setSeason(e.target.value)} placeholder="optional" />
          </Field>
          <Field label="Phase">
            <select style={inputStyle} value={phase} onChange={(e) => setPhase(e.target.value as FocusFormInitial["phase"])}>
              <option value="">— none —</option>
              <option value="BUILD">Build</option>
              <option value="PEAK">In season</option>
              <option value="OFFSEASON">Offseason</option>
              <option value="MAINTAIN">Maintain</option>
            </select>
          </Field>
        </div>

        <Field label="Hands off to" hint="What this becomes next — e.g. “→ Fall: send season”">
          <input style={inputStyle} value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} placeholder="optional" />
        </Field>

        <div style={twoCol}>
          <Field label="Target date" hint="Optional">
            <input
              type="date"
              style={inputStyle}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
          <Field label="Deadline type" hint={targetKind === "HARD" ? "Fixed by the world" : "Slides with your plan"}>
            <select style={inputStyle} value={targetKind} onChange={(e) => setTargetKind(e.target.value as "SOFT" | "HARD")}>
              <option value="SOFT">Soft — flexible</option>
              <option value="HARD">Hard — fixed date</option>
            </select>
          </Field>
        </div>

        {isEdit ? (
          <Field label="Status">
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as FocusStatus)}>
              {STATUS_OPTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        ) : null}
      </FormSection>

      <FormSection title="Roadmap">
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row, i) => (
            <MilestoneEditor
              key={row.key}
              row={row}
              index={i}
              total={rows.length}
              routines={routines}
              exercises={exercises}
              onChange={(patch) => updateRow(row.key, patch)}
              onRemove={() => removeRow(row.key)}
              onMove={(dir) => moveRow(row.key, dir)}
            />
          ))}
        </div>
        <button type="button" onClick={() => setRows((p) => [...p, freshRow()])} style={addBtn}>
          + Add milestone
        </button>
      </FormSection>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={actionRow}>
        {isEdit ? (
          <button type="button" onClick={onDelete} disabled={pending} style={deleteBtn}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => router.back()} disabled={pending} style={cancelBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={pending} style={saveBtn}>
            {pending ? "Saving…" : isEdit ? "Save" : "Create focus"}
          </button>
        </div>
      </div>
    </FormStack>
  );
}

function MilestoneEditor({
  row,
  index,
  total,
  routines,
  exercises,
  onChange,
  onRemove,
  onMove,
}: {
  row: Row;
  index: number;
  total: number;
  routines: PickItem[];
  exercises: PickItem[];
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div style={milestoneCard}>
      <div style={milestoneHead}>
        <span style={milestoneNum}>{index + 1}</span>
        <div style={reorderGroup}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={reorderBtn} aria-label="Move up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} style={reorderBtn} aria-label="Move down">↓</button>
          <button type="button" onClick={onRemove} style={removeBtn} aria-label="Remove milestone">✕</button>
        </div>
      </div>

      <input
        style={inputStyle}
        value={row.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Milestone — e.g. progress ham curls"
      />
      <div style={scopeRow}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={row.targetText ?? ""}
          onChange={(e) => onChange({ targetText: e.target.value })}
          placeholder="Target (optional) — e.g. 3×12 @ level 1"
        />
        <input
          type="number"
          inputMode="numeric"
          min={1}
          style={{ ...inputStyle, flex: "0 0 auto", width: 96 }}
          value={row.estDurationDays ?? ""}
          onChange={(e) => onChange({ estDurationDays: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="days"
          aria-label="Estimated days for this milestone"
        />
      </div>

      <div style={scopeRow}>
        <select
          style={{ ...inputStyle, flex: "0 0 auto", width: "auto" }}
          value={row.scopeKind}
          onChange={(e) => onChange({ scopeKind: e.target.value as MilestoneScopeKind, scopeRef: "" })}
        >
          <option value="ROUTINE">Routine</option>
          <option value="EXERCISE">Exercise</option>
          <option value="CAPACITY">General</option>
        </select>

        {row.scopeKind === "ROUTINE" ? (
          <select style={inputStyle} value={row.scopeRef ?? ""} onChange={(e) => onChange({ scopeRef: e.target.value })}>
            <option value="">— pick a routine —</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        ) : row.scopeKind === "EXERCISE" ? (
          <select style={inputStyle} value={row.scopeRef ?? ""} onChange={(e) => onChange({ scopeRef: e.target.value })}>
            <option value="">— pick an exercise —</option>
            {exercises.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        ) : (
          <input
            style={inputStyle}
            value={row.scopeRef ?? ""}
            onChange={(e) => onChange({ scopeRef: e.target.value })}
            placeholder="Track name — e.g. Descent hikes"
          />
        )}
      </div>
      <span style={scopeHint}>
        {row.scopeKind === "ROUTINE"
          ? "This milestone's label shows as the aim on that routine in your week."
          : row.scopeKind === "EXERCISE"
            ? "Groups under this exercise's track."
            : "A free-form track (no routine attached)."}
      </span>

      {/* Gate — the condition to advance this milestone. */}
      <div style={scopeRow}>
        <select
          style={{ ...inputStyle, flex: "0 0 auto", width: "auto" }}
          value={row.gateKind ?? "NONE"}
          onChange={(e) => onChange({ gateKind: e.target.value as Row["gateKind"] })}
          aria-label="Advance gate"
        >
          <option value="NONE">No gate</option>
          <option value="FREE_TEXT">Gate: I decide</option>
          <option value="PAIN">Gate: pain ≤</option>
          <option value="FREQUENCY">Gate: frequency</option>
        </select>

        {row.gateKind === "FREQUENCY" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              style={{ ...inputStyle, width: 76 }}
              value={row.gateFreqPerWeek ?? ""}
              onChange={(e) => onChange({ gateFreqPerWeek: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="2×"
              aria-label="Sessions per week"
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>/wk for</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={8}
              style={{ ...inputStyle, width: 80 }}
              value={row.gateFreqWeeks ?? ""}
              onChange={(e) => onChange({ gateFreqWeeks: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="3 wks"
              aria-label="Weeks"
            />
          </div>
        ) : row.gateKind === "FREE_TEXT" ? (
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={row.gateNote ?? ""}
            onChange={(e) => onChange({ gateNote: e.target.value })}
            placeholder="Criteria — e.g. nerve line quiet"
          />
        ) : row.gateKind === "PAIN" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              style={{ ...inputStyle, width: 70 }}
              value={row.gatePainThreshold ?? ""}
              onChange={(e) => onChange({ gatePainThreshold: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="≤ 2"
              aria-label="Pain threshold"
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>for</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              style={{ ...inputStyle, width: 80 }}
              value={row.gatePainDays ?? ""}
              onChange={(e) => onChange({ gatePainDays: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="7 days"
              aria-label="Days"
            />
          </div>
        ) : null}
      </div>
      {row.gateKind === "PAIN" ? (
        <span style={scopeHint}>Auto-checks your logged readings for the linked injury. Shows &ldquo;ready to advance&rdquo; when met.</span>
      ) : row.gateKind === "FREQUENCY" ? (
        <span style={scopeHint}>Auto-checks how often you&apos;ve logged this milestone&apos;s routine. Needs a Routine scope.</span>
      ) : null}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(96px, 140px) 1fr",
  gap: 12,
  alignItems: "start",
};

const swatchRow: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minHeight: 46 };

const swatch: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  padding: 0,
  outlineOffset: 2,
};

const milestoneCard: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.02)",
};

const milestoneHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const milestoneNum: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: 0.4,
};

const reorderGroup: CSSProperties = { display: "flex", gap: 4 };

const reorderBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
  lineHeight: "30px",
};

const removeBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.3)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,160,160,0.95)",
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center",
  lineHeight: "30px",
};

const scopeRow: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const scopeHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.42)",
  lineHeight: 1.4,
};

const addBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  textAlign: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px dashed rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.06)",
  color: "rgba(120,235,170,0.95)",
  fontSize: 13,
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.1)",
  color: "rgba(252,165,165,0.98)",
  fontSize: 12.5,
  fontWeight: 700,
};

const actionRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  paddingTop: 4,
};

const saveBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "11px 20px",
  borderRadius: 11,
  background: "rgba(51,255,122,0.16)",
  border: "1px solid rgba(51,255,122,0.5)",
  color: "#33ff7a",
  fontSize: 14,
  fontWeight: 900,
  textAlign: "center",
};

const cancelBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "11px 16px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
};

const deleteBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "11px 16px",
  borderRadius: 11,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(252,165,165,0.95)",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
};
