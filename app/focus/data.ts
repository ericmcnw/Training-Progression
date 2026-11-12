// Read models for the Focus surfaces. getFocusBandData powers the dashboard
// band (compact per-focus read); getFocusDetail powers the detail page.

import { prisma } from "@/lib/prisma";
import { todayAppYmd, toAppYmd, diffYmdDays } from "@/lib/dates";
import { getAppSession } from "@/lib/auth";
import type { FocusBandItem, ProgramPhaseView, ProgramNextPhaseView } from "@/app/focus/shared";
import { projectRoadmap, type ProjectionInputMilestone } from "@/lib/focus-projection";
import { evaluatePainGate, evaluateFrequencyGate, type GateReading } from "@/lib/focus-gates";

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
      zones: {
        select: { zone: { select: { id: true, label: true } } },
        orderBy: { zone: { sortOrder: "asc" } },
      },
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
  kind: "NONE" | "FREE_TEXT" | "PAIN" | "FREQUENCY";
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

export type TrackActivity = {
  // Sessions logged for this track's routine over the last 8 weeks.
  totalSessions: number;
  lastYmd: string | null;
  daysSinceLast: number | null;
  // Per-week counts, 8 buckets, oldest → newest (this week last), for a bar.
  weeklyCounts: number[];
};

export type FocusTrackView = {
  key: string;
  scopeKind: "ROUTINE" | "EXERCISE" | "CAPACITY";
  scopeRef: string | null;
  // Human label for the track header (routine/exercise name, or capacity text).
  title: string;
  milestones: FocusMilestoneView[];
  // Real logged activity for ROUTINE tracks (null for exercise/capacity).
  activity: TrackActivity | null;
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
  season: string | null;
  phase: string | null;
  handoffNote: string | null;
  todayYmd: string;
  milestonesDone: number;
  milestonesTotal: number;
  tracks: FocusTrackView[];
  projection: FocusProjectionView;
};

// Gate inputs, loaded once per request and shared by the detail page and the
// dashboard band. Both need the same two reads; neither should duplicate them.

export type GateMilestoneFields = {
  scopeKind: string;
  scopeRef: string | null;
  gateKind: string;
  gateNote: string | null;
  gatePainZoneId: string | null;
  gatePainThreshold: number | null;
  gatePainDays: number | null;
  gateFreqPerWeek: number | null;
  gateFreqWeeks: number | null;
};

export async function loadPainGateReadings(
  milestones: GateMilestoneFields[]
): Promise<Map<string, GateReading[]>> {
  const zoneIds = Array.from(
    new Set(
      milestones
        .filter((m) => m.gateKind === "PAIN" && m.gatePainZoneId)
        .map((m) => m.gatePainZoneId!)
    )
  );
  const byZone = new Map<string, GateReading[]>();
  if (zoneIds.length === 0) return byZone;

  const since = new Date(Date.now() - 60 * 86_400_000);
  const rows = await prisma.painLog.findMany({
    where: { zoneId: { in: zoneIds }, loggedAt: { gte: since } },
    orderBy: { loggedAt: "asc" },
    select: { zoneId: true, level: true, loggedAt: true },
  });
  for (const r of rows) {
    const list = byZone.get(r.zoneId) ?? [];
    list.push({ ymd: toAppYmd(r.loggedAt), level: r.level });
    byZone.set(r.zoneId, list);
  }
  return byZone;
}

const TRACK_WEEKS = 8;

// How often each ROUTINE-scoped track's routine was actually logged, bucketed
// per week over the last TRACK_WEEKS (oldest → newest).
export async function loadTrackActivity(
  milestones: Pick<GateMilestoneFields, "scopeKind" | "scopeRef">[],
  todayYmd: string
): Promise<Map<string, TrackActivity>> {
  const routineIds = Array.from(
    new Set(
      milestones
        .filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef)
        .map((m) => m.scopeRef!)
    )
  );
  const byRoutine = new Map<string, TrackActivity>();
  if (routineIds.length === 0) return byRoutine;

  const since = new Date(Date.now() - TRACK_WEEKS * 7 * 86_400_000);
  const logs = await prisma.routineLog.findMany({
    where: { routineId: { in: routineIds }, performedAt: { gte: since } },
    orderBy: { performedAt: "desc" },
    select: { routineId: true, performedAt: true },
  });
  const grouped = new Map<string, string[]>(); // routineId → ymds (desc)
  for (const l of logs) {
    const list = grouped.get(l.routineId) ?? [];
    list.push(toAppYmd(l.performedAt));
    grouped.set(l.routineId, list);
  }
  for (const rid of routineIds) {
    const ymds = grouped.get(rid) ?? [];
    const weeklyCounts = new Array(TRACK_WEEKS).fill(0);
    for (const ymd of ymds) {
      const bucket = Math.floor(diffYmdDays(todayYmd, ymd) / 7);
      if (bucket >= 0 && bucket < TRACK_WEEKS) weeklyCounts[TRACK_WEEKS - 1 - bucket] += 1;
    }
    const lastYmd = ymds[0] ?? null;
    byRoutine.set(rid, {
      totalSessions: ymds.length,
      lastYmd,
      daysSinceLast: lastYmd ? diffYmdDays(todayYmd, lastYmd) : null,
      weeklyCounts,
    });
  }
  return byRoutine;
}

export function buildMilestoneGate(
  m: GateMilestoneFields,
  readingsByZone: Map<string, GateReading[]>,
  activityByRoutine: Map<string, TrackActivity>,
  todayYmd: string
): MilestoneGateView {
  if (m.gateKind === "PAIN" && m.gatePainZoneId && m.gatePainThreshold != null && m.gatePainDays != null) {
    const verdict = evaluatePainGate(
      readingsByZone.get(m.gatePainZoneId) ?? [],
      m.gatePainThreshold,
      m.gatePainDays,
      todayYmd
    );
    return { kind: "PAIN", note: m.gateNote, met: verdict.met, summary: verdict.summary };
  }
  if (
    m.gateKind === "FREQUENCY" &&
    m.gateFreqPerWeek != null &&
    m.gateFreqWeeks != null &&
    m.scopeKind === "ROUTINE" &&
    m.scopeRef
  ) {
    const counts = activityByRoutine.get(m.scopeRef)?.weeklyCounts ?? [];
    const verdict = evaluateFrequencyGate(counts, m.gateFreqPerWeek, m.gateFreqWeeks);
    return { kind: "FREQUENCY", note: m.gateNote, met: verdict.met, summary: verdict.summary };
  }
  if (m.gateKind === "FREE_TEXT") {
    return { kind: "FREE_TEXT", note: m.gateNote, met: null, summary: null };
  }
  return { kind: "NONE", note: null, met: null, summary: null };
}

export async function getFocusDetail(id: string): Promise<FocusDetail | null> {
  const session = await getAppSession();
  const focus = await prisma.focus.findFirst({
    where: { id, profileKey: session.profileKey },
    select: {
      id: true, name: true, description: true, icon: true, color: true,
      status: true, pursuitKey: true, targetDate: true, targetKind: true,
      linkedInjuryId: true, season: true, phase: true, handoffNote: true,
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
      gateFreqPerWeek: true, gateFreqWeeks: true,
    },
  });

  const today = todayAppYmd();
  const [gateReadingsByZone, activityByRoutine] = await Promise.all([
    loadPainGateReadings(milestones),
    loadTrackActivity(milestones, today),
  ]);

  const buildGate = (m: (typeof milestones)[number]): MilestoneGateView =>
    buildMilestoneGate(m, gateReadingsByZone, activityByRoutine, today);

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
        activity: null,
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
    season: focus.season,
    phase: focus.phase,
    handoffNote: focus.handoffNote,
    todayYmd: today,
    milestonesDone: done,
    milestonesTotal: total,
    tracks: Array.from(trackMap.values()).map((t) => ({
      ...t,
      activity:
        t.scopeKind === "ROUTINE" && t.scopeRef
          ? activityByRoutine.get(t.scopeRef) ?? null
          : null,
    })),
    projection: {
      targetYmd: target?.ymd ?? null,
      targetKind: focus.targetKind as "SOFT" | "HARD",
      projectedCompletionYmd: projection.projectedCompletionYmd,
      driftDays: projection.driftDays,
      status: projection.status,
    },
  };
}

export async function getFocusBandData(): Promise<FocusBandItem[]> {
  const session = await getAppSession();
  const focuses = await prisma.focus.findMany({
    where: { status: "ACTIVE", profileKey: session.profileKey },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, icon: true, color: true, status: true, season: true, phase: true,
      blocks: {
        where: { status: { in: ["ACTIVE", "DRAFT"] } },
        orderBy: { sortOrder: "asc" },
        select: {
          items: {
            where: { routineId: { not: null } },
            orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
            select: { id: true, label: true, routineId: true, targetPerWeek: true },
          },
        },
      },
    },
  });
  if (focuses.length === 0) return [];

  const [milestones, stages] = await Promise.all([
    prisma.progressionMilestone.findMany({
      where: { ownerKind: "FOCUS", ownerId: { in: focuses.map((f) => f.id) } },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        ownerId: true,
        scopeKind: true,
        scopeRef: true,
        label: true,
        targetText: true,
        status: true,
        stageId: true,
        gateKind: true,
        gateNote: true,
        gatePainZoneId: true,
        gatePainThreshold: true,
        gatePainDays: true,
        gateFreqPerWeek: true,
        gateFreqWeeks: true,
      },
    }),
    prisma.programStage.findMany({
      where: { programId: { in: focuses.map((f) => f.id) } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, programId: true, name: true, status: true, sortOrder: true, targetEndYmd: true },
    }),
  ]);

  const today = todayAppYmd();
  const [bandReadings, bandActivity] = await Promise.all([
    loadPainGateReadings(milestones),
    loadTrackActivity(milestones, today),
  ]);

  const stagesByFocus = new Map<string, typeof stages>();
  for (const s of stages) {
    const list = stagesByFocus.get(s.programId) ?? [];
    list.push(s);
    stagesByFocus.set(s.programId, list);
  }

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

    // Phases, when the program has them. "Current" is the ACTIVE stage, or the
    // first one not yet completed — phases never auto-advance, so a program
    // sitting past its target end date still reads as being in that phase.
    const phases = stagesByFocus.get(f.id) ?? [];
    const currentIdx = (() => {
      const active = phases.findIndex((s) => s.status === "ACTIVE");
      if (active >= 0) return active;
      return phases.findIndex((s) => s.status === "PLANNED");
    })();

    let currentPhase: ProgramPhaseView | null = null;
    let nextPhase: ProgramNextPhaseView | null = null;

    if (currentIdx >= 0) {
      const stage = phases[currentIdx];
      const steps = list
        .filter((m) => m.stageId === stage.id && m.status !== "SKIPPED")
        .map((m) => ({
          id: m.id,
          label: m.label,
          targetText: m.targetText,
          done: m.status === "ACHIEVED",
        }));
      currentPhase = {
        id: stage.id,
        name: stage.name,
        index: currentIdx + 1,
        total: phases.length,
        targetEndYmd: stage.targetEndYmd,
        steps,
        doneCount: steps.filter((s) => s.done).length,
      };

      const upcoming = phases[currentIdx + 1];
      if (upcoming) {
        // The step that heads a phase carries that phase's entry condition, so
        // the gate blocking the next phase is the first gated step inside it.
        const gatedStep = list.find(
          (m) =>
            m.stageId === upcoming.id &&
            m.status !== "SKIPPED" &&
            (m.gateKind === "PAIN" || m.gateKind === "FREQUENCY")
        );
        const gate = gatedStep
          ? buildMilestoneGate(gatedStep, bandReadings, bandActivity, today)
          : null;
        nextPhase = {
          name: upcoming.name,
          gateLabel: gatedStep?.label ?? null,
          gateSummary: gate?.summary ?? null,
          gateMet: gate?.met ?? null,
        };
      }
    }

    return {
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color,
      status: f.status,
      season: f.season,
      phase: f.phase,
      milestonesDone: done,
      milestonesTotal: total,
      currentAims,
      currentPhase,
      nextPhase,
      availableWork: f.blocks
        .flatMap((block) => block.items)
        .filter((item): item is typeof item & { routineId: string } => Boolean(item.routineId))
        .slice(0, 4),
    };
  });
}
