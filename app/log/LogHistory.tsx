import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { formatHoursMinutes } from "@/lib/progress";
import {
  domainColor,
  effectiveRoutineDomain,
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCardioKind,
  isCompletionKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
} from "@/lib/routines";
import { getLogDisplayName } from "@/lib/routine-display";
import LogHistoryStream, { type LogHistoryRow } from "./LogHistoryStream";

export const dynamic = "force-dynamic";

const RETURN_TO = "/log?view=history";

export default async function LogHistory() {
  const logs = await prisma.routineLog.findMany({
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      completionCount: true,
      distanceMi: true,
      elevationGainFt: true,
      durationSec: true,
      sportData: true,
      activityType: { select: { name: true } },
      routine: {
        select: {
          id: true,
          name: true,
          kind: true,
          domain: true,
          subtype: true,
          activityType: { select: { name: true } },
        },
      },
      exercises: { select: { id: true, sets: { select: { id: true } } } },
    },
  });

  const rows: LogHistoryRow[] = logs.map((log) => {
    const kind = String(log.routine.kind);
    const domain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype);

    // A single glanceable stat for the collapsed row. The expanded body pulls
    // the full detail (exercises, scorecards, trips) via RoutineLogSummary.
    let summary = "";
    if (isCardioKind(kind)) {
      const parts = [`${(log.distanceMi ?? 0).toFixed(2)} mi`];
      if (log.durationSec) parts.push(formatHoursMinutes(log.durationSec));
      if (log.elevationGainFt) parts.push(`${log.elevationGainFt} ft`);
      summary = parts.join(" · ");
    } else if (isWorkoutKind(kind)) {
      const sets = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      summary = `${log.exercises.length} exercises · ${sets} sets`;
    } else if (isGuidedKind(kind) && log.durationSec) {
      summary = log.routine.subtype
        ? `${formatHoursMinutes(log.durationSec)} · ${formatRoutineSubtype(log.routine.subtype)}`
        : formatHoursMinutes(log.durationSec);
    } else if (isSessionKind(kind) && log.durationSec) {
      summary = formatHoursMinutes(log.durationSec);
    } else if (isCompletionKind(kind) && log.completionCount) {
      summary = `Count: ${log.completionCount}`;
    }

    return {
      id: log.id,
      routineId: log.routineId,
      name: getLogDisplayName(log),
      typeLabel: formatRoutineTypeLabel(kind),
      summary,
      stripe: domainColor(domain).replace("0.9)", "0.6)"),
      dateShort: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
      time: formatAppDateTime(log.performedAt, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      editHref: `/routines/${log.routineId}/logs/${log.id}/edit?returnTo=${encodeURIComponent(RETURN_TO)}`,
    };
  });

  return <LogHistoryStream rows={rows} />;
}
