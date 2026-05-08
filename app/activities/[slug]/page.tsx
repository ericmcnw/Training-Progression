import SportsTargetPage from "@/app/progress/details/SportsTargetPage";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

// Phase 2: this is the activity-world detail page route. For now it delegates
// rendering to the existing SportsTargetPage (which already handles climbing,
// virtual sports, and metadata-backed sport groups). Phase 3 will replace this
// with a fully redesigned activity-world template (Pulse / Trends / Content /
// Training / Body / Goals sub-tabs, with deep climbing-specific browsing).
//
// Defaults for the tab and range query params are handled inside SportsTargetPage
// (via normalizeProgressTab / getRangeFromSearchParam), so we don't need to
// redirect on missing params — landing on /activities/climbing with no query
// just renders the overview at 4-week range.
//
// If the slug doesn't match a metadata group or a virtual sport, SportsTargetPage
// will call notFound() — Next.js renders the default 404 page in that case.
export default function ActivityDetailPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  return <SportsTargetPage params={props.params} searchParams={props.searchParams} />;
}
