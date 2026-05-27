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
      <PlanTabs current={tab} />
      {tab === "month" ? <MonthTab searchParams={searchParams} /> : null}
      {tab === "goals" ? <GoalsTab searchParams={searchParams} /> : null}
      {tab === "cycles" ? <CyclesTab /> : null}
    </div>
  );
}