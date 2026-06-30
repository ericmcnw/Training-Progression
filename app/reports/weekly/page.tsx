import { redirect } from "next/navigation";

// Legacy route — the weekly report now lives at /reports/week (navigable hub).
// Preserve any ?week= anchor so old links/bookmarks land on the same week.
export default async function LegacyWeeklyRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  redirect(sp?.week ? `/reports/week?week=${sp.week}` : "/reports/week");
}
