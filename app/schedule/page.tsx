import { redirect } from "next/navigation";

// Legacy redirect: /schedule → /plan?tab=month. Home's WeekAtGlance now
// owns per-day scheduling via its inline "+ Add" picker, so the standalone
// schedule page has nothing to add — visitors land on Plan / Month for
// macro-horizon context.
//
// Preserves any `start` or `month` query the old page accepted by mapping
// `month` straight through. `mode=edit` is dropped — the new model puts
// scheduling on Home and cycles under Plan / Cycles.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ScheduleRedirect(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const month = getParam(searchParams, "month");
  const qs = new URLSearchParams();
  qs.set("tab", "month");
  if (month && /^\d{4}-\d{2}$/.test(month)) qs.set("month", month);
  redirect(`/plan?${qs.toString()}`);
}
