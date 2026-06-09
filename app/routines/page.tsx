import { redirect } from "next/navigation";

// /routines is the legacy URL for the routines list. The canonical surface
// is now /log. Preserves any searchParams the caller passed (?mode, ?q,
// ?domain) so bookmarked filtered URLs still land where the user expects.
//
// The /routines/[id]/... detail routes are unchanged; only the index page
// moves. The real implementation lives in RoutinesPageContent and is
// rendered by app/log/page.tsx.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RoutinesRedirect(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") qs.set(k, v[0]);
  }
  const query = qs.toString();
  redirect(query ? `/log?${query}` : "/log");
}
