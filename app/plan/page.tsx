// Plan — macro-horizon planning surface. Now that Home's WeekAtGlance
// covers per-day scheduling, Plan focuses on Month (calendar view), Goals
// (longer-horizon targets), and Cycles (recurring schedules).
//
// This page is the shell that owns the chrome. Each tab is rendered by its
// own server component imported below, so the active tab can do its own
// data fetching without the shell knowing about it.

import PlanTabs, { isValidTab, type PlanTabKey } from "./PlanTabs";
import MonthTab from "./month/MonthTab";
import GoalsTab from "./goals/GoalsTab";
import CyclesTab from "./cycles/CyclesTab";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlanPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requested = getParam(searchParams, "tab");
  const tab: PlanTabKey = isValidTab(requested) ? requested : "month";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <PlanTabs current={tab} />
        {/* Schedule-surface entry point for creating a routine you want to
            plan in. Defaults to the unscoped domain picker — pick any of the
            five tiles. The activity-page-scoped flows handle the "I know what
            domain I want" case; here we're in macro-planning context. */}
        <NewRoutineDrawerButton style={planNewRoutineStyle}>
          + New Routine
        </NewRoutineDrawerButton>
      </div>
      {tab === "month" ? <MonthTab searchParams={searchParams} /> : null}
      {tab === "goals" ? <GoalsTab searchParams={searchParams} /> : null}
      {tab === "cycles" ? <CyclesTab /> : null}
    </div>
  );
}

const planNewRoutineStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.2,
  cursor: "pointer",
  minHeight: 36,
  lineHeight: 1,
};