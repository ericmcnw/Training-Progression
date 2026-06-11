import { redirect } from "next/navigation";

// Projects folded into the climbs database as the "Projects" outcome
// filter (which renders per-problem rollup cards instead of raw attempt
// rows). This URL stays alive for old bookmarks; the location param
// carries over.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsRedirect(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const location = typeof searchParams.location === "string" ? searchParams.location : undefined;
  const qs = new URLSearchParams({ outcome: "project" });
  if (location) qs.set("location", location);
  redirect(`/activities/climbing/climbs?${qs.toString()}`);
}
