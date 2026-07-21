// Read models for the Focus surfaces. getFocusBandData powers the dashboard
// band (compact per-focus read); getFocusDetail powers the detail page.

import { prisma } from "@/lib/prisma";
import { todayAppYmd, toAppYmd, diffYmdDays } from "@/lib/dates";
import { projectRoadmap, type ProjectionInputMilestone } from "@/lib/focus-projection";
import { evaluatePainGate, type GateReading } from "@/lib/focus-gates";

// ── Injury panel (for injury-linked focuses) ──────────────────────────────
// Rehab focuses show the real signal — the pain trend from PainLog — instead
// of a naive duration projection, which is misleading for tissue-gated work.

export type InjuryReading = {
  ymd: string;
  level: number;
  context: string;
  zoneLabel: string;
};

export type InjuryPanelData = {
  name: string;
  status: string;
  startedYmd: string;
  daysActive: number;
  latest: InjuryReading | null;
  // Up to ~14 recent readings, oldest → newest, for a sparkline.
  recent: InjuryReading[];
  // For the one-tap reading control: the zone to log against, and today's
  // value if already logged (so the control pre-selects / lets you correct).
  primaryZoneId: string | null;
  todayReadingLevel: number | null;
};

export async function getInjuryPanelData(injuryId: string): Promise<InjuryPanelData | null> {
  const injury = await prisma.activeInjury.findUnique({
    where: { id: injuryId },
    select: {
      name: true,
      status: true,
      startedAt: true,
      zones: { select: { zone: { select: { id: true, label: true } } } },
    },
  });
  if (!injury) return null;

  const zoneIds = injury.zones.map((z) => z.zone.id);
  const logs = zoneIds.length
    ? await prisma.painLog.findMany({
        where: { zoneId: { in: zoneIds } },
        orderBy: { loggedAt: "desc" },
        take: 14,
        select: { level: true, context: true, loggedAt: true, zone: { select: { label: true } } },
      })
    : [];

  const readings: InjuryReading[] = logs.map((l) => ({
    ymd: toAppYmd(l.loggedAt),
    level: l.level,
    context: String(l.context).toLowerCase().replace(/_/g, " "),
    zoneLabel: l.zone.label,
  }));

  const startedYmd = toAppYmd(injury.startedAt);
  const today = todayAppYmd();
  const primaryZoneId = injury.zones[0]?.zone.id ?? null;
  const todayReadingLevel = readings.find((r) => r.ymd === today)?.level ?? null;

  return {
    name: injury.name,
    status: injury.status,
    startedYmd,
    daysActive: Math.max(0, diffYmdDays(today, startedYmd)),
    latest: readings[0] ?? null,
    recent: readings.slice().reverse(), // oldest → newest for the sparkline
    primaryZoneId,
    todayReadingLevel,
  };
}

export type MilestoneGateView = {
  kind: "NONE" | "FREE_TEXT" | "PAIN";
  // Free-text criteria, or a label for a pain gate.
  note: string | null;
  // PAIN only: evaluated verdict. null for FREE_TEXT (self-assessed) / NONE.
  met: boolean | null;
  summary: string | null;
};

export type FocusMilestoneView = {
  id: string;
  label: string;
  targetText: string | null;
  status: "ACTIVE" | "ACHIEVED" | "SKIPPED";
  sortOrder: number;
  achievedAt: string | null;
  estDurationDays: number | null;
  // Forward-projected window for ACTIVE milestones (null for done/skipped).
  projectedStartYmd: string | null;
  projectedEndYmd: string | null;
  gate: MilestoneGateView;
};

export type FocusTrackView = {
  key: string;
  scopeKind: "ROUTINE" | "EXERCISE" | "CAPACITY";
  scopeRef: string | null;
  // Human label for the track header (routine/exercise name, or capacity text).
  title: string;
  milestones: FocusMilestoneView[];
};

export type FocusProjectionView = {
  targetYmd: string | null;
  targetKind: "SOFT" | "HARD";
  projectedCompletionYmd: string | null;
  driftDays: number | null;
  status: "no_target" | "done" | "ahead" | "on_track" | "behind";
};

export type FocusDetail = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: string;
  pursuitKey: string | null;
  linkedInjuryId: string | null;
  todayYmd: string;
  milestonesDone: number;
  milestonesTotal: number;
  tracks: FocusTrackView[];
  projection: FocusProjectionView;
};

export async function getFocusDetail(id: string): Promise<FocusDetail | null> {
  const focus = await prisma.focus.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, icon: true, color: true,
      status: true, pursuitKey: true, targetDate: true, targetKind: true,
      linkedInjuryId: true,
    },
  });
  if (!focus) return null;

  const milestones = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "FOCUS", ownerId: id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, scopeKind: true, scopeRef: true, label: true,
      targetText: true, status: true, sortOrder: true, achievedAt: true,
      estDurationDays: true, dependsOnMilestoneId: true,
      gateKind: true, gateNote: true, gatePainZoneId: true,
      gatePainThreshold: true, gatePainDays: true,
    },
  });

  // Pain-gate evaluation: fetch recent readings for every zone any PAIN gate
  // references, once, then evaluate each gate against its zone's readings.
  const today = todayAppYmd();
  const gateZoneIds = Array.from(
    new Set(
      milestones
        .filter((m) => m.gateKind === "PAIN" && m.gatePainZoneId)
        .map((m) => m.gatePainZoneId!)
    )
  );
  const gateReadingsByZone = new Map<string, GateReading[]>();
  if (gateZoneIds.length) {
    const since = new Date(Date.now() - 60 * 86_400_000);
    const rows = await prisma.painLog.findMany({
      where: { zoneId: { in: gateZoneIds }, loggedAt: { gte: since } },
      orderBy: { loggedAt: "asc" },
      select: { zoneId: true, level: true, loggedAt: true },
    });
    for (const r of rows) {
      const list = gateReadingsByZone.get(r.zoneId) ?? [];
      list.push({ ymd: toAppYmd(r.loggedAt), level: r.level });
      gateReadingsByZone.set(r.zoneId, list);
    }
  }

  function buildGate(m: (typeof milestones)[number]): MilestoneGateView {
    if (m.gateKind === "PAIN" && m.gatePainZoneId && m.gatePainThreshold != null && m.gatePainDays != null) {
      const verdict = evaluatePainGate(
        gateReadingsByZone.get(m.gatePainZoneId) ?? [],
        m.gatePainThreshold,
        m.gatePainDays,
        today
      );
      return { kind: "PAIN", note: m.gateNote, met: verdict.met, summary: verdict.summary };
    }
    if (m.gateKind === "FREE_TEXT") {
      return { kind: "FREE_TEXT", note: m.gateNote, met: null, summary: null };
    }
    return { kind: "NONE", note: null, met: null, summary: null };
  }

  // Compute the forward projection over the whole roadmap (tracks keyed the
  // same way as the display grouping below).
  const target = focus.targetDate
    ? { ymd: focus.targetDate.toISOString().slice(0, 10), kind: focus.targetKind as "SOFT" | "HARD" }
    : null;
  const projInput: ProjectionInputMilestone[] = milestones.map((m) => ({
    id: m.id,
    trackKey: `${m.scopeKind}:${m.scopeRef ?? ""}`,
    sortOrder: m.sortOrder,
    status: m.status,
    estDurationDays: m.estDurationDays,
    dependsOnMilestoneId: m.dependsOnMilestoneId,
  }));
  const projection = projectRoadmap(projInput, todayAppYmd(), target);

  // Resolve routine + exercise names for track titles in two batched queries.
  const routineIds = milestones.filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef).map((m) => m.scopeRef!);
  const exerciseIds = milestones.filter((m) => m.scopeKind === "EXERCISE" && m.scopeRef).map((m) => m.scopeRef!);
  const [routines, exercises] = await Promise.all([
    routineIds.length
      ? prisma.routine.findMany({ where: { id: { in: routineIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    exerciseIds.length
      ? prisma.exercise.findMany({ where: { id: { in: exerciseIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const routineName = new Map(routines.map((r) => [r.id, r.name]));
  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));

  function trackTitle(scopeKind: string, scopeRef: string | null): string {
    if (scopeKind === "ROUTINE") return routineName.get(scopeRef ?? "") ?? "Routine";
    if (scopeKind === "EXERCISE") return exerciseName.get(scopeRef ?? "") ?? "Exercise";
    return scopeRef?.trim() || "General";
  }

  // Group into tracks by (scopeKind, scopeRef), preserving first-seen order.
  const trackMap = new Map<string, FocusTrackView>();
  for (const m of milestones) {
    const key = `${m.scopeKind}:${m.scopeRef ?? ""}`;
    let track = trackMap.get(key);
    if (!track) {
      track = {
        key,
        scopeKind: m.scopeKind,
        scopeRef: m.scopeRef,
        title: trackTitle(m.scopeKind, m.scopeRef),
        milestones: [],
      };
      trackMap.set(key, track);
    }
    track.milestones.push({
      id: m.id,
      label: m.label,
      targetText: m.targetText,
      status: m.status,
      sortOrder: m.sortOrder,
      achievedAt: m.achievedAt ? m.achievedAt.toISOString() : null,
      estDurationDays: m.estDurationDays,
      projectedStartYmd: projection.byMilestone[m.id]?.startYmd ?? null,
      projectedEndYmd: projection.byMilestone[m.id]?.endYmd ?? null,
      gate: buildGate(m),
    });
  }

  const done = milestones.filter((m) => m.status === "ACHIEVED").length;
  const total = milestones.filter((m) => m.status !== "SKIPPED").length;

  return {
    id: focus.id,
    name: focus.name,
    description: focus.description,
    icon: focus.icon,
    color: focus.color,
    status: focus.status,
    pursuitKey: focus.pursuitKey,
    linkedInjuryId: focus.linkedInjuryId,
    todayYmd: today,
    milestonesDone: done,
    milestonesTotal: total,
    tracks: Array.from(trackMap.values()),
    projection: {
      targetYmd: target?.ymd ?? null,
      targetKind: focus.targetKind as "SOFT" | "HARD",
      projectedCompletionYmd: projection.projectedCompletionYmd,
      driftDays: projection.driftDays,
      status: projection.status,
    },
  };
}

export type FocusBandItem = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  status: string;
  // Milestone progress across the whole roadmap (all tracks).
  milestonesDone: number;
  milestonesTotal: number;
  // The current aim per track — the first ACTIVE milestone in each scope,
  // deduped, capped for display. "What am I working on right now."
  currentAims: string[];
};

export async function getFocusBandData(): Promise<FocusBandItem[]> {
  const focuses = await prisma.focus.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, icon: true, color: true, status: true },
  });
  if (focuses.length === 0) return [];

  const milestones = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "FOCUS", ownerId: { in: focuses.map((f) => f.id) } },
    orderBy: { sortOrder: "asc" },
    select: {
      ownerId: true,
      scopeKind: true,
      scopeRef: true,
      label: true,
      status: true,
    },
  });

  const byFocus = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const list = byFocus.get(m.ownerId) ?? [];
    list.push(m);
    byFocus.set(m.ownerId, list);
  }

  return focuses.map((f) => {
    const list = byFocus.get(f.id) ?? [];
    const done = list.filter((m) => m.status === "ACHIEVED").length;
    const total = list.filter((m) => m.status !== "SKIPPED").length;

    // Current aim per track = first ACTIVE milestone within each scope group.
    const seenTrack = new Set<string>();
    const currentAims: string[] = [];
    for (const m of list) {
      if (m.status !== "ACTIVE") continue;
      const trackKey = `${m.scopeKind}:${m.scopeRef ?? ""}`;
      if (seenTrack.has(trackKey)) continue;
      seenTrack.add(trackKey);
      currentAims.push(m.label);
    }

    return {
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color,
      status: f.status,
      milestonesDone: done,
      milestonesTotal: total,
      currentAims,
    };
  });
}
