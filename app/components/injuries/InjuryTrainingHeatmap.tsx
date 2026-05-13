"use client";

// Heatmap of training load on the muscle groups affected by this injury.
// Visually mirrors the dashboard movement-patterns heatmap (rows × weeks),
// but each row toggles open to show the routine logs that contributed.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { COLOR, RADIUS } from "@/lib/design-tokens";
import type { InjuryHeatmapCategory, InjuryHeatmapData } from "@/app/injuries/[id]/training-heatmap";

const KIND_COLOR: Record<string, string> = {
  WORKOUT: "#60A5FA",
  CARDIO: "#A78BFA",
  GUIDED: "#34D399",
  SESSION: "#FBBF24",
  COMPLETION: "#9CA3AF",
};

const KIND_LABEL: Record<string, string> = {
  WORKOUT: "Workout",
  CARDIO: "Cardio",
  GUIDED: "Guided",
  SESSION: "Session",
  COMPLETION: "Completion",
};

export default function InjuryTrainingHeatmap({ data }: { data: InjuryHeatmapData }) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  if (data.categories.length === 0) {
    return (
      <div style={{ fontSize: 13, color: COLOR.textDim, lineHeight: 1.45 }}>
        These zones aren&rsquo;t mapped to a muscle group, so there&rsquo;s nothing to count here.
      </div>
    );
  }

  // Global peak for consistent color scaling across rows.
  const globalPeak = Math.max(1, ...data.categories.flatMap((c) => c.weeks));

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {/* Date axis (top) */}
      <div style={headerRow}>
        <div style={labelCol} />
        <div style={weeksCol}>
          {data.weekStarts.map((ws, i) => (
            <span key={ws} style={{ ...weekHeaderCell, ...(i === data.weekStarts.length - 1 ? weekHeaderCurrent : null) }}>
              {weekShort(ws)}
            </span>
          ))}
        </div>
        <div style={totalLabel}>recent</div>
      </div>

      {data.categories.map((category) => {
        const isExpanded = expandedSlug === category.slug;
        return (
          <div key={category.slug} style={{ display: "grid", gap: 6 }}>
            <button
              type="button"
              onClick={() => setExpandedSlug(isExpanded ? null : category.slug)}
              style={{ ...rowButton, ...(isExpanded ? rowButtonExpanded : null) }}
              aria-expanded={isExpanded}
            >
              <div style={labelCol}>
                <span style={{ ...patternStatusDot, background: accentFor(category) }} />
                <span style={patternName}>{category.label}</span>
              </div>
              <div style={weeksCol}>
                {category.weeks.map((count, i) => (
                  <span
                    key={i}
                    style={heatmapCell(count, globalPeak, accentFor(category))}
                    title={`${category.label}: ${count} session${count === 1 ? "" : "s"} · week of ${data.weekStarts[i]}`}
                  >
                    {count > 0 ? count : ""}
                  </span>
                ))}
              </div>
              <div style={totalCol}>
                <span style={totalValue}>{category.recentCount}</span>
                <span style={totalSub}>/4w</span>
              </div>
            </button>

            {isExpanded && (
              <div style={expandedPanel}>
                {category.contributingLogs.length === 0 ? (
                  <div style={emptyLogs}>No sessions on this muscle group in the last 12 weeks.</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {category.contributingLogs.slice(0, 20).map((log) => (
                      <Link
                        key={log.logId}
                        href={`/routines/${log.routineId}/logs/${log.logId}`}
                        style={logRow}
                      >
                        <span style={{ ...kindPill, background: tintAccent(KIND_COLOR[log.routineKind] ?? KIND_COLOR.SESSION, 0.16), borderColor: tintAccent(KIND_COLOR[log.routineKind] ?? KIND_COLOR.SESSION, 0.45), color: KIND_COLOR[log.routineKind] ?? COLOR.text }}>
                          {KIND_LABEL[log.routineKind] ?? log.routineKind.toLowerCase()}
                        </span>
                        <span style={logName}>{log.routineName}</span>
                        {log.relevantParts.length > 0 && (
                          <span style={logHint}>{log.relevantParts[0]}</span>
                        )}
                        <span style={logDate}>{log.performedAtLabel}</span>
                      </Link>
                    ))}
                    {category.contributingLogs.length > 20 && (
                      <div style={moreNote}>
                        + {category.contributingLogs.length - 20} more session{category.contributingLogs.length - 20 === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function weekShort(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function accentFor(category: InjuryHeatmapCategory): string {
  // Hot (red) if recent load is heavy, amber if moderate, faint if light.
  // The signal here is "this muscle keeps getting worked while injured" —
  // not a goodness signal like the dashboard's pattern card.
  if (category.recentCount >= 6) return "rgba(248,113,113,0.95)";
  if (category.recentCount >= 3) return "rgba(251,191,36,0.95)";
  if (category.recentCount >= 1) return "rgba(132,204,255,0.85)";
  return "rgba(255,255,255,0.4)";
}

function heatmapCell(count: number, peak: number, accent: string): CSSProperties {
  const intensity = peak > 0 ? Math.min(1, count / peak) : 0;
  const alpha = count === 0 ? 0.04 : 0.12 + 0.78 * intensity;
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 4,
    background: count === 0 ? "rgba(255,255,255,0.04)" : tintAccent(accent, alpha),
    color: count === 0 ? "transparent" : intensity > 0.55 ? "#0b1220" : COLOR.text,
    fontSize: 10.5,
    fontWeight: 800,
    border: count === 0 ? `1px solid rgba(255,255,255,0.04)` : `1px solid ${tintAccent(accent, 0.45)}`,
  };
}

function tintAccent(rgba: string, alpha: number): string {
  const match = rgba.match(/rgba\(([^)]+)\)/);
  if (!match) return rgba;
  const [r, g, b] = match[1].split(",").slice(0, 3).map((s) => Number(s.trim()));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const headerRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(110px, 150px) 1fr 56px",
  gap: 10,
  alignItems: "center",
  paddingBottom: 4,
};

const labelCol: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const weeksCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
  gap: 3,
};

const weekHeaderCell: CSSProperties = {
  textAlign: "center",
  fontSize: 9,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const weekHeaderCurrent: CSSProperties = {
  color: COLOR.text,
  fontWeight: 800,
};

const totalLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  textAlign: "right",
};

const rowButton: CSSProperties = {
  appearance: "none",
  margin: 0,
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(110px, 150px) 1fr 56px",
  gap: 10,
  alignItems: "center",
  padding: "6px 8px",
  borderRadius: RADIUS.inner,
  border: `1px solid transparent`,
  background: "transparent",
  transition: "background 120ms, border-color 120ms",
};

const rowButtonExpanded: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderColor: COLOR.border,
};

const patternStatusDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const patternName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const totalCol: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  gap: 3,
};

const totalValue: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: COLOR.text,
};

const totalSub: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const expandedPanel: CSSProperties = {
  padding: "8px 10px 10px",
  borderRadius: RADIUS.inner,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${COLOR.border}`,
};

const emptyLogs: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  fontStyle: "italic",
};

const logRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto",
  gap: 8,
  alignItems: "center",
  padding: "6px 8px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${COLOR.border}`,
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  minWidth: 0,
};

const kindPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  border: "1px solid",
  letterSpacing: 0.3,
};

const logName: CSSProperties = {
  fontWeight: 800,
  color: COLOR.text,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const logHint: CSSProperties = {
  fontSize: 11,
  color: COLOR.textDim,
  fontWeight: 600,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 220,
};

const logDate: CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const moreNote: CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  fontStyle: "italic",
  textAlign: "center",
  padding: "4px 0",
};
