import Link from "next/link";
import { notFound } from "next/navigation";
import { getFocusDetail, getInjuryPanelData } from "@/app/focus/data";
import { seasonPhaseLabel } from "@/app/focus/shared";
import { getProgramDetailData } from "@/app/programs/detail-data";
import { ProgramOverview, ProgramRoadmap, ProgramProgress } from "@/app/programs/[id]/ProgramDetailViews";

export const dynamic = "force-dynamic";

type View = "overview" | "roadmap" | "progress";

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const requested = (await searchParams)?.view;
  const view: View = requested === "roadmap" || requested === "plan" ? "roadmap" : requested === "progress" ? "progress" : "overview";
  const [focus, detail] = await Promise.all([getFocusDetail(id), getProgramDetailData(id)]);
  if (!focus || !detail) notFound();
  const injury = focus.linkedInjuryId ? await getInjuryPanelData(focus.linkedInjuryId) : null;
  const accent = focus.color?.trim() || "#7ce8aa";
  const progress = focus.milestonesTotal ? Math.round((focus.milestonesDone / focus.milestonesTotal) * 100) : 0;
  const season = seasonPhaseLabel(focus.season, focus.phase);
  const timeline = timelineLabel(detail);

  return (
    <main style={page} className="programDetail">
      <div style={topBar}>
        <Link href="/programs" style={quietLink}>Back to programs</Link>
        <Link href={`/programs/${id}/edit`} style={editLink}>Edit program</Link>
      </div>

      <header style={header}>
        <div style={titleRow}>
          {focus.icon ? <span aria-hidden style={{ fontSize: 24 }}>{focus.icon}</span> : null}
          <div style={{ minWidth: 0 }}>
            <h1 style={title}>{focus.name}</h1>
            <div style={metaRow}>
              {season ? <span style={{ ...accentChip, color: accent, borderColor: `${accent}55` }}>{season}</span> : null}
              {timeline ? <span style={statusChip}>{timeline}</span> : null}
              <span style={statusChip}>{sentenceCase(focus.status)}</span>
            </div>
          </div>
        </div>
        {focus.description ? <p style={description}>{focus.description}</p> : null}
        {focus.milestonesTotal > 0 ? (
          <div style={progressRow}>
            <div style={track}><div style={{ ...fill, width: `${progress}%`, background: accent }} /></div>
            <strong style={{ color: accent, fontSize: 11 }}>{focus.milestonesDone}/{focus.milestonesTotal} milestones</strong>
          </div>
        ) : null}
      </header>

      <nav aria-label="Program view" style={tabs}>
        {(["overview", "roadmap", "progress"] as const).map((tab) => (
          <Link
            key={tab}
            href={`/programs/${id}?view=${tab}`}
            aria-current={view === tab ? "page" : undefined}
            style={{ ...tabLink, ...(view === tab ? { color: "#fff", background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" } : {}) }}
          >
            {tab === "roadmap" ? "Roadmap" : tab === "progress" ? "Progress" : "Overview"}
          </Link>
        ))}
      </nav>

      {view === "overview" ? <ProgramOverview focus={focus} detail={detail} injury={injury} accent={accent} /> : null}
      {view === "roadmap" ? <ProgramRoadmap focus={focus} detail={detail} accent={accent} /> : null}
      {view === "progress" ? <ProgramProgress focus={focus} detail={detail} injury={injury} accent={accent} /> : null}
    </main>
  );
}

function timelineLabel(detail: NonNullable<Awaited<ReturnType<typeof getProgramDetailData>>>) {
  const start = detail.startYmd ? shortDate(detail.startYmd) : null;
  const end = detail.endYmd ? shortDate(detail.endYmd) : detail.reviewYmd ? `Review ${shortDate(detail.reviewYmd)}` : null;
  if (start && end) return `${start} - ${end}`;
  return end ?? start;
}

function shortDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const page: React.CSSProperties = { width: "100%", minWidth: 0, maxWidth: 760, margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const quietLink: React.CSSProperties = { color: "rgba(255,255,255,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const editLink: React.CSSProperties = { ...quietLink, minHeight: 42, display: "inline-flex", alignItems: "center", padding: "0 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" };
const header: React.CSSProperties = { display: "grid", gap: 9, paddingBottom: 4 };
const titleRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10 };
const title: React.CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 900, overflowWrap: "anywhere" };
const metaRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" };
const accentChip: React.CSSProperties = { padding: "3px 8px", borderRadius: 99, border: "1px solid", fontSize: 9.5, fontWeight: 900, textTransform: "uppercase" };
const statusChip: React.CSSProperties = { ...accentChip, color: "rgba(255,255,255,0.55)", borderColor: "rgba(255,255,255,0.14)" };
const description: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.64)" };
const progressRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const track: React.CSSProperties = { height: 7, flex: 1, borderRadius: 99, background: "rgba(255,255,255,0.09)", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 99 };
const tabs: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", borderRadius: 8, background: "rgba(255,255,255,0.025)" };
const tabLink: React.CSSProperties = { minHeight: 40, display: "grid", placeItems: "center", borderRadius: 6, borderWidth: 1, borderStyle: "solid", borderColor: "transparent", color: "rgba(255,255,255,0.55)", textDecoration: "none", fontSize: 12, fontWeight: 900 };
