// MonthTab — server orchestrator for the Plan / Month surface. Fetches
// month data + the active routine list (for the "+ Add" picker inside
// the day-detail popover), then renders MonthHeader + MonthCalendar.

import type { CSSProperties } from "react";
import MonthHeader from "./MonthHeader";
import MonthCalendar from "./MonthCalendar";
import { getMonthData } from "./data";
import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain } from "@/lib/routines";
import type { QuickPickRoutine } from "@/app/_home/types";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function MonthTab({ searchParams }: { searchParams: SearchParams }) {
  const requestedMonth = getParam(searchParams, "month");

  const [monthData, routineRows] = await Promise.all([
    getMonthData(requestedMonth),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, domain: true, kind: true, subtype: true },
    }),
  ]);

  // Picker list is identical to what Home builds via data.ts:quickPickRoutines.
  const schedulableRoutines: QuickPickRoutine[] = routineRows.map((r) => ({
    routineId: r.id,
    routineName: r.name,
    domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
    kind: r.kind,
  }));

  return (
    <section style={shell} aria-label="Month view">
      <MonthHeader data={monthData} />
      <MonthCalendar data={monthData} schedulableRoutines={schedulableRoutines} />
    </section>
  );
}

const shell: CSSProperties = {
  display: "grid",
  gap: 14,
};
