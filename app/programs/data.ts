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
import { getActivityEntry } from "@/lib/activity-families";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";

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
      routineLinks: { select: { routineId: true } },
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

  // Activity includes the sport itself, explicitly connected routines, and
  // routine-scoped roadmap milestones. Keep log ids so overlapping rules do
  // not count a climbing session twice.
  const sportRoutineIdByFocus = new Map<string, string>();
  for (const focus of focuses) {
    const slug = focus.pursuitKey?.trim().toLowerCase();
    if (!slug || getActivityEntry(slug)?.family !== "sports") continue;
    sportRoutineIdByFocus.set(focus.id, getSyntheticSportRoutineId(slug));
  }
  const allRoutineIds = Array.from(new Set([
    ...milestones.filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef).map((m) => m.scopeRef!),
    ...focuses.flatMap((focus) => focus.routineLinks.map((link) => link.routineId)),
    ...sportRoutineIdByFocus.values(),
  ]));
  type ActivityLogRef = { id: string; ymd: string };
  const logsByRoutine = new Map<string, ActivityLogRef[]>();
  const climbingLogs: ActivityLogRef[] = [];
  const hasClimbingProgram = focuses.some((focus) => focus.pursuitKey?.trim().toLowerCase() === "climbing");
  if (allRoutineIds.length || hasClimbingProgram) {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000);
    const logs = await prisma.routineLog.findMany({
      where: {
        performedAt: { gte: since },
        OR: [
          ...(allRoutineIds.length ? [{ routineId: { in: allRoutineIds } }] : []),
          ...(hasClimbingProgram ? [{ climbAttempts: { some: {} } }] : []),
        ],
      },
      orderBy: { performedAt: "desc" },
      select: { id: true, routineId: true, performedAt: true, _count: { select: { climbAttempts: true } } },
    });
    for (const l of logs) {
      const list = logsByRoutine.get(l.routineId) ?? [];
      const ref = { id: l.id, ymd: toAppYmd(l.performedAt) };
      list.push(ref);
      logsByRoutine.set(l.routineId, list);
      if (l._count.climbAttempts > 0) climbingLogs.push(ref);
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

    const routineIds = new Set([
      ...list.filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef).map((m) => m.scopeRef!),
      ...f.routineLinks.map((link) => link.routineId),
      ...(sportRoutineIdByFocus.get(f.id) ? [sportRoutineIdByFocus.get(f.id)!] : []),
    ]);
    const activityById = new Map<string, ActivityLogRef>();
    for (const rid of routineIds) {
      for (const log of logsByRoutine.get(rid) ?? []) activityById.set(log.id, log);
    }
    if (f.pursuitKey?.trim().toLowerCase() === "climbing") {
      for (const log of climbingLogs) activityById.set(log.id, log);
    }
    const activityLogs = Array.from(activityById.values()).sort((a, b) => b.ymd.localeCompare(a.ymd));
    const lastYmd = activityLogs[0]?.ymd ?? null;

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
        sessions: activityLogs.length,
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
