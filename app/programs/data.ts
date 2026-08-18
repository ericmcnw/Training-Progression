// Read model for the /programs index — one card per Focus row.
//
// "Program" is the surfaced word; Focus is the schema noun. Same thing: an
// objective with a target date and a milestone roadmap.
//
// Activity is attributed through the roadmap rather than FocusContributor:
// a program's routines are the ROUTINE-scoped milestone targets, which every
// program already has. No extra authoring step before the numbers show up.

import { prisma } from "@/lib/prisma";
import { todayAppYmd, toAppYmd, diffYmdDays } from "@/lib/dates";
import { projectRoadmap, type ProjectionInputMilestone } from "@/lib/focus-projection";
import { getAppSession } from "@/lib/auth";

const ACTIVITY_WINDOW_DAYS = 14;
const MAX_AIMS = 3;

export type ProgramActivity = {
  sessions: number;
  lastYmd: string | null;
  daysSinceLast: number | null;
};

export type ProgramPain = {
  level: number;
  ymd: string;
  daysAgo: number;
};

export type ProgramCard = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: string;
  season: string | null;
  phase: string | null;
  pursuitKey: string | null;
  milestonesDone: number;
  milestonesTotal: number;
  currentAims: string[];
  targetYmd: string | null;
  targetKind: "SOFT" | "HARD";
  projectedCompletionYmd: string | null;
  driftDays: number | null;
  projectionStatus: "no_target" | "done" | "ahead" | "on_track" | "behind";
  activity: ProgramActivity;
  // Injury-linked programs show the pain trend instead of a duration
  // projection — the same call the detail page makes, for the same reason:
  // a tissue-gated timeline isn't honestly forecastable.
  pain: ProgramPain | null;
};

// Active work first, then things not started, then things set aside, then
// finished. Within a bucket, the user's own sortOrder wins.
const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0,
  PLANNED: 1,
  PAUSED: 2,
  ACHIEVED: 3,
  ABANDONED: 4,
};

export async function getProgramCards(): Promise<ProgramCard[]> {
  const session = await getAppSession();
  const focuses = await prisma.focus.findMany({
    where: { profileKey: session.profileKey },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, description: true, icon: true, color: true,
      status: true, season: true, phase: true, pursuitKey: true,
      targetDate: true, targetKind: true, linkedInjuryId: true,
    },
  });
  if (focuses.length === 0) return [];

  const milestones = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "FOCUS", ownerId: { in: focuses.map((f) => f.id) } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, ownerId: true, scopeKind: true, scopeRef: true, label: true,
      status: true, sortOrder: true, estDurationDays: true,
      dependsOnMilestoneId: true,
    },
  });

  const byFocus = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const list = byFocus.get(m.ownerId) ?? [];
    list.push(m);
    byFocus.set(m.ownerId, list);
  }

  const today = todayAppYmd();

  // ── Activity, one query for every program's routines ──────────────────
  const allRoutineIds = Array.from(
    new Set(milestones.filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef).map((m) => m.scopeRef!))
  );
  const logsByRoutine = new Map<string, string[]>();
  if (allRoutineIds.length) {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000);
    const logs = await prisma.routineLog.findMany({
      where: { routineId: { in: allRoutineIds }, performedAt: { gte: since } },
      orderBy: { performedAt: "desc" },
      select: { routineId: true, performedAt: true },
    });
    for (const l of logs) {
      const list = logsByRoutine.get(l.routineId) ?? [];
      list.push(toAppYmd(l.performedAt));
      logsByRoutine.set(l.routineId, list);
    }
  }

  // ── Latest pain reading for injury-linked programs ────────────────────
  const injuryIds = focuses.map((f) => f.linkedInjuryId).filter((v): v is string => Boolean(v));
  const painByInjury = new Map<string, ProgramPain>();
  if (injuryIds.length) {
    const injuries = await prisma.activeInjury.findMany({
      where: { id: { in: injuryIds } },
      select: { id: true, zones: { select: { zoneId: true } } },
    });
    const zoneToInjury = new Map<string, string>();
    for (const inj of injuries) {
      for (const z of inj.zones) zoneToInjury.set(z.zoneId, inj.id);
    }
    if (zoneToInjury.size) {
      const readings = await prisma.painLog.findMany({
        where: { zoneId: { in: Array.from(zoneToInjury.keys()) } },
        orderBy: { loggedAt: "desc" },
        take: 60,
        select: { zoneId: true, level: true, loggedAt: true },
      });
      for (const r of readings) {
        const injuryId = zoneToInjury.get(r.zoneId);
        if (!injuryId || painByInjury.has(injuryId)) continue;
        const ymd = toAppYmd(r.loggedAt);
        painByInjury.set(injuryId, { level: r.level, ymd, daysAgo: diffYmdDays(today, ymd) });
      }
    }
  }

  const cards = focuses.map((f): ProgramCard => {
    const list = byFocus.get(f.id) ?? [];

    const done = list.filter((m) => m.status === "ACHIEVED").length;
    const total = list.filter((m) => m.status !== "SKIPPED").length;

    const seenTrack = new Set<string>();
    const currentAims: string[] = [];
    for (const m of list) {
      if (m.status !== "ACTIVE") continue;
      const trackKey = `${m.scopeKind}:${m.scopeRef ?? ""}`;
      if (seenTrack.has(trackKey)) continue;
      seenTrack.add(trackKey);
      currentAims.push(m.label);
    }

    const target = f.targetDate
      ? { ymd: f.targetDate.toISOString().slice(0, 10), kind: f.targetKind as "SOFT" | "HARD" }
      : null;
    const projInput: ProjectionInputMilestone[] = list.map((m) => ({
      id: m.id,
      trackKey: `${m.scopeKind}:${m.scopeRef ?? ""}`,
      sortOrder: m.sortOrder,
      status: m.status,
      estDurationDays: m.estDurationDays,
      dependsOnMilestoneId: m.dependsOnMilestoneId,
    }));
    const projection = projectRoadmap(projInput, today, target);

    // A session counts once for the program even when two of its tracks
    // point at the same routine, or two routines were logged the same day.
    const routineIds = new Set(
      list.filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef).map((m) => m.scopeRef!)
    );
    const ymds: string[] = [];
    for (const rid of routineIds) ymds.push(...(logsByRoutine.get(rid) ?? []));
    ymds.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    const lastYmd = ymds[0] ?? null;

    return {
      id: f.id,
      name: f.name,
      description: f.description,
      icon: f.icon,
      color: f.color,
      status: f.status,
      season: f.season,
      phase: f.phase,
      pursuitKey: f.pursuitKey,
      milestonesDone: done,
      milestonesTotal: total,
      currentAims: currentAims.slice(0, MAX_AIMS),
      targetYmd: target?.ymd ?? null,
      targetKind: (f.targetKind as "SOFT" | "HARD") ?? "SOFT",
      projectedCompletionYmd: projection.projectedCompletionYmd,
      driftDays: projection.driftDays,
      projectionStatus: projection.status,
      activity: {
        sessions: ymds.length,
        lastYmd,
        daysSinceLast: lastYmd ? diffYmdDays(today, lastYmd) : null,
      },
      pain: f.linkedInjuryId ? painByInjury.get(f.linkedInjuryId) ?? null : null,
    };
  });

  return cards.sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 9;
    const sb = STATUS_ORDER[b.status] ?? 9;
    return sa - sb;
  });
}
