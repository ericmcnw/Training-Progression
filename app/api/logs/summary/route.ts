import { NextResponse } from "next/server";
import { getLogSummaryData, type LogSummaryData } from "@/lib/log-summary";

export const dynamic = "force-dynamic";

// Batch endpoint: `/api/logs/summary?ids=a,b,c` → `{ logs: LogSummaryData[] }`.
// Used by the view-log modal to fetch every same-day log for a routine in
// one round trip. Unknown / deleted ids are silently dropped — the client
// uses the response length to detect the "log no longer exists" case and
// close the modal if it was the last one.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) return NextResponse.json({ logs: [] satisfies LogSummaryData[] });

  const results = await Promise.all(ids.map((id) => getLogSummaryData(id)));
  const logs = results.filter((r): r is LogSummaryData => r !== null);

  // Preserve the requested order so the modal's "most recent first" sort
  // upstream stays intact.
  const byId = new Map(logs.map((l) => [l.id, l]));
  const ordered = ids.map((id) => byId.get(id)).filter((l): l is LogSummaryData => Boolean(l));

  return NextResponse.json({ logs: ordered });
}
