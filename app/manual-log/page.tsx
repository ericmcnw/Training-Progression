import { redirect } from "next/navigation";

// /manual-log is the legacy URL for training history. Preserve filters while
// sending old bookmarks to the canonical Profile / History surface.
//
// The actual implementation lives in ManualLogPageContent (still in this
// directory alongside its helpers) and is rendered by app/profile/page.tsx.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ManualLogRedirect(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") qs.set(k, v[0]);
  }
  const query = qs.toString();
  redirect(query ? `/profile/history?${query}` : "/profile/history");
}
