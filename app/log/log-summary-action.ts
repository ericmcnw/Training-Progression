"use server";

import { getLogSummaryData } from "@/lib/log-summary";

// Lazy-load the full detail for one log when its history row is expanded —
// the same shape the detail page / view-log modal render, so the stream
// stays in lockstep with them.
export async function loadLogSummary(logId: string) {
  return getLogSummaryData(logId);
}
