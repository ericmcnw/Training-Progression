import { startOfWeekMonday as getMondayOf } from "@/lib/week";

export type HeatmapEvent = {
  date: Date;
  label: string;
  href?: string;
  sublabel?: string;
};

export type HeatmapWeek = {
  weekStart: Date;
  monthLabel: string | null;
  sessions: HeatmapEvent[];
  training: HeatmapEvent[];
};

export type SessionEventInput = {
  id: string;
  routineId: string;
  performedAt: Date;
  routineName: string;
  venueLabel?: string | null;
};

export type TrainingEventInput = {
  id: string;
  routineId: string;
  performedAt: Date;
  routineName: string;
};

function logHref(routineId: string, logId: string) {
  return `/routines/${routineId}/logs/${logId}/details`;
}

export function buildWeeklyGrid(
  sessions: SessionEventInput[],
  trainings: TrainingEventInput[],
  now: Date
): HeatmapWeek[] {
  const sessionWeekMap = new Map<string, SessionEventInput[]>();
  for (const s of sessions) {
    const k = getMondayOf(s.performedAt).toISOString().slice(0, 10);
    const list = sessionWeekMap.get(k) ?? [];
    list.push(s);
    sessionWeekMap.set(k, list);
  }

  const trainWeekMap = new Map<string, TrainingEventInput[]>();
  for (const t of trainings) {
    const k = getMondayOf(t.performedAt).toISOString().slice(0, 10);
    const list = trainWeekMap.get(k) ?? [];
    list.push(t);
    trainWeekMap.set(k, list);
  }

  const allKeys = [...sessionWeekMap.keys(), ...trainWeekMap.keys()];
  if (allKeys.length === 0) return [];

  const thisWeek = getMondayOf(now);
  const maxLookback = new Date(thisWeek.getTime() - 52 * 7 * 24 * 60 * 60 * 1000);
  const earliestKey = allKeys.reduce((min, k) => (k < min ? k : min));
  const startDate = new Date(earliestKey) < maxLookback ? maxLookback : new Date(earliestKey);

  const result: HeatmapWeek[] = [];
  let current = new Date(startDate);
  let prevMonth = -1;

  while (current <= thisWeek) {
    const k = current.toISOString().slice(0, 10);
    const month = current.getMonth();
    const sessionEntries = sessionWeekMap.get(k) ?? [];
    const trainEntries = trainWeekMap.get(k) ?? [];
    result.push({
      weekStart: new Date(current),
      monthLabel: month !== prevMonth ? current.toLocaleDateString("en-US", { month: "short" }) : null,
      sessions: sessionEntries.map((s) => ({
        date: s.performedAt,
        label: s.routineName,
        sublabel: s.venueLabel ?? undefined,
        href: logHref(s.routineId, s.id),
      })),
      training: trainEntries.map((t) => ({
        date: t.performedAt,
        label: t.routineName,
        href: logHref(t.routineId, t.id),
      })),
    });
    prevMonth = month;
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return result;
}
