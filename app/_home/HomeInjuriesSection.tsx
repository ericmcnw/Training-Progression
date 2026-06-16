"use client";

// Home injuries section. Collapsed by default: each active injury with its
// most recent pain score + one "Log pain" button (pick an injury or a new
// body part). Expanded: per injury, a pain-trend sparkline + its aggravating
// factors + its own log-pain button. Resting state when nothing's active.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import Popover from "./Popover";
import PainLogSheet from "@/app/body/PainLogSheet";
import type { HomeInjury } from "@/lib/home-injuries";

type ZoneTarget = { slug: string; label: string };

function painColor(level: number | null) {
  if (level == null) return "rgba(255,255,255,0.4)";
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  return "#86EFAC";
}

export default function HomeInjuriesSection({
  injuries,
  factorSuggestions,
  zones,
}: {
  injuries: HomeInjury[];
  factorSuggestions: string[];
  zones: ZoneTarget[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [painZone, setPainZone] = useState<ZoneTarget | null>(null);

  function logFor(zone: ZoneTarget) {
    setChooserOpen(false);
    setPainZone(zone);
  }

  return (
    <section style={card}>
      <div style={headerRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={title}>Injuries</span>
          {injuries.length > 0 ? <span style={countPill}>{injuries.length}</span> : null}
        </div>
        {injuries.length > 0 ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} style={toggleBtn} aria-expanded={expanded}>
            {expanded ? "Hide details" : "Details"}
            <span style={{ ...chevron, transform: expanded ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
          </button>
        ) : null}
      </div>

      {injuries.length === 0 ? (
        <div style={resting}>No active injuries. Nice.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {injuries.map((injury) => (
            <div key={injury.id} style={injuryRow}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Link href={`/injuries/${injury.id}`} style={injuryLink}>
                  <div style={injuryName}>{injury.name} <span style={{ opacity: 0.5, fontWeight: 800 }}>›</span></div>
                  <div style={injurySub}>
                    {injury.zones.map((z) => z.label).join(" · ")}
                    {injury.status === "FLARED" ? " · flared" : ""}
                  </div>
                </Link>
                <div style={{ ...painScore, color: painColor(injury.recentPainScore) }}>
                  {injury.recentPainScore != null ? injury.recentPainScore : "—"}
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.5 }}>/10</span>
                </div>
              </div>

              {expanded ? (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={miniLabel}>Pain trend</div>
                    <PainSparkline trend={injury.painTrend} />
                  </div>
                  {injury.aggravatingFactors.length > 0 ? (
                    <div>
                      <div style={miniLabel}>Aggravated by</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {injury.aggravatingFactors.map((f) => (
                          <span key={f} style={factorChip}>{f}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {injury.zones[0] ? (
                    <button type="button" onClick={() => logFor(injury.zones[0])} style={rowLogBtn}>
                      Log pain · {injury.zones[0].label}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}

          <button type="button" onClick={() => setChooserOpen(true)} style={logPainBtn}>
            + Log pain
          </button>
        </div>
      )}

      {/* Chooser: pick an active injury, or a new body part. */}
      <Popover open={chooserOpen} onClose={() => setChooserOpen(false)} title="Log pain" desktopWidth={400}>
        <div style={{ display: "grid", gap: 14 }}>
          {injuries.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={miniLabel}>An active injury</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {injuries.map((injury) =>
                  injury.zones[0] ? (
                    <button key={injury.id} type="button" onClick={() => logFor(injury.zones[0])} style={chooserChip}>
                      {injury.name}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={miniLabel}>A new body part</div>
            <select
              defaultValue=""
              onChange={(e) => {
                const z = zones.find((zone) => zone.slug === e.target.value);
                if (z) logFor(z);
              }}
              style={selectStyle}
            >
              <option value="">Pick a body part…</option>
              {zones.map((z) => (
                <option key={z.slug} value={z.slug}>{z.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Popover>

      <PainLogSheet zone={painZone} onClose={() => setPainZone(null)} factorSuggestions={factorSuggestions} />
    </section>
  );
}

function painLevelColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  return "#86EFAC";
}

function shortDate(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// Auto-scaled, labeled, tappable pain line — small 1-2 point changes fill the
// height (instead of vanishing on a flat 0-10 bar chart), the latest value is
// called out, and tapping a point reads its exact date + level.
function PainSparkline({ trend }: { trend: HomeInjury["painTrend"] }) {
  const [sel, setSel] = useState<number | null>(null);

  if (trend.length === 0) {
    return <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>No pain logged yet.</div>;
  }
  if (trend.length === 1) {
    const only = trend[0];
    return (
      <div style={{ fontSize: 12.5, fontWeight: 800 }}>
        <span style={{ color: painLevelColor(only.level) }}>{only.level}/10</span>{" "}
        <span style={{ opacity: 0.55, fontWeight: 700 }}>· {shortDate(only.ymd)}</span>
      </div>
    );
  }

  const levels = trend.map((d) => d.level);
  let lo = Math.max(0, Math.min(...levels) - 1);
  let hi = Math.min(10, Math.max(...levels) + 1);
  if (hi - lo < 3) {
    hi = Math.min(10, lo + 3);
    lo = Math.max(0, hi - 3);
  }

  const W = 320;
  const H = 54;
  const padX = 6;
  const padY = 7;
  const x = (i: number) => padX + (i / (trend.length - 1)) * (W - padX * 2);
  const y = (lvl: number) => padY + (1 - (lvl - lo) / (hi - lo)) * (H - padY * 2);
  const line = trend.map((d, i) => `${x(i)},${y(d.level)}`).join(" ");

  const selected = sel != null ? trend[sel] : trend[trend.length - 1];

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 800 }}>
        <span style={{ color: painLevelColor(selected.level) }}>{selected.level}/10</span>{" "}
        <span style={{ opacity: 0.55, fontWeight: 700 }}>· {shortDate(selected.ymd)}{sel == null ? " (latest)" : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)", paddingBlock: 2 }}>
          <span>{hi}</span>
          <span>{lo}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block", overflow: "visible" }} role="img" aria-label="Pain trend">
          {[lo, hi].map((g) => (
            <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          <polyline points={line} fill="none" stroke="rgba(248,113,113,0.7)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {trend.map((d, i) => {
            const isSel = (sel == null ? i === trend.length - 1 : i === sel);
            return (
              <g key={d.ymd}>
                {/* larger invisible hit target for easy tapping */}
                <circle cx={x(i)} cy={y(d.level)} r={11} fill="transparent" style={{ cursor: "pointer" }} onClick={() => setSel(i)} />
                <circle cx={x(i)} cy={y(d.level)} r={isSel ? 4 : 2.5} fill={isSel ? painLevelColor(d.level) : "rgba(248,113,113,0.85)"} stroke={isSel ? "#0b1422" : "none"} strokeWidth={1.5} pointerEvents="none" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.028)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const title: CSSProperties = { fontSize: 15, fontWeight: 900, letterSpacing: 0.2 };

const countPill: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(248,113,113,0.14)",
  border: "1px solid rgba(248,113,113,0.4)",
  color: "#FCA5A5",
};

const toggleBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.6)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 32,
};

const chevron: CSSProperties = { fontSize: 11, transition: "transform 160ms ease" };

const resting: CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.55)",
  fontWeight: 600,
  padding: "4px 2px",
};

const injuryRow: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
};

const injuryLink: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
  textDecoration: "none",
  color: "inherit",
};

const injuryName: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const injurySub: CSSProperties = { fontSize: 11, opacity: 0.6, fontWeight: 700, marginTop: 2 };

const painScore: CSSProperties = { fontSize: 22, fontWeight: 900, lineHeight: 1, flexShrink: 0 };

const miniLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
  marginBottom: 4,
};

const factorChip: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid rgba(251,146,60,0.4)",
  background: "rgba(251,146,60,0.10)",
  color: "#FED7AA",
};

const logPainBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(251,113,133,0.4)",
  background: "rgba(251,113,133,0.10)",
  color: "#FECACA",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  minHeight: 44,
};

const rowLogBtn: CSSProperties = {
  ...logPainBtn,
  fontSize: 12,
  minHeight: 40,
  justifySelf: "start",
  padding: "8px 13px",
};

const chooserChip: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.10)",
  color: "#FCA5A5",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 38,
};

// fontSize 16 — iOS zoom guard.
const selectStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 700,
  minHeight: 46,
  cursor: "pointer",
};
