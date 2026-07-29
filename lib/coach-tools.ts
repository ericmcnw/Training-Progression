import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { addDaysYmd, getAppDayRange, toAppYmd, todayAppYmd } from "@/lib/dates";
import { getLogsInWindow } from "@/lib/logs-window";
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

export async function runCoachTool(name: string, input: unknown): Promise<string> {
  const safeInput = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  switch (name) {
    case "get_recent_logs":
      return JSON.stringify(await getRecentLogs(safeInput));
    case "get_pain_trend":
      return JSON.stringify(await getPainTrend(safeInput));
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
