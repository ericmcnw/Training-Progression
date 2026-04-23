import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, formatUtcDateLabel, getAppDayRange, toAppYmd, todayAppYmd } from "@/lib/dates";
import { effectiveRoutineDomain, domainColor } from "@/lib/routines";
import ScheduleBoard from "./ScheduleBoard";
import { quickAddManualEntry, removeManualEntry } from "./actions";

export const dynamic = "force-dynamic";

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isYmd(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isMonthParam(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function todayLocalYmd() {
  return todayAppYmd();
}

function toYmd(value: string | Date) {
  return toAppYmd(value);
}

function addDays(ymd: string, plus: number) {
  return addDaysYmd(ymd, plus);
}

function dayDiff(a: string, b: string) {
  return diffYmdDays(a, b);
}

function formatDayTitle(ymd: string) {
  const weekday = formatUtcDateLabel(ymd, { weekday: "long" });
  const md = formatUtcDateLabel(ymd, { month: "short", day: "numeric" });
  return `${weekday} (${md})`;
}

function startOfMonth(month: string) {
  return `${month}-01`;
}

function monthFromYmd(ymd: string) {
  return ymd.slice(0, 7);
}

function addMonths(month: string, plus: number) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + plus);
  return date.toISOString().slice(0, 7);
}

function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function weekdayIndex(ymd: string) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return date.getUTCDay();
}

function buildAgendaDays(start: string, totalDays: number) {
  return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
}

function fallbackRoutineLabel(name: string | undefined) {
  return name?.trim() || "Deleted routine";
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const mode = getParam(params?.mode) === "edit" ? "edit" : "view";
  const today = todayLocalYmd();
  const requestedStart = getParam(params?.start);
  const timelineStart = isYmd(requestedStart) ? requestedStart! : today;
  const selectedMonth = isMonthParam(getParam(params?.month)) ? getParam(params?.month)! : monthFromYmd(today);

  const [routines, manualRaw, logRange] = await prisma.$transaction([
    prisma.routine.findMany({
      where: { isDeleted: false },
      orderBy: [{ isActive: "desc" }, { kind: "asc" }, { category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, subtype: true, domain: true, category: true, timesPerWeek: true },
    }),
    prisma.$queryRawUnsafe<Array<{ id: string; routineId: string; scheduledDate: string; sortOrder: number }>>(
      'SELECT "id","routineId","scheduledDate","sortOrder" FROM "ScheduleManualEntry" ORDER BY "scheduledDate" ASC, "sortOrder" ASC'
    ),
    prisma.routineLog.aggregate({
      _min: { performedAt: true },
      _max: { performedAt: true },
    }),
  ]);

  const manualEntries = manualRaw.map((entry) => ({
    id: entry.id,
    routineId: entry.routineId,
    scheduledDate: toYmd(entry.scheduledDate),
    sortOrder: Number(entry.sortOrder),
  }));

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    return addDays(today, i);
  });
  const routinePlannedDaysMap = new Map<string, number>();
  for (const day of next7Days) {
    const ids = new Set<string>();
    for (const manual of manualEntries) {
      if (manual.scheduledDate === day) ids.add(manual.routineId);
    }
    for (const id of ids) {
      routinePlannedDaysMap.set(id, (routinePlannedDaysMap.get(id) ?? 0) + 1);
    }
  }
  const routinesWithPlanned = routines.map((routine) => ({
    ...routine,
    domain: effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype),
    suggestedTimesPerWeek: routine.timesPerWeek ?? 0,
    plannedDaysPerWeek: routinePlannedDaysMap.get(routine.id) ?? 0,
  }));

  const timelineDays = buildAgendaDays(timelineStart, 7);
  const timelineEnd = addDays(timelineStart, 7);
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = addDays(startOfMonth(addMonths(selectedMonth, 1)), 0);
  const monthDays = buildAgendaDays(monthStart, dayDiff(monthEnd, monthStart));
  const logStart = timelineStart < monthStart ? timelineStart : monthStart;
  const logEnd = timelineEnd > monthEnd ? timelineEnd : monthEnd;

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: {
        gte: getAppDayRange(logStart).start,
        lt: getAppDayRange(logEnd).start,
      },
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, routineId: true, performedAt: true },
  });

  const referencedRoutineIds = Array.from(
    new Set([...manualEntries.map((entry) => entry.routineId), ...logs.map((log) => log.routineId)])
  );
  const inactiveReferencedRoutines = referencedRoutineIds.length
    ? await prisma.routine.findMany({
        where: {
          id: { in: referencedRoutineIds },
          isDeleted: true,
        },
        select: { id: true, name: true },
      })
    : [];
  const routineNameMap = new Map(
    [...routines, ...inactiveReferencedRoutines].map((routine) => [routine.id, fallbackRoutineLabel(routine.name)])
  );
  const routineDomainMap = new Map(routines.map((r) => [r.id, effectiveRoutineDomain(r.domain, r.kind, r.subtype)]));

  const loggedMap = new Map<string, number>();
  const latestLogIdByDay = new Map<string, string>();
  const loggedByDay = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const day = toAppYmd(log.performedAt);
    const key = `${day}|${log.routineId}`;
    loggedMap.set(key, (loggedMap.get(key) ?? 0) + 1);
    if (!latestLogIdByDay.has(key)) latestLogIdByDay.set(key, log.id);
    if (!loggedByDay.has(day)) loggedByDay.set(day, new Map());
    const dayLogs = loggedByDay.get(day)!;
    dayLogs.set(log.routineId, (dayLogs.get(log.routineId) ?? 0) + 1);
  }

  function buildAgenda(days: string[]) {
    return days.map((day) => {
      const plannedCounts = new Map<string, number>();
      const manualItems = manualEntries
        .filter((manual) => manual.scheduledDate === day)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((manual) => ({
          id: manual.id,
          routineId: manual.routineId,
          routineName: routineNameMap.get(manual.routineId) ?? "Deleted routine",
        }));

      for (const manual of manualItems) {
        plannedCounts.set(manual.routineId, (plannedCounts.get(manual.routineId) ?? 0) + 1);
      }

      const isPastOrToday = day <= today;
      if (isPastOrToday) {
        for (const [routineId] of loggedByDay.get(day)?.entries() ?? []) {
          if (!plannedCounts.has(routineId)) plannedCounts.set(routineId, 0);
        }
      }

      const tasks = Array.from(plannedCounts.entries())
        .map(([routineId, planned]) => {
          const logged = loggedMap.get(`${day}|${routineId}`) ?? 0;
          const removableManualEntry = logged === 0
            ? manualItems.find((item) => item.routineId === routineId)
            : undefined;
          return {
            routineId,
            routineName: routineNameMap.get(routineId) ?? "Deleted routine",
            domain: routineDomainMap.get(routineId) ?? null,
            planned,
            logged,
            remaining: Math.max(0, planned - logged),
            removableManualEntryId: removableManualEntry?.id ?? null,
            latestLogId: latestLogIdByDay.get(`${day}|${routineId}`) ?? null,
          };
        })
        .sort((a, b) => a.routineName.localeCompare(b.routineName));

      return { day, tasks, isPastOrToday };
    });
  }

  const agenda = buildAgenda(timelineDays);
  const monthAgenda = buildAgenda(monthDays);
  const monthAgendaMap = new Map(monthAgenda.map((day) => [day.day, day]));
  const leadingEmptyDays = weekdayIndex(monthStart);
  const trailingEmptyDays = (7 - ((leadingEmptyDays + monthDays.length) % 7)) % 7;
  const monthCalendarCells = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...monthDays.map((day) => monthAgendaMap.get(day) ?? { day, tasks: [], isPastOrToday: day <= today }),
    ...Array.from({ length: trailingEmptyDays }, () => null),
  ];
  // 8-week strip: 3 weeks back, this week, 4 weeks forward
  const weekStarts = Array.from({ length: 8 }, (_, i) => addDays(today, (i - 3) * 7));

  const earliestKnownYmd = [
    manualEntries[0]?.scheduledDate,
    logRange._min.performedAt ? toAppYmd(logRange._min.performedAt) : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))[0] ?? monthStart;
  const earliestMonth = ["2026-01", monthFromYmd(earliestKnownYmd)].sort((a, b) => a.localeCompare(b))[0];
  const latestMonth = monthFromYmd(today);
  const monthOptions: string[] = [];
  for (let cursor = latestMonth; cursor >= earliestMonth; cursor = addMonths(cursor, -1)) {
    monthOptions.push(cursor);
    if (cursor === earliestMonth) break;
  }

  return (
    <div className="mobileSchedulePage" style={container}>
      <div className="mobileScheduleTopRow" style={topRow}>
        <div>
          <h1 style={title}>Schedule</h1>
          <div style={subText}>Plan the next few weeks, compare plan versus completed work, and use the month view for broader context.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {mode === "view" ? (
            <Link href="/schedule?mode=edit" style={linkBtn}>
              Edit Schedule
            </Link>
          ) : (
            <Link href="/schedule" style={linkBtn}>
              View Schedule
            </Link>
          )}
          <Link href="/routines" style={linkBtn}>View Routines</Link>
        </div>
      </div>

      {mode === "view" && (
        <>
          <section style={panel}>
            <div style={panelHeader}>ROLLING TIMELINE</div>

            {/* Week strip */}
            <div style={{ overflowX: "auto", borderBottom: "1px solid rgba(128,128,128,0.2)" }}>
              <div style={weekStrip}>
                {weekStarts.map((ws) => {
                  const isActive = ws === timelineStart;
                  const isThisWeek = ws === today;
                  const label = isThisWeek
                    ? "This week"
                    : formatUtcDateLabel(ws, { month: "short", day: "numeric" });
                  return (
                    <Link
                      key={ws}
                      href={`/schedule?start=${ws}&month=${monthFromYmd(ws)}`}
                      style={isActive ? activeWeekPill : weekPill}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: 12, display: "grid", gap: 6 }}>
              {agenda.map((dayItem) => {
                const isToday = dayItem.day === today;
                return (
                  <div key={dayItem.day} className="mobileScheduleDayRow" style={isToday ? todayDayRow : dayRow}>
                    <div className="mobileScheduleDayLabel" style={dayLabelBlock}>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>{formatDayTitle(dayItem.day)}</div>
                    </div>
                    <div className="mobileScheduleTasksGrid" style={{ display: "grid", gap: 3, flex: 1, minWidth: 0 }}>
                      {dayItem.tasks.length === 0 && (
                        <div style={{ fontSize: 12, opacity: 0.4, fontStyle: "italic" }}>
                          {dayItem.isPastOrToday ? "No activity" : "Nothing planned"}
                        </div>
                      )}
                      {dayItem.tasks.map((task) => (
                        <div key={task.routineId} className={task.logged > 0 ? "mobileScheduleTaskItem mobileScheduleTaskDone" : "mobileScheduleTaskItem"} style={{ ...(task.logged > 0 ? completedTaskRow : taskRow), borderLeftColor: domainColor(task.domain ?? ""), borderLeftWidth: 3 }}>
                          <div style={taskRowTop}>
                            {task.latestLogId ? (
                              <Link
                                href={`/routines/${task.routineId}/logs/${task.latestLogId}?returnTo=${encodeURIComponent(`/schedule?start=${timelineStart}&month=${selectedMonth}`)}`}
                                style={taskLink}
                              >
                                {task.routineName}
                              </Link>
                            ) : (
                              <span style={{ fontWeight: 800 }}>{task.routineName}</span>
                            )}
                            <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                              {isToday && (
                                <Link
                                  href={`/routines/${task.routineId}/log?returnTo=${encodeURIComponent(`/schedule?start=${timelineStart}&month=${selectedMonth}`)}`}
                                  style={logBtn}
                                >
                                  Log
                                </Link>
                              )}
                              {task.removableManualEntryId ? (
                                <form action={removeManualEntry} style={{ display: "contents" }}>
                                  <input type="hidden" name="entryId" value={task.removableManualEntryId} />
                                  <input type="hidden" name="returnStart" value={timelineStart} />
                                  <input type="hidden" name="returnMonth" value={selectedMonth} />
                                  <button type="submit" style={removeBtn}>✕</button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <form action={quickAddManualEntry} className="mobileScheduleQuickAdd" style={quickAddForm}>
                      <input type="hidden" name="scheduledDate" value={dayItem.day} />
                      <input type="hidden" name="returnStart" value={timelineStart} />
                      <input type="hidden" name="returnMonth" value={selectedMonth} />
                      <select name="routineId" defaultValue="" style={quickAddSelect} required>
                        <option value="" disabled>Add routine…</option>
                        {routines.map((routine) => (
                          <option key={`${dayItem.day}-${routine.id}`} value={routine.id}>
                            {routine.name} ({routine.kind})
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="mobileScheduleQuickAddButton" style={quickAddBtn}>Add</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>MONTH HISTORY</div>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
              <div className="mobileScheduleToolbar" style={toolbar}>
                <div style={{ fontSize: 13, opacity: 0.82 }}>
                  Full month view for planning context and completed work.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={monthPill}>{formatMonthLabel(selectedMonth)}</div>
                </div>
              </div>
              <form method="get" className="mobileScheduleMonthPicker" style={monthPickerRow}>
                <input type="hidden" name="start" value={timelineStart} />
                <label style={monthPickerLabel}>
                  Month
                  <select name="month" defaultValue={selectedMonth} className="mobileScheduleMonthSelect" style={monthSelect}>
                    {monthOptions.map((month) => (
                      <option key={month} value={month}>
                        {formatMonthLabel(month)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" style={smallControlBtn}>Show Month</button>
              </form>
              <div className="mobileScheduleCalendarScroller">
                <div className="mobileScheduleCalendar" style={calendarWrap}>
                  {weekdays.map((weekday) => (
                    <div key={weekday} style={calendarWeekday}>{weekday}</div>
                  ))}
                  {monthCalendarCells.map((dayItem, index) =>
                    dayItem ? (
                      <div key={dayItem.day} style={calendarDay}>
                        <div style={dayNumberChip(dayItem.day === today)}>{Number(dayItem.day.slice(8, 10))}</div>
                        <div style={{ display: "grid", gap: 3 }}>
                          {dayItem.tasks.map((task) => (
                            <div key={task.routineId} style={{ ...(task.logged > 0 ? completedCalendarTaskRow : calendarTaskRow), borderLeft: `2px solid ${domainColor(task.domain ?? "")}` }}>
                              {task.latestLogId ? (
                                <Link
                                  href={`/routines/${task.routineId}/logs/${task.latestLogId}?returnTo=${encodeURIComponent(`/schedule?start=${timelineStart}&month=${selectedMonth}`)}`}
                                  style={calendarTaskLink}
                                >
                                  {task.routineName}
                                </Link>
                              ) : (
                                <div style={calendarTaskName}>{task.routineName}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div key={`empty-${index}`} style={calendarFiller} />
                    )
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {mode === "edit" && (
        <>
          <section style={panel}>
            <div style={panelHeader}>EDITOR</div>
            <div style={{ padding: 12, fontSize: 13, opacity: 0.82 }}>
              Build the day-by-day plan here. The editor currently focuses on manual placement so scheduling stays fast and predictable.
            </div>
          </section>

          <section style={{ ...panel, marginTop: 14 }}>
            <div style={panelHeader}>SCHEDULE BOARD</div>
            <div style={{ padding: 14 }}>
              <ScheduleBoard routines={routinesWithPlanned} manualEntries={manualEntries} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const container: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 20 };
const topRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 };
const title: React.CSSProperties = { fontSize: 26, fontWeight: 900, margin: 0 };
const subText: React.CSSProperties = { marginTop: 6, opacity: 0.75, fontSize: 13 };

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.3,
};

const dayRow: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 10,
  padding: "8px 10px",
  background: "rgba(128,128,128,0.04)",
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const todayDayRow: React.CSSProperties = {
  ...dayRow,
  border: "1px solid rgba(84,203,130,0.45)",
  background: "rgba(84,203,130,0.05)",
};

const dayLabelBlock: React.CSSProperties = {
  minWidth: 160,
  flexShrink: 0,
};

const taskRow: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 7,
  padding: "4px 8px",
  background: "rgba(128,128,128,0.06)",
};

const logBtn: React.CSSProperties = {
  padding: "1px 7px",
  border: "1px solid rgba(84,203,130,0.5)",
  borderRadius: 999,
  background: "rgba(84,203,130,0.12)",
  color: "rgba(84,203,130,1)",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: "14px",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const completedTaskRow: React.CSSProperties = {
  ...taskRow,
  border: "1px solid rgba(84,203,130,0.5)",
  background: "rgba(84,203,130,0.10)",
};

const taskRowTop: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const taskLink: React.CSSProperties = {
  fontWeight: 800,
  color: "inherit",
  textDecoration: "none",
};

const input: React.CSSProperties = {
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const smallControlBtn: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.10)",
  fontSize: 12,
};

const weekStrip: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "10px 12px",
  width: "max-content",
  minWidth: "100%",
};

const weekPill: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 700,
  background: "rgba(128,128,128,0.07)",
  fontSize: 12,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const activeWeekPill: React.CSSProperties = {
  ...weekPill,
  border: "1px solid rgba(84,203,130,0.7)",
  background: "rgba(84,203,130,0.14)",
  color: "rgba(84,203,130,1)",
  fontWeight: 900,
};

const quickAddForm: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "stretch",
  minWidth: 220,
};

const quickAddSelect: React.CSSProperties = {
  ...input,
  minWidth: 0,
  padding: "7px 9px",
  fontSize: 12,
};

const quickAddBtn: React.CSSProperties = {
  ...smallControlBtn,
  padding: "7px 11px",
  cursor: "pointer",
  alignSelf: "flex-end",
};

const removeBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 18,
  minWidth: 0,
  minHeight: 0,
  padding: 0,
  border: "1px solid rgba(255,80,80,0.5)",
  borderRadius: 999,
  background: "rgba(255,80,80,0.10)",
  color: "inherit",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
  appearance: "none",
  WebkitAppearance: "none",
};

const monthPill: React.CSSProperties = {
  padding: "7px 11px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 12,
  fontWeight: 800,
};

const monthPickerRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "end",
  flexWrap: "wrap",
};

const monthPickerLabel: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
};

const monthSelect: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  minWidth: 220,
};

const calendarWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const calendarWeekday: React.CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
  opacity: 0.72,
  padding: "2px 0",
};

const calendarDay: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 8,
  padding: 5,
  minHeight: 72,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  alignContent: "start",
  gap: 4,
};

const calendarFiller: React.CSSProperties = {};


const calendarTaskRow: React.CSSProperties = {
  borderRadius: 5,
  padding: "3px 5px",
  background: "rgba(128,128,128,0.1)",
  fontSize: 11,
  overflow: "hidden",
};

const completedCalendarTaskRow: React.CSSProperties = {
  ...calendarTaskRow,
  background: "rgba(84,203,130,0.18)",
};


const calendarTaskLink: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 11,
  color: "inherit",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
  flexShrink: 1,
};

const calendarTaskName: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
  flexShrink: 1,
};

function dayNumberChip(isToday: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    background: isToday ? "rgba(84,203,130,0.2)" : "transparent",
    border: isToday ? "1px solid rgba(84,203,130,0.75)" : "none",
    color: isToday ? "rgba(84,203,130,1)" : "inherit",
  };
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
