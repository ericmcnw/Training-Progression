import Link from "next/link";
import MonthTab from "./month/MonthTab";
import YearTab from "./year/YearTab";
import GoalsTab from "./goals/GoalsTab";
import MarkTimeAwayButton from "./month/MarkTimeAwayButton";
import { NewRoutineDrawerButton, NewGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { todayAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type PlanView = "programs" | "calendar" | "goals";

const VIEWS: Array<{ value: PlanView; label: string }> = [
  { value: "programs", label: "Programs" },
  { value: "calendar", label: "Calendar" },
  { value: "goals", label: "Goals" },
];

export default async function PlanPage(props: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requested = Array.isArray(searchParams.view) ? searchParams.view[0] : searchParams.view;
  const view: PlanView = requested === "calendar" || requested === "goals" ? requested : "programs";

  return (
    <main className="mobilePageShell" style={page}>
      <header style={header}>
        <div>
          <h1 className="mobilePageTitle" style={title}>Plan</h1>
          <p className="mobilePageSubtitle" style={subtitle}>{viewDescription(view)}</p>
        </div>
        <ViewAction view={view} />
      </header>

      <nav aria-label="Plan view" style={viewTabs}>
        {VIEWS.map((item) => (
          <Link
            key={item.value}
            href={`/plan?view=${item.value}`}
            aria-current={view === item.value ? "page" : undefined}
            style={{ ...viewLink, ...(view === item.value ? activeViewLink : {}) }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {view === "programs" ? (
        <section style={surface}>
          <div style={surfaceHead}>
            <div><h2 style={surfaceTitle}>Program timeline</h2><p style={surfaceCopy}>Campaigns and seasons across the year. Open a program for its roadmap and progress.</p></div>
            <Link href="/programs" style={quietAction}>All programs</Link>
          </div>
          <YearTab />
        </section>
      ) : null}

      {view === "calendar" ? (
        <section style={surface}>
          <MonthTab searchParams={searchParams} />
        </section>
      ) : null}

      {view === "goals" ? (
        <section style={surface}>
          <GoalsTab searchParams={searchParams} />
        </section>
      ) : null}
    </main>
  );
}

function ViewAction({ view }: { view: PlanView }) {
  if (view === "programs") return <Link href="/programs/new" style={primaryAction}>New program</Link>;
  if (view === "goals") return <NewGoalDrawerButton style={primaryAction}>New goal</NewGoalDrawerButton>;
  return <div style={actionRow}><MarkTimeAwayButton today={todayAppYmd()} /><NewRoutineDrawerButton style={primaryAction}>New routine</NewRoutineDrawerButton></div>;
}

function viewDescription(view: PlanView) {
  if (view === "calendar") return "What is planned and what actually happened.";
  if (view === "goals") return "Measured targets that can contribute to programs.";
  return "Longer-term direction, stages, and progression.";
}

const page: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 16 };
const header: React.CSSProperties = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const title: React.CSSProperties = { margin: 0, fontSize: 26, fontWeight: 900 };
const subtitle: React.CSSProperties = { margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.62)" };
const viewTabs: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" };
const viewLink: React.CSSProperties = { minHeight: 40, display: "grid", placeItems: "center", borderRadius: 6, borderWidth: 1, borderStyle: "solid", borderColor: "transparent", color: "rgba(255,255,255,0.58)", textDecoration: "none", fontSize: 12, fontWeight: 900 };
const activeViewLink: React.CSSProperties = { color: "#fff", background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.18)" };
const surface: React.CSSProperties = { display: "grid", gap: 14, paddingTop: 4 };
const surfaceHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
const surfaceTitle: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 900 };
const surfaceCopy: React.CSSProperties = { margin: "3px 0 0", maxWidth: 560, color: "rgba(255,255,255,0.52)", fontSize: 11.5, lineHeight: 1.45 };
const primaryAction: React.CSSProperties = { minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 13px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.4)", background: "rgba(51,255,122,0.1)", color: "#7ce8aa", textDecoration: "none", fontSize: 12, fontWeight: 900, cursor: "pointer" };
const quietAction: React.CSSProperties = { minHeight: 34, display: "inline-flex", alignItems: "center", color: "rgba(255,255,255,0.66)", textDecoration: "none", fontSize: 11.5, fontWeight: 850, flexShrink: 0 };
const actionRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" };
