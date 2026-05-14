"use client";

// Inline frequency goal editor for the routine create/edit form. Renders a
// compact card with: an enable/disable toggle, quick-pick preset chips for
// the common cadences (Daily / 3× per week / etc.), a "Custom" expansion
// for arbitrary count/interval/unit, and a Substitute picker (cards rather
// than bare checkboxes) for routines that cover this goal's slots.
//
// All inputs use 16px font to dodge iOS Safari's auto-zoom behavior.

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RoutineFrequencyUnit } from "@/generated/prisma";
import { formatRoutineTargetLabel } from "@/lib/routine-frequency";

type Preset = {
  key: string;
  label: string;
  count: number;
  interval: number;
  unit: RoutineFrequencyUnit;
  hint: string;
};

const PRESETS: Preset[] = [
  { key: "daily",   label: "Daily",      count: 1, interval: 1, unit: "DAY",   hint: "Every day" },
  { key: "5x_week", label: "5× / week",  count: 5, interval: 1, unit: "WEEK",  hint: "Most days" },
  { key: "3x_week", label: "3× / week",  count: 3, interval: 1, unit: "WEEK",  hint: "Three days" },
  { key: "2x_week", label: "2× / week",  count: 2, interval: 1, unit: "WEEK",  hint: "Twice weekly" },
  { key: "1x_week", label: "Weekly",     count: 1, interval: 1, unit: "WEEK",  hint: "Once a week" },
  { key: "1x_month", label: "Monthly",   count: 1, interval: 1, unit: "MONTH", hint: "Once a month" },
];

function presetKeyFor(count: number, interval: number, unit: RoutineFrequencyUnit): string | null {
  const match = PRESETS.find((p) => p.count === count && p.interval === interval && p.unit === unit);
  return match?.key ?? null;
}

export default function RoutineFrequencyTargetFields({
  initialCount,
  initialUnit,
  initialInterval,
  initialEnabled,
  availableSubstituteRoutines = [],
  initialSubstituteRoutineIds = [],
}: {
  initialCount?: number | null;
  initialUnit?: RoutineFrequencyUnit | null;
  initialInterval?: number | null;
  initialEnabled?: boolean;
  availableSubstituteRoutines?: Array<{ id: string; name: string }>;
  initialSubstituteRoutineIds?: string[];
}) {
  const hasInitialTarget =
    Number.isFinite(initialCount) &&
    (initialCount ?? 0) > 0 &&
    !!initialUnit &&
    Number.isFinite(initialInterval) &&
    (initialInterval ?? 0) > 0;
  const [enabled, setEnabled] = useState(initialEnabled ?? hasInitialTarget);
  const [count, setCount] = useState(String(initialCount ?? 3));
  const [unit, setUnit] = useState<RoutineFrequencyUnit>(initialUnit ?? "WEEK");
  const [interval, setInterval] = useState(String(initialInterval ?? 1));
  const [substituteIds, setSubstituteIds] = useState<Set<string>>(
    () => new Set(initialSubstituteRoutineIds)
  );

  const numCount = Number(count);
  const numInterval = Number(interval);
  const matchedPresetKey = useMemo(
    () => presetKeyFor(numCount, numInterval, unit),
    [numCount, numInterval, unit]
  );
  const showCustom = matchedPresetKey === null;

  function applyPreset(p: Preset) {
    setCount(String(p.count));
    setInterval(String(p.interval));
    setUnit(p.unit);
  }

  const preview = useMemo(
    () =>
      enabled
        ? formatRoutineTargetLabel({
            targetFrequencyCount: numCount,
            targetFrequencyUnit: unit,
            targetFrequencyInterval: numInterval,
          })
        : "No target",
    [numCount, enabled, numInterval, unit]
  );

  const substituteCount = substituteIds.size;

  return (
    <div style={cardStyle}>
      {/* Enable toggle — pill-shaped switch + label/help */}
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        style={{ ...toggleRow, ...(enabled ? toggleRowOn : null) }}
        aria-pressed={enabled}
      >
        <span style={toggleSwitchTrack(enabled)}>
          <span style={toggleSwitchThumb(enabled)} />
        </span>
        <span style={toggleTextBlock}>
          <span style={toggleTitle}>Frequency goal</span>
          <span style={toggleSubtitle}>
            {enabled ? preview : "Off — track this routine without a target"}
          </span>
        </span>
      </button>

      <input type="hidden" name="frequencyTargetEnabled" value={enabled ? "1" : "0"} />

      {enabled ? (
        <>
          {/* Preset chips — quick selection for the common cadences */}
          <div style={presetSection}>
            <div style={sectionLabel}>Quick pick</div>
            <div style={presetRow}>
              {PRESETS.map((p) => {
                const isActive = matchedPresetKey === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{ ...presetChip, ...(isActive ? presetChipActive : null) }}
                    title={p.hint}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  // Bump to a value that doesn't match any preset so the
                  // Custom panel appears.
                  if (!showCustom) {
                    setCount("4");
                    setInterval("1");
                    setUnit("WEEK");
                  }
                }}
                style={{ ...presetChip, ...(showCustom ? presetChipActive : null) }}
              >
                Custom
              </button>
            </div>
          </div>

          {showCustom ? (
            <div style={customSection}>
              <div style={sectionLabel}>Custom target</div>
              <div style={customGrid}>
                <label style={customField}>
                  <span style={customFieldLabel}>Count</span>
                  <input
                    name="targetFrequencyCount"
                    style={inputStyle}
                    inputMode="numeric"
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                  />
                </label>
                <label style={customField}>
                  <span style={customFieldLabel}>Per</span>
                  <input
                    name="targetFrequencyInterval"
                    style={inputStyle}
                    inputMode="numeric"
                    value={interval}
                    onChange={(event) => setInterval(event.target.value)}
                  />
                </label>
                <label style={customField}>
                  <span style={customFieldLabel}>Unit</span>
                  <select
                    name="targetFrequencyUnit"
                    style={inputStyle}
                    value={unit}
                    onChange={(event) => setUnit(event.target.value as RoutineFrequencyUnit)}
                  >
                    <option value="DAY">day(s)</option>
                    <option value="WEEK">week(s)</option>
                    <option value="MONTH">month(s)</option>
                  </select>
                </label>
              </div>
            </div>
          ) : (
            // Hidden inputs for non-custom presets so the form serializes
            // the correct values without the user seeing the raw fields.
            <>
              <input type="hidden" name="targetFrequencyCount" value={count} />
              <input type="hidden" name="targetFrequencyInterval" value={interval} />
              <input type="hidden" name="targetFrequencyUnit" value={unit} />
            </>
          )}

          {availableSubstituteRoutines.length > 0 ? (
            <div style={substitutesBlock}>
              <div style={substitutesHeader}>
                <span style={sectionLabel}>Covered by</span>
                {substituteCount > 0 ? (
                  <span style={countBadge}>
                    {substituteCount} selected
                  </span>
                ) : null}
              </div>
              <div style={substitutesHint}>
                Other routines that satisfy this goal. On a day when only one of these is logged,
                the slot renders as <strong style={coveredHighlight}>covered</strong> instead of missed —
                streak keeps going.
              </div>
              <div style={substitutesGrid}>
                {availableSubstituteRoutines.map((r) => {
                  const checked = substituteIds.has(r.id);
                  return (
                    <label
                      key={r.id}
                      style={{ ...substituteCard, ...(checked ? substituteCardChecked : null) }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSubstituteIds((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                          });
                        }}
                        style={hiddenCheckbox}
                      />
                      <span style={substituteCheckMark(checked)} aria-hidden>
                        {checked ? "✓" : ""}
                      </span>
                      <span style={substituteCardName}>{r.name}</span>
                      {checked ? (
                        <input type="hidden" name="substituteRoutineId" value={r.id} />
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ───────────────────────── styles

const cardStyle: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(128,128,128,0.04)",
  display: "grid",
  gap: 14,
};

const toggleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.22)",
  background: "rgba(255,255,255,0.02)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
  color: "inherit",
  textAlign: "left",
  width: "100%",
};

const toggleRowOn: CSSProperties = {
  borderColor: "rgba(74,222,128,0.45)",
  background: "rgba(74,222,128,0.06)",
};

function toggleSwitchTrack(on: boolean): CSSProperties {
  return {
    position: "relative",
    width: 36,
    height: 22,
    borderRadius: 999,
    background: on ? "rgba(74,222,128,0.45)" : "rgba(128,128,128,0.35)",
    transition: "background 140ms ease",
    flexShrink: 0,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  };
}

function toggleSwitchThumb(on: boolean): CSSProperties {
  return {
    position: "absolute",
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "#ffffff",
    transform: on ? "translateX(14px)" : "translateX(0)",
    transition: "transform 140ms ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  };
}

const toggleTextBlock: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const toggleTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const toggleSubtitle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  lineHeight: 1.35,
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const presetSection: CSSProperties = {
  display: "grid",
  gap: 8,
};

const presetRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const presetChip: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(128,128,128,0.32)",
  background: "rgba(255,255,255,0.025)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const presetChipActive: CSSProperties = {
  borderColor: "rgba(132,204,255,0.6)",
  background: "rgba(132,204,255,0.16)",
  color: "rgba(199,228,255,1)",
  fontWeight: 900,
};

const customSection: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px dashed rgba(132,204,255,0.28)",
  background: "rgba(132,204,255,0.03)",
};

const customGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
  gap: 8,
};

const customField: CSSProperties = {
  display: "grid",
  gap: 4,
};

const customFieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.65,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.55)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16, // dodge iOS auto-zoom
  fontWeight: 700,
  fontFamily: "inherit",
};

const substitutesBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(132,204,255,0.32)",
  background: "rgba(132,204,255,0.04)",
};

const substitutesHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const countBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(132,204,255,0.16)",
  border: "1px solid rgba(132,204,255,0.45)",
  color: "rgba(199,228,255,1)",
};

const substitutesHint: CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
  lineHeight: 1.4,
};

const coveredHighlight: CSSProperties = {
  color: "rgba(132,204,255,1)",
  fontWeight: 800,
};

const substitutesGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 6,
  maxHeight: 240,
  overflowY: "auto",
};

const substituteCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.3)",
  background: "rgba(255,255,255,0.018)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const substituteCardChecked: CSSProperties = {
  borderColor: "rgba(132,204,255,0.55)",
  background: "rgba(132,204,255,0.08)",
};

const hiddenCheckbox: CSSProperties = {
  position: "absolute",
  width: 0,
  height: 0,
  opacity: 0,
  pointerEvents: "none",
};

function substituteCheckMark(checked: boolean): CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: 5,
    border: checked
      ? "1.5px solid rgba(132,204,255,0.85)"
      : "1.5px solid rgba(128,128,128,0.5)",
    background: checked ? "rgba(132,204,255,0.18)" : "transparent",
    color: "rgba(199,228,255,1)",
    fontSize: 12,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

const substituteCardName: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
