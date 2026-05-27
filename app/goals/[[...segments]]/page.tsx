import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = { segments?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

// Legacy redirect: /goals → /plan?tab=goals, /goals/<id> → /plan/goals/<id>.
// Both Home's HabitGrid and Plan's Goals tab now point at the canonical
// /plan/goals/<id> path; this keeps any pre-existing in-app links and
// bookmarks pointed at the right destination.

export default async function GoalsRedirect(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const segments = params.segments ?? [];

  if (segments.length === 0) {
    const qs = new URLSearchParams();
    qs.set("tab", "goals");
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string") qs.set(k, v);
      else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
    }
    redirect(`/plan?${qs.toString()}`);
  }

  if (segments.length === 1) {
    redirect(`/plan/goals/${encodeURIComponent(segments[0])}`);
  }

  notFound();
}
