"use client";

import type React from "react";
import { Field, inputStyle } from "../log/form-ui";
import {
  DEFAULT_POOL_LENGTH,
  DEFAULT_POOL_UNIT,
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  POOL_PRESETS,
  POOL_UNIT_LABELS,
  STROKE_LABELS,
  STROKE_ORDER,
  formatPoolDistance,
  formatSwimPace,
  poolSwimTotals,
  type PoolSwimData,
  type PoolSwimEquipment,
  type PoolSwimStroke,
  type PoolUnit,
} from "@/lib/pool-swim";

// Set rows hold strings so a half-typed field can stay empty, matching the
// GolfLogSheet hole/shot grid. Parsed into PoolSwimData at submit.
export type PoolSwimSetDraft = {
  localId: string;
  reps: string;
  distance: string;
  stroke: PoolSwimStroke;
  equipment: PoolSwimEquipment[];
  timing: "none" | "sendoff" | "rest";
  sendOffMin: string;
  sendOffSec: string;
  restSec: string;
  note: string;
};

export type PoolSwimFormState = {
  poolLength: string;
  poolUnit: PoolUnit;
  sets: PoolSwimSetDraft[];
};

let seq = 0;
function nextLocalId() {
  seq += 1;
  return `swimset-${Date.now()}-${seq}`;
}

export function newPoolSwimSetDraft(): PoolSwimSetDraft {
  return {
    localId: nextLocalId(),
    reps: "1",
    distance: "",
    stroke: "free",
    equipment: [],
    timing: "none",
    sendOffMin: "",
    sendOffSec: "",
    restSec: "",
    note: "",
  };
}

export function emptyPoolSwimFormState(
  poolLength: number = DEFAULT_POOL_LENGTH,
  poolUnit: PoolUnit = DEFAULT_POOL_UNIT,
): PoolSwimFormState {
  return { poolLength: String(poolLength), poolUnit, sets: [newPoolSwimSetDraft()] };
}

function numOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function poolSwimFormToData(state: PoolSwimFormState): PoolSwimData {
  return {
    sport: "pool-swim",
    poolLength: numOrNull(state.poolLength) ?? DEFAULT_POOL_LENGTH,
    poolUnit: state.poolUnit,
    sets: state.sets.map((set) => {
      const sendOff =
        set.timing === "sendoff"
          ? (Number(set.sendOffMin || "0") * 60 + Number(set.sendOffSec || "0")) || null
          : null;
      return {
        reps: numOrNull(set.reps) ?? 1,
        distance: numOrNull(set.distance),
        stroke: set.stroke,
        equipment: set.equipment,
        sendOffSec: sendOff,
        restSec: set.timing === "rest" ? numOrNull(set.restSec) : null,
        note: set.note.trim() || null,
      };
    }),
  };
}

export function poolSwimDataToForm(data: PoolSwimData): PoolSwimFormState {
  return {
    poolLength: String(data.poolLength),
    poolUnit: data.poolUnit,
    sets:
      data.sets.length > 0
        ? data.sets.map((set) => ({
            localId: nextLocalId(),
            reps: String(set.reps),
            distance: set.distance != null ? String(set.distance) : "",
            stroke: set.stroke,
            equipment: set.equipment,
            timing: set.sendOffSec != null ? "sendoff" : set.restSec != null ? "rest" : "none",
            sendOffMin: set.sendOffSec != null ? String(Math.floor(set.sendOffSec / 60)) : "",
            sendOffSec: set.sendOffSec != null ? String(set.sendOffSec % 60) : "",
            restSec: set.restSec != null ? String(set.restSec) : "",
            note: set.note ?? "",
          }))
        : [newPoolSwimSetDraft()],
  };
}

export default function PoolSwimSets({
  value,
  onChange,
  durationSec,
}: {
  value: PoolSwimFormState;
  onChange: (next: PoolSwimFormState) => void;
  durationSec: number | null;
}) {
  const unitLabel = POOL_UNIT_LABELS[value.poolUnit];
  const totals = poolSwimTotals(poolSwimFormToData(value), durationSec);
  const pace = formatSwimPace(totals.paceSecPer100, value.poolUnit);

  function patchSet(localId: string, patch: Partial<PoolSwimSetDraft>) {
    onChange({
      ...value,
      sets: value.sets.map((s) => (s.localId === localId ? { ...s, ...patch } : s)),
    });
  }

  function addSet() {
    onChange({ ...value, sets: [...value.sets, newPoolSwimSetDraft()] });
  }

  function duplicateSet(localId: string) {
    const source = value.sets.find((s) => s.localId === localId);
    if (!source) return;
    const index = value.sets.findIndex((s) => s.localId === localId);
    const copy = { ...source, localId: nextLocalId() };
    onChange({
      ...value,
      sets: [...value.sets.slice(0, index + 1), copy, ...value.sets.slice(index + 1)],
    });
  }

  function removeSet(localId: string) {
    if (value.sets.length === 1) {
      onChange({ ...value, sets: [newPoolSwimSetDraft()] });
      return;
    }
    onChange({ ...value, sets: value.sets.filter((s) => s.localId !== localId) });
  }

  function toggleEquipment(localId: string, item: PoolSwimEquipment) {
    const set = value.sets.find((s) => s.localId === localId);
    if (!set) return;
    patchSet(localId, {
      equipment: set.equipment.includes(item)
        ? set.equipment.filter((e) => e !== item)
        : [...set.equipment, item],
    });
  }

  const activePreset = POOL_PRESETS.find(
    (p) => String(p.length) === value.poolLength.trim() && p.unit === value.poolUnit,
  );

  return (
    <div style={blockStyle}>
      <div style={headerStyle}>Pool</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {POOL_PRESETS.map((preset) => {
          const active = activePreset?.label === preset.label;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange({ ...value, poolLength: String(preset.length), poolUnit: preset.unit })}
              style={active ? chipActiveStyle : chipStyle}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
        <Field label="Pool length" hint="One length = one way across.">
          <input
            style={inputStyle}
            value={value.poolLength}
            onChange={(e) => onChange({ ...value, poolLength: e.target.value })}
            inputMode="numeric"
            placeholder="25"
          />
        </Field>
        <Field label="Units">
          <select
            style={inputStyle}
            value={value.poolUnit}
            onChange={(e) => onChange({ ...value, poolUnit: e.target.value as PoolUnit })}
          >
            <option value="yd">yd</option>
            <option value="m">m</option>
          </select>
        </Field>
      </div>

      <div style={headerStyle}>Sets</div>

      {value.sets.map((set, index) => (
        <div key={set.localId} style={setCardStyle}>
          <div style={setCardHeaderStyle}>
            <span style={setIndexStyle}>Set {index + 1}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={miniButtonStyle} onClick={() => duplicateSet(set.localId)}>
                Duplicate
              </button>
              <button type="button" style={miniDangerButtonStyle} onClick={() => removeSet(set.localId)}>
                Remove
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "72px 16px 1fr", gap: 8, alignItems: "end" }}>
            <Field label="Reps">
              <input
                style={{ ...inputStyle, textAlign: "center", padding: "10px 6px" }}
                value={set.reps}
                onChange={(e) => patchSet(set.localId, { reps: e.target.value })}
                inputMode="numeric"
                placeholder="4"
              />
            </Field>
            <div style={multiplyStyle}>×</div>
            <Field label={`Distance (${unitLabel})`}>
              <input
                style={inputStyle}
                value={set.distance}
                onChange={(e) => patchSet(set.localId, { distance: e.target.value })}
                inputMode="numeric"
                placeholder="100"
              />
            </Field>
          </div>

          <Field label="Stroke">
            <select
              style={inputStyle}
              value={set.stroke}
              onChange={(e) => patchSet(set.localId, { stroke: e.target.value as PoolSwimStroke })}
            >
              {STROKE_ORDER.map((stroke) => (
                <option key={stroke} value={stroke}>
                  {STROKE_LABELS[stroke]}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <div style={miniLabelStyle}>Equipment</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {EQUIPMENT_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(set.localId, item)}
                  style={set.equipment.includes(item) ? chipActiveStyle : chipStyle}
                >
                  {EQUIPMENT_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={miniLabelStyle}>Timing</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {(
                [
                  ["none", "None"],
                  ["sendoff", "Send-off"],
                  ["rest", "Rest"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => patchSet(set.localId, { timing: mode })}
                  style={set.timing === mode ? chipActiveStyle : chipStyle}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {set.timing === "sendoff" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 12px 1fr", gap: 8, alignItems: "end" }}>
              <Field label="Send-off min">
                <input
                  style={{ ...inputStyle, textAlign: "center" }}
                  value={set.sendOffMin}
                  onChange={(e) => patchSet(set.localId, { sendOffMin: e.target.value })}
                  inputMode="numeric"
                  placeholder="2"
                />
              </Field>
              <div style={multiplyStyle}>:</div>
              <Field label="sec">
                <input
                  style={{ ...inputStyle, textAlign: "center" }}
                  value={set.sendOffSec}
                  onChange={(e) => patchSet(set.localId, { sendOffSec: e.target.value })}
                  inputMode="numeric"
                  placeholder="00"
                />
              </Field>
            </div>
          )}

          {set.timing === "rest" && (
            <Field label="Rest between reps (sec)">
              <input
                style={inputStyle}
                value={set.restSec}
                onChange={(e) => patchSet(set.localId, { restSec: e.target.value })}
                inputMode="numeric"
                placeholder="20"
              />
            </Field>
          )}

          <Field label="Set note (optional)">
            <input
              style={inputStyle}
              value={set.note}
              onChange={(e) => patchSet(set.localId, { note: e.target.value })}
              placeholder="Warmup, descend 1-4, build…"
            />
          </Field>
        </div>
      ))}

      <button type="button" style={addSetButtonStyle} onClick={addSet}>
        + Add set
      </button>

      <div style={totalsStyle}>
        <div style={totalRowStyle}>
          <span style={totalLabelStyle}>TOTAL</span>
          <span style={totalValueStyle}>{formatPoolDistance(totals.distance, value.poolUnit)}</span>
        </div>
        <div style={totalRowStyle}>
          <span style={totalLabelStyle}>LENGTHS</span>
          <span style={totalValueStyle}>
            {totals.lengths != null ? Math.round(totals.lengths * 10) / 10 : "—"}
          </span>
        </div>
        <div style={totalRowStyle}>
          <span style={totalLabelStyle}>PACE</span>
          <span style={totalValueStyle}>{pace ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

// Cyan tint keys the block to the swimming palette in endurance-palette.ts,
// the way the interval block keys to the blue endurance picker.
const blockStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 14,
  borderRadius: 12,
  background: "rgba(6,182,212,0.06)",
  border: "1px solid rgba(6,182,212,0.24)",
};

const headerStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(165,243,252,0.95)",
};

const setCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(128,128,128,0.28)",
};

const setCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const setIndexStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  opacity: 0.8,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
};

const multiplyStyle: React.CSSProperties = {
  paddingBottom: 12,
  fontSize: 18,
  fontWeight: 900,
  opacity: 0.5,
  textAlign: "center",
};

const chipStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(128,128,128,0.55)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontSize: 14,
  fontWeight: 800,
  touchAction: "manipulation",
};

const chipActiveStyle: React.CSSProperties = {
  ...chipStyle,
  border: "1px solid rgba(6,182,212,0.85)",
  background: "rgba(6,182,212,0.22)",
  color: "#ecfeff",
};

const miniButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.5)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  touchAction: "manipulation",
};

const miniDangerButtonStyle: React.CSSProperties = {
  ...miniButtonStyle,
  border: "1px solid rgba(248,113,113,0.5)",
  background: "rgba(248,113,113,0.12)",
};

const addSetButtonStyle: React.CSSProperties = {
  minHeight: 48,
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px dashed rgba(6,182,212,0.6)",
  background: "rgba(6,182,212,0.08)",
  color: "inherit",
  fontSize: 15,
  fontWeight: 900,
  touchAction: "manipulation",
};

const totalsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  padding: "12px 10px",
  borderRadius: 12,
  border: "1px solid rgba(6,182,212,0.35)",
  background: "rgba(6,182,212,0.08)",
};

const totalRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  minWidth: 0,
};

const totalLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.65,
};

const totalValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  textAlign: "center",
  overflowWrap: "anywhere",
};
