// Shared windowed log fetch for the Reports hub. Every report (week/month/
// year) and the descriptive aggregators read from this one query so a heavy
// logger's period is never silently truncated and the enrichment (effective
// domain) happens in exactly one place.
//
// Takes a Period's { start, end } directly (UTC instants, end exclusive).
// Drill-downs that need heavier joins (climb attempts, set entries) fetch
// their own targeted slices in their own modules — this stays lean.

import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain } from "@/lib/routines";
import type { ProfileDomain } from "@/lib/profile-summary";

export type ReportLog = {
  id: string;
  routineId: string;
  performedAt: Date;
  distanceMi: number | null;
  durationSec: number | null;
  elevationGainFt: number | null;
  effort: number | null;
  domain: ProfileDomain;
  routine: { name: string };
};

export async function loadReportLogs(window: { start: Date; end: Date }): Promise<ReportLog[]> {
  const rows = await prisma.routineLog.findMany({
    where: { performedAt: { gte: window.start, lt: window.end } },
    orderBy: { performedAt: "asc" },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      elevationGainFt: true,
      effort: true,
      routine: { select: { name: true, domain: true, kind: true, subtype: true } },
    },
  });

  return rows.map((l) => ({
    id: l.id,
    routineId: l.routineId,
    performedAt: l.performedAt,
    distanceMi: l.distanceMi,
    durationSec: l.durationSec,
    elevationGainFt: l.elevationGainFt,
    effort: l.effort,
    domain: effectiveRoutineDomain(
      l.routine.domain,
      l.routine.kind,
      l.routine.subtype
    ) as ProfileDomain,
    routine: { name: l.routine.name },
  }));
}
