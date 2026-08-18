// Programs index — the front door the Focus layer never had. One card per
// program answering "what am I running, and how is it actually going": how
// far through the roadmap, what I'm working on right now, whether the target
// is holding, and whether I've actually trained it lately.

import Link from "next/link";
import { getProgramCards, type ProgramCard } from "./data";
import { seasonPhaseLabel } from "@/app/focus/shared";
import { formatUtcDateLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DEFAULT_ACCENT = "#33ff7a";

export default async function ProgramsPage() {
  const programs = await getProgramCards();
  const live = programs.filter((p) => p.status === "ACTIVE" || p.status === "PLANNED");
  const resting = programs.filter((p) => p.status === "PAUSED");
  const finished = programs.filter((p) => p.status === "ACHIEVED" || p.status === "ABANDONED");

  return (
    <main style={page} className="programsPage">
      <div style={topBar}>
        <Link href="/" style={backLink}>← Home</Link>
        <Link href="/programs/new" style={newLink}>+ New program</Link>
      </div>

      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={title}>Programs</h1>
        <p style={subtitle}>
          What you&apos;re training toward. Each one holds a roadmap of milestones and
          the routines that feed it.
        </p>
      </header>

      {programs.length === 0 ? (
        <div style={emptyCard}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>No programs yet</div>
          <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5, margin: 0 }}>
            A program is an objective with a deadline — &ldquo;Fall climbing prep&rdquo;,
            &ldquo;Snowboard ready&rdquo;, &ldquo;Hamstring rehab&rdquo;. Milestones underneath it
            track the path.
          </p>
          <Link href="/programs/new" style={emptyCta}>Create your first program</Link>
        </div>
      ) : (
        <>
          <div style={cardGrid}>
            {live.map((p) => <ProgramCardView key={p.id} program={p} />)}
          </div>

          {resting.length > 0 ? (
            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={groupHeading}>Paused</h2>
              <div style={cardGrid}>
                {resting.map((p) => <ProgramCardView key={p.id} program={p} />)}
              </div>
            </section>
          ) : null}

          {finished.length > 0 ? (
            <details style={shelf}>
              <summary data-collapsible-summary style={shelfSummary}>
                Finished ({finished.length})
              </summary>
              <div style={{ ...cardGrid, paddingTop: 10 }}>
                {finished.map((p) => <ProgramCardView key={p.id} program={p} />)}
              </div>
            </details>
          ) : null}
        </>
      )}

      <style>{`
        .programsPage { --edge: clamp(14px, 4vw, 28px); }
        @media (max-width: 720px) { .programsPage { --edge: 14px; } }
      `}</style>
    </main>
  );
}

function ProgramCardView({ program: p }: { program: ProgramCard }) {
  const accent = p.color?.trim() || DEFAULT_ACCENT;
  const pct = p.milestonesTotal > 0 ? Math.round((p.milestonesDone / p.milestonesTotal) * 100) : 0;
  const season = seasonPhaseLabel(p.season, p.phase);
  const dim = p.status === "ACHIEVED" || p.status === "ABANDONED" || p.status === "PAUSED";

  return (
    <Link
      href={`/programs/${p.id}`}
      style={{ ...card, borderColor: `${accent}33`, opacity: dim ? 0.66 : 1 }}
    >
      <div style={cardHead}>
        {p.icon ? <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{p.icon}</span> : null}
        <span style={cardTitle}>{p.name}</span>
        {p.status !== "ACTIVE" ? <span style={statusChip}>{statusLabel(p.status)}</span> : null}
      </div>

      {season ? <div style={{ ...seasonChip, color: accent, borderColor: `${accent}55` }}>{season}</div> : null}

      {p.milestonesTotal > 0 ? (
        <div style={progressWrap}>
          <div style={progressTrack} aria-hidden>
            <div style={{ ...progressFill, width: `${pct}%`, background: accent }} />
          </div>
          <span style={{ ...progressLabel, color: accent }}>
            {p.milestonesDone}/{p.milestonesTotal}
          </span>
        </div>
      ) : (
        <div style={noRoadmap}>No milestones yet — open it to build the roadmap.</div>
      )}

      {p.currentAims.length > 0 ? (
        <div style={aimsRow}>
          <span style={aimsLabel}>Now</span>
          <span style={aimsText}>{p.currentAims.join(" · ")}</span>
        </div>
      ) : null}

      <div style={chipRow}>
        <StatusChips program={p} />
      </div>
    </Link>
  );
}

// The bottom chip row. Injury-linked programs swap the schedule forecast for
// the pain trend — a tissue-gated timeline isn't honestly forecastable, so
// showing "12d behind" on rehab would be inventing precision.
function StatusChips({ program: p }: { program: ProgramCard }) {
  const chips: Array<{ key: string; text: string; tone: Tone }> = [];

  if (p.pain) {
    chips.push({
      key: "pain",
      text: `Pain ${p.pain.level}/10 · ${agoLabel(p.pain.daysAgo)}`,
      tone: p.pain.level <= 2 ? "good" : p.pain.level <= 4 ? "info" : "warn",
    });
  } else if (p.targetYmd) {
    const when = formatUtcDateLabel(p.targetYmd, { month: "short", day: "numeric" });
    if (p.projectionStatus === "behind" && p.driftDays) {
      chips.push({ key: "target", text: `${when} · ${p.driftDays}d behind`, tone: "warn" });
    } else if (p.projectionStatus === "ahead" && p.driftDays) {
      chips.push({ key: "target", text: `${when} · ${Math.abs(p.driftDays)}d ahead`, tone: "good" });
    } else if (p.projectionStatus === "on_track") {
      chips.push({ key: "target", text: `${when} · on track`, tone: "good" });
    } else {
      chips.push({ key: "target", text: `${p.targetKind === "HARD" ? "🚩 " : ""}${when}`, tone: "info" });
    }
  } else if (p.projectedCompletionYmd) {
    chips.push({
      key: "target",
      text: `~${formatUtcDateLabel(p.projectedCompletionYmd, { month: "short", day: "numeric" })}`,
      tone: "info",
    });
  }

  if (p.activity.sessions > 0) {
    chips.push({
      key: "activity",
      text: `${p.activity.sessions} session${p.activity.sessions === 1 ? "" : "s"}/14d · last ${agoLabel(p.activity.daysSinceLast)}`,
      tone: "info",
    });
  } else if (p.milestonesTotal > 0) {
    chips.push({ key: "activity", text: "No sessions in 14d", tone: "warn" });
  }

  return (
    <>
      {chips.map((c) => (
        <span key={c.key} style={{ ...chip, ...TONES[c.tone] }}>{c.text}</span>
      ))}
    </>
  );
}

function agoLabel(days: number | null): string {
  if (days == null) return "never";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "PLANNED": return "Planned";
    case "PAUSED": return "Paused";
    case "ACHIEVED": return "Achieved";
    case "ABANDONED": return "Dropped";
    default: return status;
  }
}

type Tone = "good" | "warn" | "info";

const TONES: Record<Tone, { color: string; background: string; borderColor: string }> = {
  good: { color: "#7ce8aa", background: "rgba(51,255,122,0.1)", borderColor: "rgba(51,255,122,0.35)" },
  warn: { color: "#fcd34d", background: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.35)" },
  info: { color: "rgba(255,255,255,0.72)", background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.14)" },
};

const page = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "16px var(--edge) 80px",
  display: "grid",
  gap: 18,
} as const;

const topBar = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;

const backLink = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.6)",
  textDecoration: "none",
} as const;

const newLink = {
  fontSize: 12,
  fontWeight: 900,
  color: "#7ce8aa",
  textDecoration: "none",
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.1)",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
} as const;

const title = {
  fontSize: 24,
  fontWeight: 900,
  margin: 0,
  color: "rgba(255,255,255,0.95)",
  lineHeight: 1.15,
} as const;

const subtitle = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.6)",
  margin: 0,
} as const;

const cardGrid = { display: "grid", gap: 12 } as const;

const card = {
  display: "grid",
  gap: 9,
  padding: "14px 15px",
  borderRadius: 14,
  border: "1px solid",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
} as const;

const cardHead = { display: "flex", alignItems: "center", gap: 9, minWidth: 0 } as const;

const cardTitle = {
  fontSize: 15.5,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const statusChip = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.6)",
  flexShrink: 0,
} as const;

const seasonChip = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(255,255,255,0.03)",
  justifySelf: "start",
} as const;

const progressWrap = { display: "flex", alignItems: "center", gap: 10 } as const;

const progressTrack = {
  flex: 1,
  height: 7,
  borderRadius: 999,
  background: "rgba(255,255,255,0.09)",
  overflow: "hidden",
} as const;

const progressFill = { height: "100%", borderRadius: 999 } as const;

const progressLabel = { fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap" } as const;

const noRoadmap = { fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)" } as const;

const aimsRow = { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 } as const;

const aimsLabel = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.38)",
  flexShrink: 0,
} as const;

const aimsText = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.78)",
  lineHeight: 1.4,
  minWidth: 0,
} as const;

const chipRow = { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" } as const;

const chip = {
  fontSize: 10.5,
  fontWeight: 800,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid",
} as const;

const groupHeading = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  margin: 0,
} as const;

const shelf = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "10px 12px",
} as const;

const shelfSummary = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
} as const;

const emptyCard = {
  display: "grid",
  gap: 10,
  padding: "20px 18px",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.02)",
  justifyItems: "start",
} as const;

const emptyCta = {
  fontSize: 13,
  fontWeight: 900,
  color: "#7ce8aa",
  textDecoration: "none",
  padding: "11px 16px",
  borderRadius: 11,
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.1)",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
} as const;
