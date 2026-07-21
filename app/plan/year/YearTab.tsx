// Year view — the seasonal zoom. Every active/planned focus as a colored band
// across a rolling 12-month window: phase label inside the band, a 🚩 flag on
// hard targets, the handoff note at the band's end, a today line, and month
// headers that ZOOM into that month's schedule (`/plan?month=YYYY-MM#schedule`).
// Bands link to the focus detail. Scrolls horizontally in its own container
// (sticky label column) per the wide-content rule.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayAppYmd, toAppYmd, diffYmdDays } from "@/lib/dates";
import { projectRoadmap, type ProjectionInputMilestone } from "@/lib/focus-projection";
import { phaseLabel } from "@/app/focus/data";

const PX_PER_DAY = 1.6;
const LABEL_W = 84;
const LANE_H = 40;

export default async function YearTab() {
  const today = todayAppYmd();

  const focuses = await prisma.focus.findMany({
    where: { status: { in: ["ACTIVE", "PLANNED"] } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, icon: true, color: true, status: true,
      season: true, phase: true, handoffNote: true,
      targetDate: true, targetKind: true, createdAt: true,
    },
  });
  if (focuses.length === 0) {
    return <div style={empty}>No focuses yet — create one from the dashboard to see your year.</div>;
  }

  // Projected completion per focus (for bands with no explicit target).
  const milestones = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "FOCUS", ownerId: { in: focuses.map((f) => f.id) } },
    select: {
      ownerId: true, id: true, scopeKind: true, scopeRef: true, sortOrder: true,
      status: true, estDurationDays: true, dependsOnMilestoneId: true,
    },
  });
  const byFocus = new Map<string, ProjectionInputMilestone[]>();
  for (const m of milestones) {
    const list = byFocus.get(m.ownerId) ?? [];
    list.push({
      id: m.id,
      trackKey: `${m.scopeKind}:${m.scopeRef ?? ""}`,
      sortOrder: m.sortOrder,
      status: m.status,
      estDurationDays: m.estDurationDays,
      dependsOnMilestoneId: m.dependsOnMilestoneId,
    });
    byFocus.set(m.ownerId, list);
  }

  // Rolling window: first of last month → 12 months out.
  const [ty, tm] = today.split("-").map(Number);
  const startY = tm === 1 ? ty - 1 : ty;
  const startM = tm === 1 ? 12 : tm - 1;
  const windowStart = `${startY}-${String(startM).padStart(2, "0")}-01`;
  const months: { ym: string; label: string; day: number }[] = [];
  {
    let y = startY, m = startM;
    for (let i = 0; i < 12; i += 1) {
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      months.push({
        ym: `${y}-${String(m).padStart(2, "0")}`,
        label: new Date(`${first}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        day: diffYmdDays(first, windowStart),
      });
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
  }
  const lastMonth = months[months.length - 1];
  const windowEndYmd = (() => {
    const [y, m] = lastMonth.ym.split("-").map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return `${ny}-${String(nm).padStart(2, "0")}-01`;
  })();
  const totalDays = diffYmdDays(windowEndYmd, windowStart);
  const chartW = Math.round(totalDays * PX_PER_DAY);
  const x = (ymd: string) => Math.round(Math.max(0, Math.min(totalDays, diffYmdDays(ymd, windowStart))) * PX_PER_DAY);
  const todayX = x(today);

  const lanes = focuses.map((f) => {
    const createdYmd = toAppYmd(f.createdAt);
    const targetYmd = f.targetDate ? f.targetDate.toISOString().slice(0, 10) : null;
    let endYmd = targetYmd;
    let ongoing = false;
    if (!endYmd) {
      const proj = projectRoadmap(byFocus.get(f.id) ?? [], today, null);
      endYmd = proj.projectedCompletionYmd;
    }
    if (!endYmd || endYmd > windowEndYmd) {
      endYmd = windowEndYmd;
      ongoing = !targetYmd;
    }
    const startYmd = createdYmd < windowStart ? windowStart : createdYmd;
    return {
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color?.trim() || "#33ff7a",
      startX: x(startYmd),
      endX: Math.max(x(startYmd) + 40, x(endYmd)),
      targetX: targetYmd && targetYmd <= windowEndYmd ? x(targetYmd) : null,
      hardTarget: f.targetKind === "HARD",
      phase: phaseLabel(f.phase),
      season: f.season,
      handoffNote: f.handoffNote,
      ongoing,
    };
  });

  return (
    <div className="yearScroll" style={{ paddingBottom: 4 }}>
      <div style={{ position: "relative", width: chartW + LABEL_W, minWidth: "100%" }}>
        {/* month headers — tap to zoom into that month's schedule */}
        <div style={{ position: "relative", height: 22, marginLeft: LABEL_W }}>
          {months.map((mo) => (
            <Link
              key={mo.ym}
              href={`/plan?month=${mo.ym}#schedule`}
              style={{ ...monthLink, left: Math.round(mo.day * PX_PER_DAY) }}
              title={`Zoom into ${mo.label}`}
            >
              {mo.label}
            </Link>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          {/* gridlines + today */}
          <div style={{ position: "absolute", inset: 0, marginLeft: LABEL_W, pointerEvents: "none" }}>
            {months.map((mo) => (
              <span key={mo.ym} style={{ ...gridLine, left: Math.round(mo.day * PX_PER_DAY) }} />
            ))}
            <span style={{ ...todayLine, left: todayX }} title="Today" />
          </div>

          {lanes.map((lane) => (
            <div key={lane.id} style={laneRow}>
              <div style={laneLabel} title={lane.name}>
                {lane.icon ? <span aria-hidden style={{ marginRight: 4 }}>{lane.icon}</span> : null}
                {lane.name}
              </div>
              <div style={{ position: "relative", height: LANE_H, flex: 1 }}>
                <Link
                  href={`/focus/${lane.id}`}
                  style={{
                    ...band,
                    left: lane.startX,
                    width: lane.endX - lane.startX,
                    background: `${lane.color}22`,
                    borderColor: `${lane.color}88`,
                    color: "rgba(255,255,255,0.9)",
                  }}
                  title={`${lane.name}${lane.season ? ` · ${lane.season}` : ""}${lane.phase ? ` · ${lane.phase}` : ""}${lane.handoffNote ? ` · ${lane.handoffNote}` : ""}`}
                >
                  <span style={bandText}>
                    {lane.phase ?? ""}
                    {lane.ongoing ? " · ongoing →" : ""}
                  </span>
                  {lane.handoffNote && !lane.ongoing ? (
                    <span style={handoffText}>{lane.handoffNote}</span>
                  ) : null}
                </Link>
                {lane.targetX != null ? (
                  <span
                    style={{ ...targetFlag, left: lane.targetX }}
                    title={lane.hardTarget ? "Hard target (world-fixed)" : "Target"}
                    aria-hidden
                  >
                    {lane.hardTarget ? "🚩" : "⚑"}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginLeft: LABEL_W, marginTop: 6, display: "flex", gap: 14, fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
          <span>▏today</span>
          <span>🚩 fixed target</span>
          <span>tap a month to zoom in · tap a band to open the focus</span>
        </div>
      </div>

      <style>{`
        .yearScroll { overflow-x: auto; scrollbar-width: thin; }
        .yearScroll::-webkit-scrollbar { height: 6px; }
        .yearScroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
      `}</style>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const empty = {
  padding: "18px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
  fontWeight: 600,
} as const;

const monthLink = {
  position: "absolute",
  top: 0,
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(255,255,255,0.55)",
  textDecoration: "none",
  padding: "2px 5px",
  borderRadius: 6,
  transform: "translateX(-2px)",
} as const;

const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" } as const;
const todayLine = { position: "absolute", top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.5)" } as const;

const laneRow = { display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)" } as const;

const laneLabel = {
  width: LABEL_W,
  flexShrink: 0,
  paddingRight: 8,
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.82)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const band = {
  position: "absolute",
  top: 6,
  height: LANE_H - 12,
  borderRadius: 8,
  border: "1px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "0 8px",
  textDecoration: "none",
  overflow: "hidden",
  boxSizing: "border-box",
} as const;

const bandText = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
} as const;

const handoffText = {
  fontSize: 10,
  fontWeight: 700,
  color: "rgba(255,255,255,0.6)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

const targetFlag = {
  position: "absolute",
  top: 0,
  fontSize: 12,
  transform: "translateX(-6px)",
  pointerEvents: "none",
} as const;
