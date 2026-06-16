"use client";

// Home injuries section. Collapsed by default: each active injury with its
// most recent pain score + one "Log pain" button (pick an injury or a new
// body part). Expanded: per injury, a pain-trend sparkline + its aggravating
// factors + its own log-pain button. Resting state when nothing's active.

import { useState, type CSSProperties } from "react";
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
                <div style={{ minWidth: 0 }}>
                  <div style={injuryName}>{injury.name}</div>
                  <div style={injurySub}>
                    {injury.zones.map((z) => z.label).join(" · ")}
                    {injury.status === "FLARED" ? " · flared" : ""}
                  </div>
                </div>
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

function PainSparkline({ trend }: { trend: HomeInjury["painTrend"] }) {
  if (trend.length === 0) {
    return <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>No pain logged yet.</div>;
  }
  const h = 28;
  const slot = 8;
  const width = Math.max(trend.length * slot, slot);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {trend.map((d, i) => {
        const barH = Math.max(2, (d.level / 10) * h);
        const color = d.level >= 7 ? "#DC2626" : d.level >= 4 ? "#F87171" : "#FCA5A5";
        return (
          <rect key={d.ymd} x={i * slot + 1} y={h - barH} width={slot - 2} height={barH} fill={color} rx={1}>
            <title>{`${d.ymd}: ${d.level}/10`}</title>
          </rect>
        );
      })}
    </svg>
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
