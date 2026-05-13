"use server";

// "use server" modules can only export async functions — re-exporting a type
// alias here trips Next.js' server-actions loader (the type symbol gets
// stripped and the generated wrapper fails to resolve it at runtime). The
// ZoneDetailResult type now lives in ./_types so callers can pull it from
// there independently of the server action.

import { getZoneGroupDetail } from "@/lib/body-zones";
import type { ZoneDetailResult } from "./_types";

export async function fetchZoneDetail(slug: string): Promise<ZoneDetailResult | null> {
  return getZoneGroupDetail(slug);
}
