import ManualLogPageContent from "@/app/manual-log/ManualLogPageContent";

export const dynamic = "force-dynamic";

// /profile is the canonical URL for the user's log + backfill surface
// (formerly /manual-log). The functional content (recent log history,
// weekly/monthly/yearly summaries, calendar, delete) lives in
// ManualLogPageContent and is rendered here.
//
// The earlier first-cut /profile placeholder (Account / Reports /
// Settings sections) was a stub for future multi-user work. It will
// return as new sections layered on top of (or alongside) the log
// history view once the auth + reports surfaces actually ship.
export default async function ProfilePage(props: {
  searchParams?: Promise<{ view?: string; domain?: string }>;
}) {
  return <ManualLogPageContent searchParams={props.searchParams} />;
}
