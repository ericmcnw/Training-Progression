import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { addDaysYmd, getAppDayRange, toAppYmd, todayAppYmd } from "@/lib/dates";
import { getLogsInWindow } from "@/lib/logs-window";
import { getHomeInjuries } from "@/lib/home-injuries";
import { getMonthData } from "@/app/plan/month/data";
import type { RoutineDomain } from "@/lib/routines";

// Read-only tools for the AI coach. Every tool clamps its window so a single
// call can't stuff unbounded rows into the model's context, and every read
// routes through the same session seam as the UI loaders.

const MAX_WINDOW_DAYS = 90;
const MAX_LOG_ROWS = 200;
const MAX_PAIN_ROWS = 250;
const NOTE_CHARS = 240;

const DOMAIN_VALUES = ["strength", "cardio", "mobility", "sport", "lifestyle"] as const;

function clampDays(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, n));
}

function trimNote(note: string | null): string | undefined {
  const t = note?.trim();
  if (!t) return undefined;
  return t.length > NOTE_CHARS ? `${t.slice(0, NOTE_CHARS)}…` : t;
}

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_recent_logs",
    description:
      "Eric's logged training sessions over a recent window (all activity: strength routines, endurance, sports, climbing, mobility, PT). Returns one row per session with date (America/New_York), resolved activity name, domain, minutes, miles, effort (1-10) and notes. Use before any training recommendation.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Window size in days ending today (1-90). Default 14.",
        },
        domain: {
          type: "string",
          enum: [...DOMAIN_VALUES],
          description: "Optional filter to one training domain. 'cardio' = endurance.",
        },
      },
    },
  },
  {
    name: "get_injury_status",
    description:
      "Eric's currently active/flared injuries: name, status, affected zones, known aggravating factors, latest pain reading, today's reading (null = not logged yet today), and a 16-day per-day max pain sparkline.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_schedule",
    description:
      "What's planned from today forward: per day, the scheduled/auto-scheduled routines with status (planned/done/partial/missed), away/travel spans, and todos. Use to align recommendations with the plan.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: {
          type: "integer",
          description: "How many days to look ahead including today (1-21). Default 7.",
        },
      },
    },
  },
  {
    name: "get_routine_progress",
    description:
      "Recent sessions of one routine by name (e.g. 'Legs A', 'PT', 'Fingers'): per session date, duration, notes, and every exercise with its sets (reps / seconds / weight lb). The ground truth for progression questions like 'are my curls climbing?'.",
    input_schema: {
      type: "object",
      properties: {
        routine: { type: "string", description: "Routine name or fragment, case-insensitive." },
        sessions: { type: "integer", description: "How many recent sessions (1-10). Default 5." },
      },
      required: ["routine"],
    },
  },
  {
    name: "get_exercise_history",
    description:
      "Set-by-set history for one exercise by name (e.g. 'Single-Leg Hamstring Curl', 'Weighted Pull-Up') across all routines: per session date, routine, and sets (reps / seconds / weight lb), plus best weight and best reps in the window. Use for PR and loading-progression questions.",
    input_schema: {
      type: "object",
      properties: {
        exercise: { type: "string", description: "Exercise name or fragment, case-insensitive." },
        sessions: { type: "integer", description: "How many recent sessions (1-20). Default 10." },
      },
      required: ["exercise"],
    },
  },
  {
    name: "get_pain_trend",
    description:
      "Eric's pain log over a recent window: date, body zone, level (0-10), context (AT_REST / DURING_ACTIVITY / AFTER_ACTIVITY / MORNING / GENERAL), aggravating factors, notes. MORNING entries are the ground truth for whether yesterday's load settled. Use before any training recommendation.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Window size in days ending today (1-90). Default 28.",
        },
        zone: {
          type: "string",
          description:
            "Optional body-zone filter, matched against zone names (e.g. 'hamstring', 'knee').",
        },
      },
    },
  },
];

type LogRow = {
  date: string;
  name: string;
  domain: RoutineDomain;
  minutes?: number;
  miles?: number;
  elevationFt?: number;
  effort?: number;
  notes?: string;
};

async function getRecentLogs(input: Record<string, unknown>) {
  const days = clampDays(input.days, 14);
  const domain = DOMAIN_VALUES.includes(input.domain as (typeof DOMAIN_VALUES)[number])
    ? (input.domain as RoutineDomain)
    : undefined;

  const toYmd = todayAppYmd();
  const fromYmd = addDaysYmd(toYmd, -(days - 1));
  const rows = await getLogsInWindow({
    fromYmd,
    toYmd,
    ...(domain ? { domains: [domain] } : {}),
  });

  const truncated = rows.length > MAX_LOG_ROWS;
  const sessions: LogRow[] = rows.slice(-MAX_LOG_ROWS).map((row) => ({
    date: row.ymd,
    name: row.displayName,
    domain: row.domain,
    ...(row.durationSec ? { minutes: Math.round(row.durationSec / 60) } : {}),
    ...(row.distanceMi ? { miles: Math.round(row.distanceMi * 100) / 100 } : {}),
    ...(row.elevationGainFt ? { elevationFt: Math.round(row.elevationGainFt) } : {}),
    ...(row.effort != null ? { effort: row.effort } : {}),
    ...(trimNote(row.notes) ? { notes: trimNote(row.notes) } : {}),
  }));

  return {
    window: { from: fromYmd, to: toYmd, days },
    ...(domain ? { domain } : {}),
    sessionCount: rows.length,
    ...(truncated ? { note: `showing most recent ${MAX_LOG_ROWS} of ${rows.length}` } : {}),
    sessions,
  };
}

async function getPainTrend(input: Record<string, unknown>) {
  const days = clampDays(input.days, 28);
  const zoneQuery = typeof input.zone === "string" ? input.zone.trim() : "";

  await getAppSession(); // scope seam — no-op in single-user mode

  const toYmd = todayAppYmd();
  const fromYmd = addDaysYmd(toYmd, -(days - 1));
  const start = getAppDayRange(fromYmd).start;
  const end = getAppDayRange(toYmd).end;

  const logs = await prisma.painLog.findMany({
    where: {
      loggedAt: { gte: start, lt: end },
      ...(zoneQuery
        ? {
            zone: {
              OR: [
                { label: { contains: zoneQuery, mode: "insensitive" } },
                { slug: { contains: zoneQuery.toLowerCase() } },
              ],
            },
          }
        : {}),
    },
    orderBy: { loggedAt: "desc" },
    take: MAX_PAIN_ROWS,
    select: {
      loggedAt: true,
      level: true,
      context: true,
      aggravatingFactors: true,
      notes: true,
      zone: { select: { label: true, side: true } },
    },
  });

  const entries = logs
    .map((log) => ({
      date: toAppYmd(log.loggedAt),
      zone: `${log.zone.side === "LEFT" ? "Left " : log.zone.side === "RIGHT" ? "Right " : ""}${log.zone.label}`,
      level: log.level,
      context: log.context,
      ...(log.aggravatingFactors.length ? { factors: log.aggravatingFactors } : {}),
      ...(trimNote(log.notes) ? { notes: trimNote(log.notes) } : {}),
    }))
    .reverse();

  return {
    window: { from: fromYmd, to: toYmd, days },
    ...(zoneQuery ? { zoneFilter: zoneQuery } : {}),
    entryCount: entries.length,
    ...(logs.length === MAX_PAIN_ROWS ? { note: `showing most recent ${MAX_PAIN_ROWS} entries` } : {}),
    entries,
  };
}

async function getInjuryStatus() {
  await getAppSession(); // scope seam — no-op in single-user mode
  const injuries = await getHomeInjuries();
  return {
    activeInjuries: injuries.map((injury) => ({
      name: injury.name,
      status: injury.status,
      zones: injury.zones.map((z) => z.label),
      aggravatingFactors: injury.aggravatingFactors,
      latestPain: injury.recentPainScore,
      todayReading: injury.todayReadingLevel,
      dailyMaxTrend: injury.painTrend,
    })),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function getSchedule(input: Record<string, unknown>) {
  const daysAhead = clampInt(input.days_ahead, 1, 21, 7);
  const today = todayAppYmd();
  const endYmd = addDaysYmd(today, daysAhead - 1);

  const months = [getMonthData(today.slice(0, 7))];
  if (endYmd.slice(0, 7) !== today.slice(0, 7)) months.push(getMonthData(endYmd.slice(0, 7)));
  const monthData = await Promise.all(months);

  const days = monthData
    .flatMap((m) => m.days)
    .filter((d) => d.ymd >= today && d.ymd <= endYmd)
    .map((d) => ({
      date: d.ymd,
      ...(d.isToday ? { isToday: true } : {}),
      planned: d.entries.map((e) => ({
        name: e.routineName,
        domain: e.domain,
        status: e.status,
        ...(e.isHabit ? { habit: true } : {}),
      })),
      ...(d.spans.length ? { away: d.spans.map((s) => `${s.label} (${s.startYmd}→${s.endYmd})`) } : {}),
      ...(d.todos.length ? { todos: d.todos.map((t) => ({ label: t.label, done: t.done })) } : {}),
    }));

  return { window: { from: today, to: endYmd }, days };
}

type SetSummary = { set: number; reps?: number; seconds?: number; weightLb?: number };

function summarizeSets(sets: Array<{ setNumber: number; reps: number | null; seconds: number | null; weightLb: number | null }>): SetSummary[] {
  return sets
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => ({
      set: s.setNumber,
      ...(s.reps != null ? { reps: s.reps } : {}),
      ...(s.seconds != null ? { seconds: s.seconds } : {}),
      ...(s.weightLb != null ? { weightLb: s.weightLb } : {}),
    }));
}

async function getRoutineProgress(input: Record<string, unknown>) {
  const query = typeof input.routine === "string" ? input.routine.trim() : "";
  if (!query) return { error: "routine is required" };
  const sessionCount = clampInt(input.sessions, 1, 10, 5);
  await getAppSession(); // scope seam — no-op in single-user mode

  const matches = await prisma.routine.findMany({
    where: { isDeleted: false, name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 6,
  });
  if (matches.length === 0) return { error: `No routine matching "${query}".` };
  if (matches.length > 1) {
    const exact = matches.find((m) => m.name.toLowerCase() === query.toLowerCase());
    if (!exact) return { ambiguous: matches.map((m) => m.name) };
    matches.splice(0, matches.length, exact);
  }
  const routine = matches[0];

  const logs = await prisma.routineLog.findMany({
    where: { routineId: routine.id },
    orderBy: { performedAt: "desc" },
    take: sessionCount,
    select: {
      performedAt: true,
      durationSec: true,
      notes: true,
      exercises: {
        select: {
          exercise: { select: { name: true } },
          sets: { select: { setNumber: true, reps: true, seconds: true, weightLb: true } },
        },
      },
    },
  });

  return {
    routine: routine.name,
    sessions: logs
      .map((log) => ({
        date: toAppYmd(log.performedAt),
        ...(log.durationSec ? { minutes: Math.round(log.durationSec / 60) } : {}),
        ...(log.notes?.trim() ? { notes: log.notes.trim().slice(0, NOTE_CHARS) } : {}),
        exercises: log.exercises.map((se) => ({
          name: se.exercise.name,
          sets: summarizeSets(se.sets),
        })),
      }))
      .reverse(),
  };
}

async function getExerciseHistory(input: Record<string, unknown>) {
  const query = typeof input.exercise === "string" ? input.exercise.trim() : "";
  if (!query) return { error: "exercise is required" };
  const sessionCount = clampInt(input.sessions, 1, 20, 10);
  await getAppSession(); // scope seam — no-op in single-user mode

  const matches = await prisma.exercise.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, unit: true, isUnilateral: true },
    take: 8,
  });
  if (matches.length === 0) return { error: `No exercise matching "${query}".` };
  let exercise = matches[0];
  if (matches.length > 1) {
    const exact = matches.find((m) => m.name.toLowerCase() === query.toLowerCase());
    if (!exact) return { ambiguous: matches.map((m) => m.name) };
    exercise = exact;
  }

  const entries = await prisma.sessionExercise.findMany({
    where: { exerciseId: exercise.id },
    orderBy: { routineLog: { performedAt: "desc" } },
    take: sessionCount,
    select: {
      routineLog: { select: { performedAt: true, routine: { select: { name: true } } } },
      sets: { select: { setNumber: true, reps: true, seconds: true, weightLb: true } },
    },
  });

  const sessions = entries
    .map((entry) => ({
      date: toAppYmd(entry.routineLog.performedAt),
      routine: entry.routineLog.routine.name,
      sets: summarizeSets(entry.sets),
    }))
    .reverse();

  const allSets = sessions.flatMap((s) => s.sets);
  const bestWeightLb = allSets.reduce<number | null>(
    (best, s) => (s.weightLb != null && (best == null || s.weightLb > best) ? s.weightLb : best),
    null
  );
  const bestReps = allSets.reduce<number | null>(
    (best, s) => (s.reps != null && (best == null || s.reps > best) ? s.reps : best),
    null
  );

  return {
    exercise: exercise.name,
    unit: exercise.unit,
    ...(exercise.isUnilateral ? { unilateral: true } : {}),
    ...(bestWeightLb != null ? { bestWeightLbInWindow: bestWeightLb } : {}),
    ...(bestReps != null ? { bestRepsInWindow: bestReps } : {}),
    sessions,
  };
}

export async function runCoachTool(name: string, input: unknown): Promise<string> {
  const safeInput = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  switch (name) {
    case "get_recent_logs":
      return JSON.stringify(await getRecentLogs(safeInput));
    case "get_pain_trend":
      return JSON.stringify(await getPainTrend(safeInput));
    case "get_injury_status":
      return JSON.stringify(await getInjuryStatus());
    case "get_schedule":
      return JSON.stringify(await getSchedule(safeInput));
    case "get_routine_progress":
      return JSON.stringify(await getRoutineProgress(safeInput));
    case "get_exercise_history":
      return JSON.stringify(await getExerciseHistory(safeInput));
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
