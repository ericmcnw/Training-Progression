import Link from "next/link";
import { notFound } from "next/navigation";
import { getFocusDetail, getInjuryPanelData } from "@/app/focus/data";
import { getProgramDetailData } from "@/app/programs/detail-data";
import { ProgramProgress } from "@/app/programs/[id]/ProgramDetailViews";
import ProgramOverview, { PhaseRail } from "@/app/programs/[id]/ProgramOverview";
import ProgramPlanBoard from "@/app/programs/[id]/ProgramPlanBoard";
import { getProgramPlanBoard } from "@/app/programs/plan-data";
import { getProgramOverview } from "@/app/programs/overview-data";
import { diffYmdDays, todayAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

type View = "overview" | "weekly" | "progress";

const TABS: Array<{ view: View; label: string }> = [
  { view: "overview", label: "Overview" },
  { view: "weekly", label: "Weekly plan" },
  { view: "progress", label: "History" },
];

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const requested = (await searchParams)?.view;
  const view: View = requested === "weekly" ? "weekly" : requested === "progress" ? "progress" : "overview";
  const [focus, detail, planBoard, overview] = await Promise.all([
    getFocusDetail(id),
    getProgramDetailData(id),
    view === "weekly" ? getProgramPlanBoard(id) : Promise.resolve(null),
    view === "overview" ? getProgramOverview(id) : Promise.resolve(null),
  ]);
  if (!focus || !detail) notFound();
  const injury = view === "progress" && focus.linkedInjuryId ? await getInjuryPanelData(focus.linkedInjuryId) : null;
  const accent = focus.color?.trim() || "#7ce8aa";
  const timeline = timelineLabel(detail);

  return (
    <main style={page} className="programDetail">
      <div style={topBar}>
        <Link href="/programs" style={quietLink}>Programs</Link>
        <Link href={`/programs/${id}/edit`} style={editLink}>Edit</Link>
      </div>

      <header style={header}>
        <div style={titleRow}>
          {focus.icon ? <span aria-hidden style={{ fontSize: 24 }}>{focus.icon}</span> : null}
          <div style={{ minWidth: 0 }}>
            <h1 style={title}>{focus.name}</h1>
            <div style={metaLine}>
              {[focus.season, timeline, focus.status === "ACTIVE" ? null : sentenceCase(focus.status)].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <PhaseRail stages={detail.stages} accent={accent} />
      </header>

      <nav aria-label="Program view" style={tabs}>
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={`/programs/${id}?view=${tab.view}`}
            aria-current={view === tab.view ? "page" : undefined}
            style={{ ...tabLink, ...(view === tab.view ? { color: "#fff", background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" } : {}) }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "overview" && overview ? <ProgramOverview focus={focus} detail={detail} overview={overview} accent={accent} /> : null}
      {view === "weekly" && planBoard ? <ProgramPlanBoard programId={id} groups={planBoard} /> : null}
      {view === "progress" ? <ProgramProgress focus={focus} detail={detail} injury={injury} accent={accent} /> : null}
    </main>
  );
}

function timelineLabel(detail: NonNullable<Awaited<ReturnType<typeof getProgramDetailData>>>) {
  if (detail.endYmd) {
    const left = diffYmdDays(detail.endYmd, todayAppYmd());
    return `ends ${shortDate(detail.endYmd)}${left > 0 ? ` · ${left} days left` : ""}`;
  }
  if (detail.reviewYmd) return `review ${shortDate(detail.reviewYmd)}`;
  return detail.startYmd ? `since ${shortDate(detail.startYmd)}` : null;
}

function shortDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  const sameYear = year === Number(todayAppYmd().slice(0, 4));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const page: React.CSSProperties = { width: "100%", minWidth: 0, maxWidth: "var(--app-width-wide)", margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const quietLink: React.CSSProperties = { color: "rgba(255,255,255,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const editLink: React.CSSProperties = { ...quietLink, minHeight: 42, display: "inline-flex", alignItems: "center", padding: "0 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" };
const header: React.CSSProperties = { display: "grid", gap: 9, paddingBottom: 4 };
const metaLine: React.CSSProperties = { marginTop: 5, fontSize: 13, color: "rgba(255,255,255,0.62)" };
const titleRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10 };
const title: React.CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 900, overflowWrap: "anywhere" };
const tabs: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", borderRadius: 8, background: "rgba(255,255,255,0.025)" };
const tabLink: React.CSSProperties = { minHeight: 40, display: "grid", placeItems: "center", borderRadius: 6, borderWidth: 1, borderStyle: "solid", borderColor: "transparent", color: "rgba(255,255,255,0.55)", textDecoration: "none", fontSize: 12, fontWeight: 900 };
