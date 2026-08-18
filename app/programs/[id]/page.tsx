import Link from "next/link";
import { notFound } from "next/navigation";
import { getFocusDetail, getInjuryPanelData, seasonPhaseLabel } from "@/app/focus/data";
import { getProgramDetailData } from "@/app/programs/detail-data";
import { ProgramOverview, ProgramPlan, ProgramProgress } from "@/app/programs/[id]/ProgramDetailViews";

export const dynamic = "force-dynamic";

type View = "overview" | "plan" | "progress";

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const requested = (await searchParams)?.view;
  const view: View = requested === "plan" || requested === "progress" ? requested : "overview";
  const [focus, detail] = await Promise.all([getFocusDetail(id), getProgramDetailData(id)]);
  if (!focus || !detail) notFound();
  const injury = focus.linkedInjuryId ? await getInjuryPanelData(focus.linkedInjuryId) : null;
  const accent = focus.color?.trim() || "#7ce8aa";
  const progress = focus.milestonesTotal ? Math.round((focus.milestonesDone / focus.milestonesTotal) * 100) : 0;
  const season = seasonPhaseLabel(focus.season, focus.phase);

  return (
    <main style={page} className="programDetail">
      <div style={topBar}>
        <Link href="/programs" style={quietLink}>Programs</Link>
        <Link href={`/programs/${id}/edit`} style={editLink}>Build program</Link>
      </div>

      <header style={header}>
        <div style={titleRow}>
          {focus.icon ? <span aria-hidden style={{ fontSize: 24 }}>{focus.icon}</span> : null}
          <div style={{ minWidth: 0 }}>
            <h1 style={title}>{focus.name}</h1>
            <div style={metaRow}>
              {season ? <span style={{ ...accentChip, color: accent, borderColor: `${accent}55` }}>{season}</span> : null}
              <span style={statusChip}>{focus.status.toLowerCase()}</span>
            </div>
          </div>
        </div>
        {focus.description ? <p style={description}>{focus.description}</p> : null}
        {focus.milestonesTotal ? (
          <div style={progressRow}>
            <div style={track}><div style={{ ...fill, width: `${progress}%`, background: accent }} /></div>
            <strong style={{ color: accent, fontSize: 11 }}>{focus.milestonesDone}/{focus.milestonesTotal} milestones</strong>
          </div>
        ) : null}
      </header>

      <nav aria-label="Program view" style={tabs}>
        {(["overview", "plan", "progress"] as const).map((tab) => (
          <Link
            key={tab}
            href={`/programs/${id}?view=${tab}`}
            aria-current={view === tab ? "page" : undefined}
            style={{ ...tabLink, ...(view === tab ? { color: "#fff", background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" } : {}) }}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </Link>
        ))}
      </nav>

      {view === "overview" ? <ProgramOverview focus={focus} detail={detail} injury={injury} accent={accent} /> : null}
      {view === "plan" ? <ProgramPlan focus={focus} detail={detail} accent={accent} /> : null}
      {view === "progress" ? <ProgramProgress focus={focus} detail={detail} injury={injury} accent={accent} /> : null}
    </main>
  );
}

const page: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", display: "grid", gap: 16 };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const quietLink: React.CSSProperties = { color: "rgba(255,255,255,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const editLink: React.CSSProperties = { ...quietLink, minHeight: 42, display: "inline-flex", alignItems: "center", padding: "0 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" };
const header: React.CSSProperties = { display: "grid", gap: 10 };
const titleRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10 };
const title: React.CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 900, overflowWrap: "anywhere" };
const metaRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" };
const accentChip: React.CSSProperties = { padding: "3px 8px", borderRadius: 99, border: "1px solid", fontSize: 9.5, fontWeight: 900, textTransform: "uppercase" };
const statusChip: React.CSSProperties = { ...accentChip, color: "rgba(255,255,255,0.55)", borderColor: "rgba(255,255,255,0.14)" };
const description: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.64)" };
const progressRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const track: React.CSSProperties = { height: 7, flex: 1, borderRadius: 99, background: "rgba(255,255,255,0.09)", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 99 };
const tabs: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, background: "rgba(255,255,255,0.025)" };
const tabLink: React.CSSProperties = { minHeight: 40, display: "grid", placeItems: "center", borderRadius: 7, border: "1px solid transparent", color: "rgba(255,255,255,0.55)", textDecoration: "none", fontSize: 12, fontWeight: 900 };
