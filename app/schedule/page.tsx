import { redirect } from "next/navigation";

// Legacy redirect: /schedule → /plan. Home's WeekAtGlance now owns per-day
// scheduling via its inline "+ Add" picker, so the standalone schedule page
// has nothing to add — visitors land on the unified Plan page (schedule
// section is the second card down).
//
// Preserves the `month` query by mapping it straight through. `mode=edit`
// is dropped — the new model puts scheduling on Home and the rotation under
// Plan.

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
  if (month && /^\d{4}-\d{2}$/.test(month)) qs.set("month", month);
  const query = qs.toString();
  redirect(`/plan${query ? `?${query}` : ""}`);
}
