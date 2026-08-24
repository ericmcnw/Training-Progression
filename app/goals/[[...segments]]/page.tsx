import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = { segments?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

// Legacy redirect: /goals → /plan, /goals/<id> → /plan/goals/<id>. Plan is
// now a single scrolling page with Goals as the first section, so a plain
// /plan redirect lands on goals. Keeps old links and bookmarks pointed right.

export default async function GoalsRedirect(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const segments = params.segments ?? [];

  if (segments.length === 0) {
    const qs = new URLSearchParams();
    qs.set("view", "goals");
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "tab") continue;
      if (typeof v === "string") qs.set(k, v);
      else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
    }
    // Goals is the first section of the unified Plan page, so a hashless
    // redirect lands on it. (Server-redirect Location fragments aren't
    // reliable; the in-app jump-nav handles client-side anchoring.)
    const query = qs.toString();
    redirect(`/plan?${query}`);
  }

  if (segments.length === 1) {
    redirect(`/plan/goals/${encodeURIComponent(segments[0])}`);
  }

  notFound();
}
