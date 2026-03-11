import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ScheduleBoard from "./ScheduleBoard";
import CycleBuilder from "./CycleBuilder";
import { createCyclePlan, quickAddManualEntry, setCycleActivation, updateCyclePlan } from "./actions";

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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toYmd(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: string, plus: number) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + plus);
  return date.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string) {
  const at = new Date(`${a}T00:00:00.000Z`).getTime();
  const bt = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.floor((at - bt) / 86400000);
}

function formatDayTitle(ymd: string) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  const weekday = date.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  const md = date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
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

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedPlanId = getParam(params?.planId);
  const mode = getParam(params?.mode) === "edit" ? "edit" : "view";
  const editTab = getParam(params?.tab) === "cycles" ? "cycles" : "board";
  const today = todayLocalYmd();
  const requestedStart = getParam(params?.start);
  const timelineStart = isYmd(requestedStart) ? requestedStart! : addDays(today, -7);
  const selectedMonth = isMonthParam(getParam(params?.month)) ? getParam(params?.month)! : monthFromYmd(today);

  const [plansRaw, entriesRaw, activationsRaw, routines, manualRaw, logRange] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; cycleLengthDays: number; isActive: number | boolean; createdAt: string }>
    >('SELECT "id","name","cycleLengthDays","isActive","createdAt" FROM "SchedulePlan" ORDER BY "createdAt" ASC'),
    prisma.$queryRawUnsafe<Array<{ id: string; schedulePlanId: string; routineId: string; dayOffset: number; sortOrder: number }>>(
      'SELECT "id","schedulePlanId","routineId","dayOffset","sortOrder" FROM "ScheduleEntry" ORDER BY "dayOffset" ASC, "sortOrder" ASC'
    ),
    prisma.$queryRawUnsafe<Array<{ schedulePlanId: string; isEnabled: number | boolean; startDate: string }>>(
      'SELECT "schedulePlanId","isEnabled","startDate" FROM "SchedulePlanActivation"'
    ),
    prisma.routine.findMany({
      where: { isDeleted: false },
      orderBy: [{ isActive: "desc" }, { kind: "asc" }, { category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, category: true, timesPerWeek: true },
    }),
    prisma.$queryRawUnsafe<Array<{ id: string; routineId: string; scheduledDate: string; sortOrder: number }>>(
      'SELECT "id","routineId","scheduledDate","sortOrder" FROM "ScheduleManualEntry" ORDER BY "scheduledDate" ASC, "sortOrder" ASC'
    ),
    prisma.routineLog.aggregate({
      _min: { performedAt: true },
      _max: { performedAt: true },
    }),
  ]);

  const activationMap = new Map(
    activationsRaw.map((row) => [row.schedulePlanId, { isEnabled: Boolean(row.isEnabled), startDate: toYmd(row.startDate) }])
  );

  const plans = plansRaw.map((plan) => ({
    id: plan.id,
    name: plan.name,
    cycleLengthDays: Number(plan.cycleLengthDays),
    isActive: Boolean(plan.isActive),
    activation: activationMap.get(plan.id) ?? { isEnabled: false, startDate: toYmd(new Date()) },
    entries: entriesRaw
      .filter((entry) => entry.schedulePlanId === plan.id)
      .map((entry) => ({
        id: entry.id,
        routineId: entry.routineId,
        dayOffset: Number(entry.dayOffset),
        sortOrder: Number(entry.sortOrder),
      })),
  }));

  const selectedPlanId =
    (requestedPlanId && plans.find((plan) => plan.id === requestedPlanId)?.id) ||
    plans.find((plan) => plan.isActive)?.id ||
    plans[0]?.id ||
    "";
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const activeCycles = plans
    .filter((plan) => plan.activation.isEnabled)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      cycleLengthDays: plan.cycleLengthDays,
      isEnabled: plan.activation.isEnabled,
      startDate: plan.activation.startDate,
      entries: plan.entries.map((entry) => ({
        routineId: entry.routineId,
        dayOffset: entry.dayOffset,
        sortOrder: entry.sortOrder,
      })),
    }));

  const manualEntries = manualRaw.map((entry) => ({
    id: entry.id,
    routineId: entry.routineId,
    scheduledDate: toYmd(entry.scheduledDate),
    sortOrder: Number(entry.sortOrder),
  }));

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const routinePlannedDaysMap = new Map<string, number>();
  for (const day of next7Days) {
    const ids = new Set<string>();
    for (const manual of manualEntries) {
      if (manual.scheduledDate === day) ids.add(manual.routineId);
    }
    for (const cycle of activeCycles) {
      const diff = dayDiff(day, cycle.startDate);
      if (diff < 0 || cycle.cycleLengthDays <= 0) continue;
      const offset = diff % cycle.cycleLengthDays;
      for (const entry of cycle.entries) {
        if (entry.dayOffset === offset) ids.add(entry.routineId);
      }
    }
    for (const id of ids) {
      routinePlannedDaysMap.set(id, (routinePlannedDaysMap.get(id) ?? 0) + 1);
    }
  }
  const routinesWithPlanned = routines.map((routine) => ({
    ...routine,
    suggestedTimesPerWeek: routine.timesPerWeek ?? 0,
    plannedDaysPerWeek: routinePlannedDaysMap.get(routine.id) ?? 0,
  }));

  const routineNameMap = new Map(routines.map((routine) => [routine.id, routine.name]));
  const timelineDays = buildAgendaDays(timelineStart, 21);
  const timelineEnd = addDays(timelineStart, 21);
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = addDays(startOfMonth(addMonths(selectedMonth, 1)), 0);
  const monthDays = buildAgendaDays(monthStart, dayDiff(monthEnd, monthStart));
  const logStart = timelineStart < monthStart ? timelineStart : monthStart;
  const logEnd = timelineEnd > monthEnd ? timelineEnd : monthEnd;

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: {
        gte: new Date(`${logStart}T00:00:00.000Z`),
        lt: new Date(`${logEnd}T00:00:00.000Z`),
      },
    },
    select: { routineId: true, performedAt: true },
  });

  const loggedMap = new Map<string, number>();
  const loggedByDay = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const day = toYmd(log.performedAt);
    const key = `${day}|${log.routineId}`;
    loggedMap.set(key, (loggedMap.get(key) ?? 0) + 1);
    if (!loggedByDay.has(day)) loggedByDay.set(day, new Map());
    const dayLogs = loggedByDay.get(day)!;
    dayLogs.set(log.routineId, (dayLogs.get(log.routineId) ?? 0) + 1);
  }

  function buildAgenda(days: string[]) {
    return days.map((day) => {
      const plannedCounts = new Map<string, number>();

      for (const manual of manualEntries) {
        if (manual.scheduledDate !== day) continue;
        plannedCounts.set(manual.routineId, (plannedCounts.get(manual.routineId) ?? 0) + 1);
      }

      for (const cycle of activeCycles) {
        const diff = dayDiff(day, cycle.startDate);
        if (diff < 0 || cycle.cycleLengthDays <= 0) continue;
        const offset = diff % cycle.cycleLengthDays;
        for (const entry of cycle.entries) {
          if (entry.dayOffset !== offset) continue;
          plannedCounts.set(entry.routineId, (plannedCounts.get(entry.routineId) ?? 0) + 1);
        }
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
          return {
            routineId,
            routineName: routineNameMap.get(routineId) ?? routineId,
            planned,
            logged,
            remaining: Math.max(0, planned - logged),
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
  const timelinePrevHref = `/schedule?start=${addDays(timelineStart, -7)}&month=${selectedMonth}`;
  const timelineNextHref = `/schedule?start=${addDays(timelineStart, 7)}&month=${selectedMonth}`;
  const timelineTodayHref = `/schedule?start=${addDays(today, -7)}&month=${monthFromYmd(today)}`;

  const rangeStartLabel = formatDayTitle(timelineDays[0]);
  const rangeEndLabel = formatDayTitle(timelineDays[timelineDays.length - 1]);

  const earliestKnownYmd = [
    manualEntries[0]?.scheduledDate,
    ...activeCycles.map((cycle) => cycle.startDate),
    logRange._min.performedAt ? toYmd(logRange._min.performedAt) : undefined,
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
          <div style={subText}>Rolling schedule context plus a month browser so you can plan from recent history without cluttering the main board.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {mode === "view" ? (
            <Link href="/schedule?mode=edit" style={linkBtn}>
              Open Schedule Editor
            </Link>
          ) : (
            <Link href="/schedule" style={linkBtn}>
              Back To Schedule
            </Link>
          )}
          <Link href="/routines" style={linkBtn}>View Routines</Link>
        </div>
      </div>

      {mode === "view" && (
        <>
          <section style={panel}>
            <div style={panelHeader}>ROLLING TIMELINE</div>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
              <div className="mobileScheduleToolbar" style={toolbar}>
                <div style={{ fontSize: 13, opacity: 0.82 }}>
                  Showing {rangeStartLabel} through {rangeEndLabel}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={timelinePrevHref} style={smallControlBtn}>Previous Week</Link>
                  <Link href={timelineTodayHref} style={smallControlBtn}>Today Focus</Link>
                  <Link href={timelineNextHref} style={smallControlBtn}>Next Week</Link>
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {agenda.map((dayItem) => (
                  <div key={dayItem.day} className="mobileScheduleDayRow" style={dayRow}>
                    <div className="mobileScheduleDayLabel" style={{ minWidth: 190 }}>
                      <div style={{ fontWeight: 900 }}>{formatDayTitle(dayItem.day)}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{dayItem.day}</div>
                    </div>
                    <div style={{ display: "grid", gap: 6, flex: 1 }}>
                      {dayItem.tasks.length === 0 && (
                        <div style={{ fontSize: 13, opacity: 0.65 }}>
                          {dayItem.isPastOrToday ? "No routines planned or completed." : "No routines planned."}
                        </div>
                      )}
                      {dayItem.tasks.map((task) => (
                        <div key={task.routineId} style={task.logged > 0 ? completedTaskRow : taskRow}>
                          <div style={{ fontWeight: 800 }}>{task.routineName}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>
                            Planned: {task.planned} | Logged: {task.logged} | Remaining: {task.remaining}
                          </div>
                        </div>
                      ))}
                    </div>
                    <form action={quickAddManualEntry} className="mobileScheduleQuickAdd" style={quickAddForm}>
                      <input type="hidden" name="scheduledDate" value={dayItem.day} />
                      <input type="hidden" name="returnStart" value={timelineStart} />
                      <input type="hidden" name="returnMonth" value={selectedMonth} />
                      <select name="routineId" defaultValue="" style={quickAddSelect} required>
                        <option value="" disabled>
                          Quick add routine
                        </option>
                        {routines.map((routine) => (
                          <option key={`${dayItem.day}-${routine.id}`} value={routine.id}>
                            {routine.name} | {routine.category || "General"} | {routine.kind}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="mobileScheduleQuickAddButton" style={quickAddBtn}>Add</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>MONTH HISTORY</div>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
              <div className="mobileScheduleToolbar" style={toolbar}>
                <div style={{ fontSize: 13, opacity: 0.82 }}>
                  Full month view for schedule history and planning context.
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
                      <div style={calendarDayHeader}>
                        <div style={dayNumberChip(dayItem.day === today)}>{Number(dayItem.day.slice(8, 10))}</div>
                        <div style={{ fontSize: 11, opacity: 0.72 }}>{dayItem.day}</div>
                      </div>
                      <form action={quickAddManualEntry} style={calendarQuickAddForm}>
                        <input type="hidden" name="scheduledDate" value={dayItem.day} />
                        <input type="hidden" name="returnStart" value={timelineStart} />
                        <input type="hidden" name="returnMonth" value={selectedMonth} />
                        <select name="routineId" defaultValue="" style={calendarQuickAddSelect} required>
                          <option value="" disabled>
                            Add routine
                          </option>
                          {routines.map((routine) => (
                            <option key={`calendar-${dayItem.day}-${routine.id}`} value={routine.id}>
                              {routine.name} | {routine.category || "General"} | {routine.kind}
                            </option>
                          ))}
                        </select>
                        <button type="submit" style={calendarQuickAddBtn}>+</button>
                      </form>
                      <div style={{ display: "grid", gap: 6 }}>
                        {dayItem.tasks.length === 0 && (
                          <div style={calendarEmptyText}>
                            {dayItem.isPastOrToday ? "No routines planned or completed." : "No routines planned."}
                          </div>
                        )}
                        {dayItem.tasks.map((task) => (
                          <div key={task.routineId} style={task.logged > 0 ? completedCalendarTaskRow : calendarTaskRow}>
                            <div style={{ fontWeight: 800 }}>{task.routineName}</div>
                            <div style={{ fontSize: 11, opacity: 0.85 }}>
                              Planned: {task.planned} | Logged: {task.logged}
                            </div>
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
            <div className="mobileScheduleInlineRow" style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/schedule?mode=edit&tab=board" style={editTab === "board" ? tabBtnActive : tabBtn}>
                Schedule Board
              </Link>
              <Link href="/schedule?mode=edit&tab=cycles" style={editTab === "cycles" ? tabBtnActive : tabBtn}>
                Cycle Builder
              </Link>
            </div>
          </section>

          {editTab === "board" && (
            <>
              {plans.length > 0 && (
                <section style={panel}>
                  <div style={panelHeader}>CYCLES</div>
                  <div style={{ padding: 14, display: "grid", gap: 8 }}>
                    {plans.map((plan) => (
                      <div key={plan.id} style={planRow}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>
                          {plan.name} ({plan.cycleLengthDays} days)
                        </div>
                        <form action={setCycleActivation} className="mobileScheduleInlineRow" style={row}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="returnMode" value="edit" />
                          <label style={inlineLabel}>
                            <input name="isEnabled" type="checkbox" defaultChecked={plan.activation.isEnabled} />
                            Enabled
                          </label>
                          <label style={inlineLabel}>
                            Start
                            <input name="startDate" type="date" defaultValue={plan.activation.startDate} style={input} />
                          </label>
                          <button type="submit" style={btn}>Save</button>
                        </form>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section style={{ ...panel, marginTop: 14 }}>
                <div style={panelHeader}>SCHEDULE BOARD</div>
                <div style={{ padding: 14 }}>
                  <ScheduleBoard
                    routines={routinesWithPlanned}
                    cycles={plans.map((plan) => ({
                      id: plan.id,
                      name: plan.name,
                      cycleLengthDays: plan.cycleLengthDays,
                      startDate: plan.activation.startDate,
                      isEnabled: plan.activation.isEnabled,
                      entries: plan.entries.map((entry) => ({
                        routineId: entry.routineId,
                        dayOffset: entry.dayOffset,
                        sortOrder: entry.sortOrder,
                      })),
                    }))}
                    manualEntries={manualEntries}
                  />
                </div>
              </section>
            </>
          )}

          {editTab === "cycles" && (
            <>
              <section style={panel}>
                <div style={panelHeader}>CREATE CYCLE</div>
                <div style={{ padding: 14 }}>
                  <form action={createCyclePlan} className="mobileScheduleInlineRow" style={row}>
                    <input type="hidden" name="returnMode" value="edit" />
                    <input name="name" placeholder="Cycle name" style={{ ...input, minWidth: 180 }} />
                    <label style={inlineLabel}>
                      Length (days)
                      <input name="cycleLengthDays" type="number" min={1} max={60} defaultValue={7} style={{ ...input, width: 90 }} />
                    </label>
                    <label style={inlineLabel}>
                      Start day
                      <input name="startDate" type="date" defaultValue={toYmd(new Date())} style={input} />
                    </label>
                    <button type="submit" style={btn}>+ Create Cycle</button>
                  </form>
                </div>
              </section>

              {plans.length > 0 && (
                <section style={{ ...panel, marginTop: 14 }}>
                  <div style={panelHeader}>EDIT CYCLE</div>
                  <div style={{ padding: 14, display: "grid", gap: 10 }}>
                    <div className="mobileScheduleInlineRow" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {plans.map((plan) => (
                        <Link key={plan.id} href={`/schedule?mode=edit&tab=cycles&planId=${plan.id}`} style={smallLink}>
                          {selectedPlanId === plan.id ? "[Editing]" : "[Open]"} {plan.name}
                        </Link>
                      ))}
                    </div>

                    {selectedPlan && (
                      <>
                        <form action={updateCyclePlan} className="mobileScheduleInlineRow" style={row}>
                          <input type="hidden" name="planId" value={selectedPlan.id} />
                          <input type="hidden" name="returnMode" value="edit" />
                          <input name="name" defaultValue={selectedPlan.name} style={{ ...input, minWidth: 200 }} />
                          <label style={inlineLabel}>
                            Length (days)
                            <input name="cycleLengthDays" type="number" min={1} max={60} defaultValue={selectedPlan.cycleLengthDays} style={{ ...input, width: 90 }} />
                          </label>
                          <button type="submit" style={btn}>Save Settings</button>
                        </form>

                        <CycleBuilder
                          planId={selectedPlan.id}
                          cycleLengthDays={selectedPlan.cycleLengthDays}
                          routines={routines}
                          initialEntries={selectedPlan.entries}
                        />
                      </>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
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
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(128,128,128,0.06)",
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const taskRow: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 8,
  padding: 8,
  background: "rgba(128,128,128,0.05)",
};

const completedTaskRow: React.CSSProperties = {
  ...taskRow,
  border: "1px solid rgba(84,203,130,0.75)",
  background: "rgba(84,203,130,0.12)",
  boxShadow: "0 0 0 1px rgba(84,203,130,0.18), 0 0 14px rgba(84,203,130,0.22)",
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const planRow: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 10,
  padding: 10,
  display: "grid",
  gap: 8,
};

const input: React.CSSProperties = {
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
};

const btn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
};

const inlineLabel: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 12,
  fontWeight: 700,
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

const smallLink: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  fontSize: 13,
};

const tabBtn: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.1)",
  fontSize: 13,
};

const tabBtnActive: React.CSSProperties = {
  ...tabBtn,
  background: "rgba(255,255,255,0.18)",
  borderColor: "rgba(255,255,255,0.65)",
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
  gap: 8,
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
  borderRadius: 12,
  padding: 8,
  minHeight: 148,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  alignContent: "start",
  gap: 8,
};

const calendarFiller: React.CSSProperties = {
  minHeight: 148,
};

const calendarDayHeader: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const calendarQuickAddForm: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const calendarQuickAddSelect: React.CSSProperties = {
  ...input,
  minWidth: 0,
  flex: 1,
  padding: "6px 8px",
  fontSize: 11,
};

const calendarQuickAddBtn: React.CSSProperties = {
  ...smallControlBtn,
  padding: "6px 9px",
  cursor: "pointer",
};

const calendarTaskRow: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 8,
  padding: "7px 8px",
  background: "rgba(128,128,128,0.05)",
  fontSize: 12,
};

const completedCalendarTaskRow: React.CSSProperties = {
  ...calendarTaskRow,
  border: "1px solid rgba(84,203,130,0.75)",
  background: "rgba(84,203,130,0.12)",
  boxShadow: "0 0 0 1px rgba(84,203,130,0.16), 0 0 10px rgba(84,203,130,0.18)",
};

const calendarEmptyText: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.58,
};

function dayNumberChip(isToday: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    background: isToday ? "rgba(84,203,130,0.18)" : "rgba(255,255,255,0.08)",
    border: isToday ? "1px solid rgba(84,203,130,0.75)" : "1px solid rgba(255,255,255,0.12)",
  };
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
