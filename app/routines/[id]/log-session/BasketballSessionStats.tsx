"use client";

// Basketball-specific render of session metrics. Replaces the generic
// SessionMetricFields grid for basketball-pickup / basketball-shooting so
// the inputs reflect how basketball is actually scored:
//   - Made / Attempted shown as a paired field with live FG% under it
//   - Big tappable number inputs (good on a phone after a session)
//   - Game stats (W-L, points) grouped distinctly from shooting stats
//
// Designed to be a drop-in alternative to SessionMetricFields — it takes
// the same definitions / values / onChange shape so the parent form
// doesn't need to know which one it's rendering beyond the templateKey.

import type { SessionMetricDefinitionWithConfig } from "@/lib/session-templates";
import type { SessionMetricDraftValue } from "./SessionMetricFields";

type Props = {
  templateKey: "basketball-pickup" | "basketball-shooting";
  definitions: SessionMetricDefinitionWithConfig[];
  values: Record<string, SessionMetricDraftValue>;
  onChange: (metricDefinitionId: string, value: SessionMetricDraftValue) => void;
};

export default function BasketballSessionStats({ templateKey, definitions, values, onChange }: Props) {
  // Build a key → definition map so we can pull individual metrics by
  // stable seed-defined keys, regardless of the order the API returns
  // them in.
  const byKey = new Map(definitions.map((d) => [d.key, d]));

  if (templateKey === "basketball-shooting") {
    return (
      <div style={sectionStyle}>
        <div style={headerRow}>
          <span style={emoji}>🏀</span>
          <span style={sectionTitle}>Shot tracker</span>
        </div>

        <ShotPairCard
          label="Field goals"
          madeDef={byKey.get("shots_made")}
          attemptedDef={byKey.get("shots_attempted")}
          values={values}
          onChange={onChange}
        />

        <div style={singleStatRow}>
          <SingleStat label="3PT made" def={byKey.get("three_pt_made")} values={values} onChange={onChange} accent="green" />
          <SingleStat label="FT made" def={byKey.get("free_throws_made")} values={values} onChange={onChange} accent="orange" />
        </div>

        <ExtraMetrics definitions={definitions} values={values} onChange={onChange} skipKeys={SHOOTING_HANDLED_KEYS} />
      </div>
    );
  }

  // basketball-pickup
  const gamesDef = byKey.get("games_played");
  const winsDef = byKey.get("wins");
  const games = parseIntOrNull(values[gamesDef?.id ?? ""]?.numberValue);
  const wins = parseIntOrNull(values[winsDef?.id ?? ""]?.numberValue);
  const losses = games != null && wins != null ? Math.max(0, games - wins) : null;
  const winPct = games != null && wins != null && games > 0 ? Math.round((wins / games) * 100) : null;

  return (
    <div style={sectionStyle}>
      <div style={headerRow}>
        <span style={emoji}>🏀</span>
        <span style={sectionTitle}>Pickup game</span>
      </div>

      <div style={singleStatRow}>
        <SingleStat label="Games" def={gamesDef} values={values} onChange={onChange} accent="blue" />
        <SingleStat label="Wins" def={winsDef} values={values} onChange={onChange} accent="green" />
      </div>

      {losses != null && winPct != null ? (
        <div style={derivedStrip}>
          <span style={derivedKey}>Record</span>
          <span style={derivedValue}>{wins}–{losses}</span>
          <span style={derivedSep}>·</span>
          <span style={derivedKey}>Win rate</span>
          <span style={derivedValue}>{winPct}%</span>
        </div>
      ) : null}

      <div style={singleStatRow}>
        <SingleStat label="Points scored" def={byKey.get("points_scored")} values={values} onChange={onChange} accent="orange" wide />
      </div>

      <ExtraMetrics definitions={definitions} values={values} onChange={onChange} skipKeys={PICKUP_HANDLED_KEYS} />
    </div>
  );
}

const SHOOTING_HANDLED_KEYS = new Set(["shots_made", "shots_attempted", "three_pt_made", "free_throws_made"]);
const PICKUP_HANDLED_KEYS = new Set(["games_played", "wins", "points_scored"]);

function ShotPairCard({
  label,
  madeDef,
  attemptedDef,
  values,
  onChange,
}: {
  label: string;
  madeDef: SessionMetricDefinitionWithConfig | undefined;
  attemptedDef: SessionMetricDefinitionWithConfig | undefined;
  values: Record<string, SessionMetricDraftValue>;
  onChange: (id: string, v: SessionMetricDraftValue) => void;
}) {
  if (!madeDef || !attemptedDef) return null;
  const made = parseIntOrNull(values[madeDef.id]?.numberValue);
  const attempted = parseIntOrNull(values[attemptedDef.id]?.numberValue);
  const fgPct = made != null && attempted != null && attempted > 0
    ? Math.round((made / attempted) * 1000) / 10
    : null;

  return (
    <div style={shotCard}>
      <div style={shotLabel}>{label}</div>
      <div style={shotPairRow}>
        <NumberCell
          value={values[madeDef.id]?.numberValue ?? ""}
          onChange={(v) => onChange(madeDef.id, { numberValue: v })}
          subLabel="Made"
          accent="green"
        />
        <span style={pairSep}>/</span>
        <NumberCell
          value={values[attemptedDef.id]?.numberValue ?? ""}
          onChange={(v) => onChange(attemptedDef.id, { numberValue: v })}
          subLabel="Attempted"
          accent="neutral"
        />
        <div style={fgPill(fgPct != null)}>
          <span style={fgPillLabel}>FG%</span>
          <span style={fgPillValue}>{fgPct != null ? `${fgPct.toFixed(1)}` : "—"}</span>
        </div>
      </div>
    </div>
  );
}

function SingleStat({
  label,
  def,
  values,
  onChange,
  accent,
  wide,
}: {
  label: string;
  def: SessionMetricDefinitionWithConfig | undefined;
  values: Record<string, SessionMetricDraftValue>;
  onChange: (id: string, v: SessionMetricDraftValue) => void;
  accent: "blue" | "green" | "orange" | "neutral";
  wide?: boolean;
}) {
  if (!def) return null;
  return (
    <div style={{ ...statCardBase, flex: wide ? "1 1 100%" : "1 1 calc(50% - 5px)" }}>
      <NumberCell
        value={values[def.id]?.numberValue ?? ""}
        onChange={(v) => onChange(def.id, { numberValue: v })}
        subLabel={label}
        accent={accent}
        large
      />
    </div>
  );
}

function NumberCell({
  value,
  onChange,
  subLabel,
  accent,
  large,
}: {
  value: string;
  onChange: (v: string) => void;
  subLabel: string;
  accent: "blue" | "green" | "orange" | "neutral";
  large?: boolean;
}) {
  return (
    <label style={numberCellWrap}>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...numberInputStyle, ...(large ? numberInputLarge : null), ...accentBorder(accent) }}
        placeholder="0"
      />
      <span style={{ ...numberSubLabel, color: accentColor(accent) }}>{subLabel}</span>
    </label>
  );
}

function ExtraMetrics({
  definitions,
  values,
  onChange,
  skipKeys,
}: {
  definitions: SessionMetricDefinitionWithConfig[];
  values: Record<string, SessionMetricDraftValue>;
  onChange: (id: string, v: SessionMetricDraftValue) => void;
  skipKeys: Set<string>;
}) {
  // Anything outside the basketball-specific layout that isn't already
  // handled elsewhere (template_notes, location, climbing rows) renders
  // as a fallback single field so seed-time additions don't silently
  // disappear from the form.
  const extras = definitions.filter(
    (d) =>
      !skipKeys.has(d.key) &&
      d.key !== "template_notes" &&
      !(d.config?.gradeBucket && d.config?.climbingColumn)
  );
  if (extras.length === 0) return null;
  return (
    <div style={extrasStrip}>
      {extras.map((def) => (
        <label key={def.id} style={extraFieldStyle}>
          <span style={extraLabelStyle}>{def.unit ? `${def.label} (${def.unit})` : def.label}</span>
          <input
            inputMode={def.valueType === "DECIMAL" ? "decimal" : def.valueType === "INTEGER" ? "numeric" : undefined}
            value={values[def.id]?.numberValue ?? values[def.id]?.textValue ?? ""}
            onChange={(e) => {
              const next = def.valueType === "TEXT" ? { textValue: e.target.value } : { numberValue: e.target.value };
              onChange(def.id, next);
            }}
            style={extraInputStyle}
          />
        </label>
      ))}
    </div>
  );
}

function parseIntOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ── Styles ────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(251,146,60,0.3)",
  borderRadius: 14,
  padding: 14,
  background: "linear-gradient(180deg, rgba(251,146,60,0.08), rgba(251,146,60,0.02))",
  display: "grid",
  gap: 12,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const emoji: React.CSSProperties = {
  fontSize: 20,
  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.92)",
};

const shotCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.32)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(20,24,32,0.5)",
  display: "grid",
  gap: 10,
};

const shotLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.7,
};

const shotPairRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const pairSep: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  opacity: 0.4,
  paddingBottom: 18,
};

const singleStatRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statCardBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const numberCellWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
  flex: 1,
  minWidth: 0,
};

const numberInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 22,
  fontWeight: 900,
  textAlign: "center",
  border: "1.5px solid rgba(128,128,128,0.45)",
  borderRadius: 10,
  background: "rgba(15,18,24,0.65)",
  color: "#ffffff",
  outline: "none",
};

const numberInputLarge: React.CSSProperties = {
  fontSize: 26,
  padding: "12px 12px",
};

const numberSubLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  textAlign: "center",
  opacity: 0.88,
};

const fgPill: (active: boolean) => React.CSSProperties = (active) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 72,
  padding: "6px 12px",
  borderRadius: 999,
  border: `1px solid ${active ? "rgba(74,222,128,0.55)" : "rgba(128,128,128,0.32)"}`,
  background: active ? "rgba(74,222,128,0.12)" : "rgba(128,128,128,0.08)",
  alignSelf: "stretch",
});

const fgPillLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.7,
};

const fgPillValue: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
};

const derivedStrip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(74,222,128,0.08)",
  border: "1px solid rgba(74,222,128,0.22)",
  fontSize: 12,
  flexWrap: "wrap",
};

const derivedKey: React.CSSProperties = {
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  fontSize: 10,
  opacity: 0.78,
};

const derivedValue: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
};

const derivedSep: React.CSSProperties = {
  opacity: 0.4,
};

const extrasStrip: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  marginTop: 2,
};

const extraFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
};

const extraLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  opacity: 0.8,
};

const extraInputStyle: React.CSSProperties = {
  width: "100%",
  padding: 9,
  border: "1px solid rgba(128,128,128,0.45)",
  borderRadius: 9,
  background: "rgba(15,18,24,0.55)",
  color: "#ffffff",
  fontSize: 14,
};

function accentColor(accent: "blue" | "green" | "orange" | "neutral"): string {
  if (accent === "blue") return "rgba(132,204,255,0.95)";
  if (accent === "green") return "rgba(74,222,128,0.95)";
  if (accent === "orange") return "rgba(251,146,60,0.95)";
  return "rgba(255,255,255,0.78)";
}

function accentBorder(accent: "blue" | "green" | "orange" | "neutral"): React.CSSProperties {
  if (accent === "neutral") return {};
  return { borderColor: accentColor(accent).replace(/0\.95\)$/, "0.55)") };
}
