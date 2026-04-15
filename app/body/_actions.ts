"use server";

import { getZoneGroupDetail, type ZoneGroupDetailResult } from "@/lib/body-zones";

export type { ZoneGroupDetailResult as ZoneDetailResult };

export async function fetchZoneDetail(slug: string): Promise<ZoneGroupDetailResult | null> {
  return getZoneGroupDetail(slug);
}
