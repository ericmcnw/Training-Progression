import type { CSSProperties } from "react";
import { climbOutcomeColor, ORDERED_OUTCOMES } from "@/lib/climb-types";
import { formatHoursMinutes } from "@/lib/progress";
import type { PyramidRow } from "@/lib/climb-stats";
import type { Drilldowns } from "@/lib/reports/drilldown";
import { fmtVolume, panel, panelHeader } from "./_ui";

// Per-domain breakdown. Native <details> so it collapses with zero client JS
// and is forced open in print (see ReportShell's print CSS). Returns null when
// the window has no drillable domains.
export default function DrilldownSections({ drills }: { drills: Drilldowns }) {
  const has = drills.climb || drills.endurance || drills.strength || drills.sport;
  if (!has) return null;

  return (
    <section style={panel}>
      <div style={panelHeader}>BREAKDOWN</div>
      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        {drills.climb && (
          <Drawer
            summary={`Climbing — ${drills.climb.sends} send${drills.climb.sends === 1 ? "" : "s"}${
              drills.climb.hardestBoulder ? ` · ${drills.climb.hardestBoulder} boulder` : ""
            }${drills.climb.hardestRope ? ` · ${drills.climb.hardestRope} rope` : ""}`}
          >
            <Pyramid title="Boulder" rows={drills.climb.pyramid.boulderRows} />
            <Pyramid title="Rope" rows={drills.climb.pyramid.yosemiteRows} />
          </Drawer>
        )}

        {drills.endurance && (
          <Drawer summary={`Endurance — ${drills.endurance.families.length} ${drills.endurance.families.length === 1 ? "family" : "families"}`}>
            <div style={{ display: "grid", gap: 4 }}>
              {drills.endurance.families.map((f) => (
                <div key={f.slug} style={lineRow}>
                  <span style={lineName}>{f.name}</span>
                  <span style={lineMeta}>
                    {f.sessions}× {f.miles > 0 ? `· ${f.miles.toFixed(1)} mi ` : ""}
                    {f.sec > 0 ? `· ${formatHoursMinutes(f.sec)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </Drawer>
        )}

        {drills.strength && (
          <Drawer summary={`Strength — top ${drills.strength.topExercises.length} exercise${drills.strength.topExercises.length === 1 ? "" : "s"} by volume`}>
            <div style={{ display: "grid", gap: 4 }}>
              {drills.strength.topExercises.map((e) => (
                <div key={e.name} style={lineRow}>
                  <span style={lineName}>{e.name}</span>
                  <span style={lineMeta}>
                    {e.volume > 0 ? `${fmtVolume(e.volume)} · ` : ""}{e.sets} sets
                  </span>
                </div>
              ))}
            </div>
          </Drawer>
        )}

        {drills.sport && (
          <Drawer summary={`Sport — ${drills.sport.sports.length} ${drills.sport.sports.length === 1 ? "sport" : "sports"}`}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {drills.sport.sports.map((s) => (
                <span key={s.name} style={chip}>{s.name} ×{s.count}</span>
              ))}
            </div>
          </Drawer>
        )}
      </div>
    </section>
  );
}

function Drawer({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details style={drawer}>
      <summary style={drawerSummary}>{summary}</summary>
      <div style={{ padding: "10px 2px 2px", display: "grid", gap: 12 }}>{children}</div>
    </details>
  );
}

function Pyramid({ title, rows }: { title: string; rows: PyramidRow[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.total), 1);
  // Hardest at the top — pyramid reads peak-down.
  const ordered = [...rows].reverse();
  return (
    <div>
      <div style={pyramidTitle}>{title}</div>
      <div style={{ display: "grid", gap: 3 }}>
        {ordered.map((r) => (
          <div key={`${r.system}-${r.grade}`} style={pyramidRow}>
            <span style={pyramidGrade}>{r.grade}</span>
            <div style={pyramidBarTrack}>
              <div style={{ display: "flex", height: "100%", width: `${(r.total / max) * 100}%`, borderRadius: 4, overflow: "hidden" }}>
                {ORDERED_OUTCOMES.map((o) =>
                  (r.counts[o] ?? 0) > 0 ? (
                    <div key={o} title={`${o}: ${r.counts[o]}`} style={{ flex: r.counts[o], background: climbOutcomeColor(o) }} />
                  ) : null
                )}
              </div>
            </div>
            <span style={pyramidCount}>{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────

const drawer: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.02)",
  padding: "10px 12px",
};

const drawerSummary: CSSProperties = {
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.9)",
  listStyle: "none",
};

const lineRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "baseline",
};

const lineName: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.9)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const lineMeta: CSSProperties = { fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" };

const chip: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.85)",
};

const pyramidTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  marginBottom: 6,
};

const pyramidRow: CSSProperties = { display: "grid", gridTemplateColumns: "44px 1fr 24px", alignItems: "center", gap: 8 };
const pyramidGrade: CSSProperties = { fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.85)" };
const pyramidBarTrack: CSSProperties = { height: 12, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" };
const pyramidCount: CSSProperties = { fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)", textAlign: "right" };
