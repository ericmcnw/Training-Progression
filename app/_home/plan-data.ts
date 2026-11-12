import { prisma } from "@/lib/prisma";
import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";
import { getActivityEntry } from "@/lib/activity-families";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";
import { mondayOfYmd, weekPlanLines, PLAN_ITEM_SELECT, type WeekPlanLine } from "@/lib/program-plan";

export type HomePlanGroup = {
  key: string;
  title: string;
  /** Where the Log button goes; endurance opens the log drawer instead. */
  logHref: string | null;
  opensEnduranceDrawer: boolean;
  /** Weekday names this week where the calendar has it scheduled. */
  scheduledDays: string[];
  programs: Array<{ id: string; name: string }>;
  lines: WeekPlanLine[];
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function weekday(ymd: string) {
  return WEEKDAY.format(new Date(`${ymd}T00:00:00.000Z`));
}

export async function getHomePlanGroups(): Promise<HomePlanGroup[]> {
  const today = todayAppYmd();
  const items = await prisma.programPlanItem.findMany({
    where: { isActive: true, program: { status: "ACTIVE" } },
    orderBy: [{ program: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { ...PLAN_ITEM_SELECT, program: { select: { id: true, name: true } }, routine: { select: { name: true } } },
  });
  if (items.length === 0) return [];

  const monday = mondayOfYmd(today);
  const sunday = addDaysYmd(monday, 6);
  const [lines, schedule] = await Promise.all([
    weekPlanLines(items, today),
    prisma.scheduleManualEntry.findMany({
      where: {
        scheduledDate: { gte: new Date(`${addDaysYmd(monday, -1)}T00:00:00.000Z`), lte: new Date(`${addDaysYmd(sunday, 1)}T23:59:59.999Z`) },
      },
      select: { routineId: true, activityTypeId: true, scheduledDate: true, activityType: { select: { familyId: true } } },
    }),
  ]);
  const thisWeek = schedule
    .map((entry) => ({ ...entry, ymd: toAppYmd(new Date(entry.scheduledDate)) }))
    .filter((entry) => entry.ymd >= monday && entry.ymd <= sunday);
  const lineById = new Map(lines.map((line) => [line.itemId, line]));

  const groups = new Map<string, HomePlanGroup>();
  for (const item of items) {
    const line = lineById.get(item.id);
    if (!line) continue;
    let key: string;
    let title: string;
    let logHref: string | null = null;
    let opensEnduranceDrawer = false;
    let days: string[] = [];
    if (item.kind === "EXERCISE") {
      key = `routine-${item.routineId ?? "none"}`;
      title = item.routine?.name ?? "Exercises";
      logHref = item.routineId ? `/routines/${item.routineId}/log` : null;
      days = thisWeek.filter((e) => e.routineId === item.routineId).map((e) => e.ymd);
    } else if (item.kind === "ACTIVITY") {
      key = "endurance";
      title = "Endurance";
      opensEnduranceDrawer = true;
      days = thisWeek
        .filter((e) =>
          item.activityTypeId ? e.activityTypeId === item.activityTypeId : Boolean(item.enduranceFamilyId) && e.activityType?.familyId === item.enduranceFamilyId,
        )
        .map((e) => e.ymd);
    } else {
      const slug = item.sportSlug ?? "";
      key = `sport-${slug}`;
      title = getActivityEntry(slug)?.label ?? slug;
      logHref = `/activities/${slug}`;
      days = thisWeek.filter((e) => e.routineId === getSyntheticSportRoutineId(slug)).map((e) => e.ymd);
    }
    const group = groups.get(key) ?? { key, title, logHref, opensEnduranceDrawer, scheduledDays: [], programs: [], lines: [] };
    group.lines.push(line);
    for (const ymd of days) if (!group.scheduledDays.includes(ymd)) group.scheduledDays.push(ymd);
    if (!group.programs.some((p) => p.id === item.program.id)) group.programs.push(item.program);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({ ...group, scheduledDays: group.scheduledDays.sort().map(weekday) }));
}
