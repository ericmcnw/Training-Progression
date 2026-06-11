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
import { listSelectedSports } from "@/lib/synthetic-sport-routines";
import { getActivityEntry } from "@/lib/activity-families";
import { sportAccent } from "@/lib/sport-accent";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function MonthTab({ searchParams }: { searchParams: SearchParams }) {
  const requestedMonth = getParam(searchParams, "month");

  const [monthData, routineRows, activityTypeRows, selectedSports] = await Promise.all([
    getMonthData(requestedMonth),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, domain: true, kind: true, subtype: true },
    }),
    // Enabled endurance types for the typed-endurance schedule shortcut.
    // Disabled types filter out via UserActivityTypePreference (default
    // enabled when no preference row exists).
    prisma.activityType.findMany({
      include: {
        family: { select: { name: true, sortOrder: true } },
        userPreferences: { select: { enabled: true } },
      },
      orderBy: [{ family: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    // User's selected sports — populates the SPORTS tile row in the
    // schedule picker so tapping "Climbing" schedules a session for the
    // chosen day (instant; details get filled in when the user logs).
    listSelectedSports(),
  ]);

  // Picker list is identical to what Home builds via data.ts:quickPickRoutines.
  const schedulableRoutines: QuickPickRoutine[] = routineRows.map((r) => ({
    routineId: r.id,
    routineName: r.name,
    domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
    kind: r.kind,
  }));
  const scheduleActivityTypes = activityTypeRows
    .filter((t) => t.userPreferences[0]?.enabled !== false)
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      familyId: t.familyId,
      familyName: t.family.name,
    }));
  const scheduleSports = selectedSports.map((s) => ({
    slug: s.slug,
    label: s.label,
    eyebrow: getActivityEntry(s.slug)?.eyebrow ?? "Sport",
    color: sportAccent(s.slug),
  }));

  return (
    <section style={shell} aria-label="Month view">
      <MonthHeader data={monthData} />
      <MonthCalendar
        data={monthData}
        schedulableRoutines={schedulableRoutines}
        scheduleActivityTypes={scheduleActivityTypes}
        scheduleSports={scheduleSports}
      />
    </section>
  );
}

const shell: CSSProperties = {
  display: "grid",
  gap: 14,
};
