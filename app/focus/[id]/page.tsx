// Focus detail page — the roadmap view. Server component fetches the focus
// with its milestones grouped into tracks; the client child handles the
// mark-met / reopen interactions.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getFocusDetail, getInjuryPanelData, seasonPhaseLabel } from "@/app/focus/data";
import { formatUtcDateLabel } from "@/lib/dates";
import FocusRoadmap from "./FocusRoadmap";
import InjuryPanel from "./InjuryPanel";
import FocusTimeline from "./FocusTimeline";

export const dynamic = "force-dynamic";

export default async function FocusDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const focus = await getFocusDetail(id);
  if (!focus) notFound();

  // Injury-linked focuses show the pain trend (the honest, tissue-gated
  // signal) instead of a naive duration projection.
  const injury = focus.linkedInjuryId ? await getInjuryPanelData(focus.linkedInjuryId) : null;

  const accent = focus.color?.trim() || "#33ff7a";
  const pct = focus.milestonesTotal > 0
    ? Math.round((focus.milestonesDone / focus.milestonesTotal) * 100)
    : 0;

  return (
    <main style={page} className="focusDetail">
      <div style={topBar}>
        <Link href="/" style={backLink}>← Home</Link>
        <Link href={`/focus/${focus.id}/edit`} style={editLink}>Edit</Link>
      </div>

      <header style={header}>
        <div style={titleRow}>
          {focus.icon ? <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{focus.icon}</span> : null}
          <h1 style={title}>{focus.name}</h1>
        </div>
        {seasonPhaseLabel(focus.season, focus.phase) || focus.handoffNote ? (
          <div style={seasonRow}>
            {seasonPhaseLabel(focus.season, focus.phase) ? (
              <span style={{ ...seasonChipD, color: accent, borderColor: `${accent}66` }}>
                {seasonPhaseLabel(focus.season, focus.phase)}
              </span>
            ) : null}
            {focus.handoffNote ? <span style={handoff}>{focus.handoffNote}</span> : null}
          </div>
        ) : null}
        {focus.description ? <p style={desc}>{focus.description}</p> : null}
        {focus.milestonesTotal > 0 ? (
          <div style={progressWrap}>
            <div style={progressTrack} aria-hidden>
              <div style={{ ...progressFill, width: `${pct}%`, background: accent }} />
            </div>
            <span style={{ ...progressLabel, color: accent }}>
              {focus.milestonesDone}/{focus.milestonesTotal} milestones
            </span>
          </div>
        ) : null}

        {injury ? <InjuryPanel injury={injury} /> : <ProjectionBanner p={focus.projection} />}
      </header>

      <FocusRoadmap tracks={focus.tracks} accent={accent} />

      {/* Timeline chart — the whole plan as bands over time. Only for
          effort-driven (non-injury) focuses, where the projection is honest. */}
      {!injury ? (
        <FocusTimeline
          tracks={focus.tracks}
          todayYmd={focus.todayYmd}
          targetYmd={focus.projection.targetYmd}
          projectedEndYmd={focus.projection.projectedCompletionYmd}
          accent={accent}
        />
      ) : null}

      <style>{`
        .focusDetail { --edge: clamp(14px, 4vw, 28px); }
        @media (max-width: 720px) { .focusDetail { --edge: 14px; } }
      `}</style>
    </main>
  );
}

const page = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "16px var(--edge) 80px",
  display: "grid",
  gap: 18,
} as const;

const topBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
} as const;

const backLink = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.6)",
  textDecoration: "none",
} as const;

const editLink = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.72)",
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
} as const;

// Projection banner — translates the roadmap forecast into one plain-language
// line + a status chip. Renders nothing when there's nothing to say (no target
// and no active milestones).
function ProjectionBanner({ p }: { p: import("@/app/focus/data").FocusDetail["projection"] }) {
  if (p.status === "no_target" && !p.projectedCompletionYmd) return null;

  const fmt = (ymd: string) => formatUtcDateLabel(ymd, { month: "short", day: "numeric" });
  const tone =
    p.status === "behind" ? { bg: "rgba(248,113,113,0.1)", bd: "rgba(248,113,113,0.4)", fg: "#fca5a5" }
    : p.status === "ahead" || p.status === "done" ? { bg: "rgba(51,255,122,0.1)", bd: "rgba(51,255,122,0.4)", fg: "#7ce8aa" }
    : { bg: "rgba(96,165,250,0.1)", bd: "rgba(96,165,250,0.4)", fg: "#bfdbfe" };

  let chip = "";
  let detail = "";
  if (p.status === "done") {
    chip = "Complete"; detail = "All milestones done 🎉";
  } else if (p.status === "behind" && p.projectedCompletionYmd && p.targetYmd) {
    chip = `${p.driftDays}d behind`;
    detail = `Projected ${fmt(p.projectedCompletionYmd)} vs ${p.targetKind === "HARD" ? "fixed " : ""}target ${fmt(p.targetYmd)}`;
  } else if (p.status === "ahead" && p.projectedCompletionYmd && p.targetYmd) {
    chip = `${Math.abs(p.driftDays ?? 0)}d ahead`;
    detail = `Projected ${fmt(p.projectedCompletionYmd)} · target ${fmt(p.targetYmd)}`;
  } else if (p.status === "on_track" && p.projectedCompletionYmd && p.targetYmd) {
    chip = "On track";
    detail = `Projected ${fmt(p.projectedCompletionYmd)} · target ${fmt(p.targetYmd)}`;
  } else if (p.projectedCompletionYmd) {
    chip = "Projected";
    detail = `Finishes around ${fmt(p.projectedCompletionYmd)}`;
  }

  return (
    <div style={{ ...banner, background: tone.bg, borderColor: tone.bd }}>
      <span style={{ ...bannerChip, color: tone.fg, borderColor: tone.bd }}>{chip}</span>
      <span style={bannerText}>{detail}</span>
    </div>
  );
}

const banner = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 11,
  border: "1px solid",
  flexWrap: "wrap",
} as const;

const bannerChip = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.3,
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid",
  flexShrink: 0,
} as const;

const bannerText = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.72)",
} as const;

const header = { display: "grid", gap: 10 } as const;

const titleRow = { display: "flex", alignItems: "center", gap: 10 } as const;

const seasonRow = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } as const;

const seasonChipD = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "3px 10px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(255,255,255,0.03)",
} as const;

const handoff = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
} as const;

const title = {
  fontSize: 22,
  fontWeight: 900,
  margin: 0,
  color: "rgba(255,255,255,0.95)",
  lineHeight: 1.15,
} as const;

const desc = {
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.66)",
  margin: 0,
} as const;

const progressWrap = { display: "flex", alignItems: "center", gap: 10 } as const;

const progressTrack = {
  flex: 1,
  height: 7,
  borderRadius: 999,
  background: "rgba(255,255,255,0.09)",
  overflow: "hidden",
} as const;

const progressFill = { height: "100%", borderRadius: 999, transition: "width 240ms ease" } as const;

const progressLabel = { fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" } as const;
