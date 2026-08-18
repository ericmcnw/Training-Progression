import ManualLogPageContent from "@/app/manual-log/ManualLogPageContent";

export const dynamic = "force-dynamic";

export default function ProfileHistoryPage({ searchParams }: { searchParams?: Promise<{ domain?: string }> }) {
  const forwarded = (async () => ({ ...(await searchParams), view: "history" }))();
  return <ManualLogPageContent searchParams={forwarded} />;
}
