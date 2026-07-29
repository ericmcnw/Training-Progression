import ManualLogPageContent from "@/app/manual-log/ManualLogPageContent";

export const dynamic = "force-dynamic";

// /profile is the canonical URL for the user's log + backfill surface
// (formerly /manual-log). The functional content (recent log history,
// weekly/monthly/yearly summaries, calendar, delete) lives in
// ManualLogPageContent; identity, settings, and Reports link from its
// header.
export default async function ProfilePage(props: {
  searchParams?: Promise<{ view?: string; domain?: string }>;
}) {
  return <ManualLogPageContent searchParams={props.searchParams} />;
}
