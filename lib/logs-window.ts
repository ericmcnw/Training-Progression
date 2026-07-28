import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { getAppDayRange, toAppYmd } from "@/lib/dates";
import { getLogDisplayName } from "@/lib/routine-display";
import { effectiveRoutineDomain, type RoutineDomain } from "@/lib/routines";

// Canonical read for "what did the user do in this date window" — the single
// place that resolves a log's display name (synthetic-routine aware), its
// effective domain, and its app-timezone calendar day. Every surface that
// lists logs (UI feeds AND the coach's read-only tools) should route through
// this so they can't drift on which logs count or how they're named.
//
// Scoped through getAppSession() — a no-op today (single-user), but threading
// it now means the eventual auth migration is a where-clause change here, not
// a rewrite of every caller.

export type LogWindowRow = {
  id: string;
  /** App-timezone calendar day, YYYY-MM-DD. */
  ymd: string;
  performedAt: Date;
  routineId: string;
  /** Resolved name: "Trail Run", "Legs A", "Concert dancing" — never the bare
   *  synthetic "Endurance"/"Activity" placeholder. */
  displayName: string;
  domain: RoutineDomain;
  activityTypeId: string | null;
  durationSec: number | null;
  distanceMi: number | null;
  elevationGainFt: number | null;
  effort: number | null;
  notes: string | null;
};

export type LogWindowOptions = {
  /** Inclusive start day (app tz), YYYY-MM-DD. */
  fromYmd: string;
  /** Inclusive end day (app tz), YYYY-MM-DD. Defaults to fromYmd. */
  toYmd?: string;
  /** Restrict to these routine ids. */
  routineIds?: string[];
  /** Restrict to these effective domains (evaluated after resolution). */
  domains?: RoutineDomain[];
};

export async function getLogsInWindow(opts: LogWindowOptions): Promise<LogWindowRow[]> {
  const fromYmd = opts.fromYmd;
  const toYmd = opts.toYmd ?? fromYmd;
  await getAppSession(); // scope seam — no-op in single-user mode

  const start = getAppDayRange(fromYmd).start;
  const end = getAppDayRange(toYmd).end; // exclusive: start of the day after toYmd

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: start, lt: end },
      routine: { isDeleted: false },
      ...(opts.routineIds?.length ? { routineId: { in: opts.routineIds } } : {}),
    },
    orderBy: { performedAt: "asc" },
    select: {
      id: true,
      performedAt: true,
      routineId: true,
      activityTypeId: true,
      durationSec: true,
      distanceMi: true,
      elevationGainFt: true,
      effort: true,
      notes: true,
      sportData: true,
      activityType: { select: { name: true } },
      routine: {
        select: {
          name: true,
          domain: true,
          kind: true,
          subtype: true,
          activityType: { select: { name: true } },
        },
      },
    },
  });

  const rows: LogWindowRow[] = [];
  for (const log of logs) {
    if (!log.routine) continue;
    const domain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype);
    if (opts.domains && !opts.domains.includes(domain)) continue;
    rows.push({
      id: log.id,
      ymd: toAppYmd(log.performedAt),
      performedAt: log.performedAt,
      routineId: log.routineId,
      displayName: getLogDisplayName(log),
      domain,
      activityTypeId: log.activityTypeId,
      durationSec: log.durationSec,
      distanceMi: log.distanceMi,
      elevationGainFt: log.elevationGainFt,
      effort: log.effort,
      notes: log.notes,
    });
  }
  return rows;
}
