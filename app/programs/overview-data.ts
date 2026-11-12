import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, toAppYmd, todayAppYmd } from "@/lib/dates";
import {
  buildMilestoneGate,
  loadPainGateReadings,
  loadTrackActivity,
  type MilestoneGateView,
} from "@/app/focus/data";
import {
  evaluatePlan,
  formatPlanTarget,
  loadPlanSessions,
  mondayOfYmd,
  readAdjustments,
} from "@/lib/program-plan";
import { evaluateFrequencyGate, evaluatePainGate } from "@/lib/focus-gates";
import { gradeSort, isSendOutcome } from "@/lib/climb-types";

const PAIN_WINDOW_DAYS = 28;
const LIMITER_RECENT_DAYS = 7;
const LIMITER_MIN_LEVEL = 3;

export type OverviewStep = {
  id: string;
  label: string;
  targetText: string | null;
  done: boolean;
  /** Set when an open step belongs to an earlier phase and came along. */
  carriedFrom: string | null;
  /** Auto-evaluated condition (pain/frequency), read from logs. */
  autoGate: MilestoneGateView | null;
};

export type OverviewPhase = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  number: number;
  steps: OverviewStep[];
  /** What unlocks this phase: its first step, when that step is auto-evaluated. */
  entry: { stepId: string; label: string; summary: string | null; met: boolean | null } | null;
};

export type PainDay = { ymd: string; level: number | null };

export type PainSignal = {
  injuryName: string;
  zoneLabel: string;
  primaryZoneId: string | null;
  todayLevel: number | null;
  days: PainDay[];
  latest: { level: number; ymd: string } | null;
  /** Consecutive most-recent logged days at the latest level. */
  steadyDays: number;
  /** The worst day in the window, when it differs from the latest level. */
  peak: { level: number; ymd: string } | null;
  /** Upcoming phase conditions read from this pain log. */
  gates: Array<{ number: number; phaseName: string; threshold: number; days: number; met: boolean; summary: string | null }>;
};

export type Limiter = { injuryName: string; zoneLabel: string; level: number; steadyDays: number };

export type Readout =
  | {
      kind: "weekly";
      key: string;
      title: string;
      headline: string;
      meta: string | null;
      unit: string;
      /** Rolling 7-day buckets, oldest → newest; the last one ends today. */
      values: number[];
      target: { value: number; label: string; met: boolean } | null;
    }
  | { kind: "stat"; key: string; title: string; headline: string; meta: string | null };

export type WeekRoutine = { id: string; name: string; thisWeek: number; lastYmd: string | null };
export type WeekPlanLine = { name: string; target: string; change: "up" | "down" | "same" | "new"; done: boolean };

export type ProgramOverviewData = {
  phases: OverviewPhase[];
  currentIndex: number | null;
  currentSteps: OverviewStep[];
  next: { phaseId: string; name: string; entry: OverviewPhase["entry"]; openSteps: number } | null;
  pain: PainSignal | null;
  limiters: Limiter[];
  readouts: Readout[];
  week: { routines: WeekRoutine[]; plan: WeekPlanLine[] };
};

function steadyRun(days: PainDay[]) {
  const logged = days.filter((d): d is { ymd: string; level: number } => d.level != null);
  const last = logged.at(-1);
  if (!last) return { latest: null, steadyDays: 0 };
  let count = 0;
  for (let i = logged.length - 1; i >= 0 && logged[i].level === last.level; i -= 1) count += 1;
  return { latest: last, steadyDays: count };
}

async function dailyMaxPain(zoneIds: string[], sinceYmd: string) {
  if (zoneIds.length === 0) return new Map<string, number>();
  const rows = await prisma.painLog.findMany({
    where: { zoneId: { in: zoneIds }, loggedAt: { gte: new Date(`${sinceYmd}T00:00:00.000Z`) } },
    select: { level: true, loggedAt: true },
  });
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const ymd = toAppYmd(row.loggedAt);
    byDay.set(ymd, Math.max(byDay.get(ymd) ?? 0, row.level));
  }
  return byDay;
}

export async function getProgramOverview(programId: string): Promise<ProgramOverviewData | null> {
  const today = todayAppYmd();
  const program = await prisma.focus.findFirst({
    where: { id: programId },
    select: {
      linkedInjuryId: true,
      pursuitKey: true,
      objectiveKind: true,
      stages: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, status: true },
      },
      routineLinks: { orderBy: { sortOrder: "asc" }, select: { routine: { select: { id: true, name: true, isActive: true } } } },
      planItems: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          exerciseId: true,
          startYmd: true,
          adjustments: true,
          exercise: { select: { name: true } },
          targets: { select: { week: true, sets: true, reps: true, seconds: true, weightLb: true } },
        },
      },
    },
  });
  if (!program) return null;

  const milestones = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "FOCUS", ownerId: programId, status: { not: "SKIPPED" } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, stageId: true, label: true, targetText: true, status: true,
      scopeKind: true, scopeRef: true, gateKind: true, gateNote: true,
      gatePainZoneId: true, gatePainThreshold: true, gatePainDays: true,
      gateFreqPerWeek: true, gateFreqWeeks: true,
    },
  });
  const [readingsByZone, activityByRoutine] = await Promise.all([
    loadPainGateReadings(milestones),
    loadTrackActivity(milestones, today),
  ]);
  const gateOf = (m: (typeof milestones)[number]) => {
    if (m.gateKind !== "PAIN" && m.gateKind !== "FREQUENCY") return null;
    return buildMilestoneGate(m, readingsByZone, activityByRoutine, today);
  };
  const toStep = (m: (typeof milestones)[number], carriedFrom: string | null): OverviewStep => ({
    id: m.id,
    label: m.label,
    targetText: m.targetText,
    done: m.status === "ACHIEVED",
    carriedFrom,
    autoGate: m.status === "ACHIEVED" ? null : gateOf(m),
  });

  const phases: OverviewPhase[] = program.stages.map((stage, index) => {
    const own = milestones.filter((m) => m.stageId === stage.id);
    const first = own[0];
    const gated = first && (first.gateKind === "PAIN" || first.gateKind === "FREQUENCY") ? first : null;
    const verdict = gated ? gateOf(gated) : null;
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      status: stage.status,
      number: index + 1,
      steps: own.filter((m) => m !== gated).map((m) => toStep(m, null)),
      entry: gated ? { stepId: gated.id, label: gated.label, summary: verdict?.summary ?? null, met: verdict?.met ?? null } : null,
    };
  });

  const activeIdx = phases.findIndex((p) => p.status === "ACTIVE");
  const currentIndex = phases.length === 0 ? null : activeIdx >= 0 ? activeIdx : Math.max(0, phases.findIndex((p) => p.status === "PLANNED"));

  let currentSteps: OverviewStep[];
  if (currentIndex == null) {
    currentSteps = milestones.map((m) => toStep(m, null));
  } else {
    const current = phases[currentIndex];
    const earlier = phases.slice(0, currentIndex);
    const carried = earlier.flatMap((phase) =>
      phase.steps.filter((step) => !step.done).map((step) => ({ ...step, carriedFrom: phase.name })),
    );
    const known = new Set(phases.map((p) => p.id));
    const loose = milestones.filter((m) => !m.stageId || !known.has(m.stageId)).map((m) => toStep(m, null));
    currentSteps = [...current.steps, ...carried, ...loose];
  }

  const upcoming = currentIndex != null ? phases[currentIndex + 1] : undefined;
  const next = upcoming
    ? {
        phaseId: upcoming.id,
        name: upcoming.name,
        entry: upcoming.entry,
        openSteps: currentSteps.filter((s) => !s.done).length,
      }
    : null;

  const sincePain = addDaysYmd(today, -(PAIN_WINDOW_DAYS - 1));
  const [pain, limiters] = await Promise.all([
    program.linkedInjuryId ? loadPainSignal(program.linkedInjuryId, sincePain, today, milestones, phases, readingsByZone) : null,
    loadLimiters(program.linkedInjuryId, today),
  ]);

  const nextEntry = upcoming?.entry ? milestones.find((m) => m.id === upcoming.entry!.stepId) ?? null : null;
  const [week, readouts] = await Promise.all([
    loadWeek(program, today),
    loadReadouts(program, nextEntry && upcoming ? { step: nextEntry, phaseNumber: upcoming.number } : null, activityByRoutine, today),
  ]);

  return { phases, currentIndex, currentSteps, next, pain, limiters, readouts, week };
}

async function loadPainSignal(
  injuryId: string,
  since: string,
  today: string,
  milestones: Array<{ stageId: string | null; gateKind: string; gatePainZoneId: string | null; gatePainThreshold: number | null; gatePainDays: number | null; status: string }>,
  phases: OverviewPhase[],
  readingsByZone: Map<string, Array<{ ymd: string; level: number }>>,
): Promise<PainSignal | null> {
  const injury = await prisma.activeInjury.findFirst({
    where: { id: injuryId },
    select: { name: true, zones: { orderBy: { zone: { sortOrder: "asc" } }, select: { zone: { select: { id: true, label: true } } } } },
  });
  if (!injury) return null;
  const zoneIds = injury.zones.map((z) => z.zone.id);
  const byDay = await dailyMaxPain(zoneIds, since);
  const days: PainDay[] = Array.from({ length: PAIN_WINDOW_DAYS }, (_, i) => {
    const ymd = addDaysYmd(since, i);
    return { ymd, level: byDay.get(ymd) ?? null };
  });
  const { latest, steadyDays } = steadyRun(days);
  let peak: PainSignal["peak"] = null;
  for (const day of days) {
    if (day.level != null && (!peak || day.level > peak.level)) peak = { level: day.level, ymd: day.ymd };
  }
  if (peak && latest && peak.level <= latest.level) peak = null;

  const phaseName = new Map(phases.map((p) => [p.id, p]));
  const gates = milestones
    .filter(
      (m) =>
        m.gateKind === "PAIN" &&
        m.status !== "ACHIEVED" &&
        m.gatePainZoneId != null &&
        zoneIds.includes(m.gatePainZoneId) &&
        m.gatePainThreshold != null &&
        m.gatePainDays != null &&
        m.stageId != null &&
        phaseName.get(m.stageId)?.status === "PLANNED",
    )
    .map((m) => {
      const verdict = evaluatePainGate(readingsByZone.get(m.gatePainZoneId!) ?? [], m.gatePainThreshold!, m.gatePainDays!, today);
      const phase = phaseName.get(m.stageId!)!;
      return {
        number: phase.number,
        phaseName: `${phase.number} · ${phase.name}`,
        threshold: m.gatePainThreshold!,
        days: m.gatePainDays!,
        met: verdict.met,
        summary: verdict.met ? null : verdict.summary,
      };
    })
    .sort((a, b) => a.number - b.number);

  return {
    injuryName: injury.name,
    zoneLabel: injury.zones.map((z) => z.zone.label).join(", "),
    primaryZoneId: zoneIds[0] ?? null,
    todayLevel: byDay.get(today) ?? null,
    days,
    latest,
    steadyDays,
    peak,
    gates,
  };
}

async function loadLimiters(linkedInjuryId: string | null, today: string): Promise<Limiter[]> {
  const injuries = await prisma.activeInjury.findMany({
    where: { status: { not: "RESOLVED" }, ...(linkedInjuryId ? { id: { not: linkedInjuryId } } : {}) },
    select: { name: true, zones: { select: { zone: { select: { id: true, label: true } } } } },
  });
  const since = addDaysYmd(today, -(PAIN_WINDOW_DAYS - 1));
  const result: Limiter[] = [];
  for (const injury of injuries) {
    const byDay = await dailyMaxPain(injury.zones.map((z) => z.zone.id), since);
    const days = Array.from({ length: PAIN_WINDOW_DAYS }, (_, i) => {
      const ymd = addDaysYmd(since, i);
      return { ymd, level: byDay.get(ymd) ?? null };
    });
    const { latest, steadyDays } = steadyRun(days);
    if (!latest || latest.level < LIMITER_MIN_LEVEL || diffYmdDays(today, latest.ymd) > LIMITER_RECENT_DAYS) continue;
    result.push({
      injuryName: injury.name,
      zoneLabel: injury.zones.map((z) => z.zone.label).join(", "),
      level: latest.level,
      steadyDays,
    });
  }
  return result.sort((a, b) => b.level - a.level);
}

async function loadWeek(
  program: {
    routineLinks: Array<{ routine: { id: string; name: string; isActive: boolean } }>;
    planItems: Array<{
      exerciseId: string;
      startYmd: string;
      adjustments: unknown;
      exercise: { name: string };
      targets: Array<{ week: number; sets: number | null; reps: number | null; seconds: number | null; weightLb: number | null }>;
    }>;
  },
  today: string,
) {
  const monday = mondayOfYmd(today);
  const routines = program.routineLinks.map((l) => l.routine).filter((r) => r.isActive);
  const logs = routines.length
    ? await prisma.routineLog.findMany({
        where: { routineId: { in: routines.map((r) => r.id) }, performedAt: { gte: new Date(`${addDaysYmd(today, -60)}T00:00:00.000Z`) } },
        select: { routineId: true, performedAt: true },
      })
    : [];
  const weekRoutines: WeekRoutine[] = routines.map((routine) => {
    const ymds = logs.filter((l) => l.routineId === routine.id).map((l) => toAppYmd(l.performedAt)).sort();
    return {
      id: routine.id,
      name: routine.name,
      thisWeek: ymds.filter((ymd) => ymd >= monday && ymd <= today).length,
      lastYmd: ymds.at(-1) ?? null,
    };
  });

  const earliest = program.planItems.reduce((min, item) => (item.startYmd < min ? item.startYmd : min), today);
  const sessions = await loadPlanSessions(program.planItems.map((i) => i.exerciseId), mondayOfYmd(earliest));
  const plan: WeekPlanLine[] = program.planItems.map((item) => {
    const evaluation = evaluatePlan({
      startYmd: item.startYmd,
      todayYmd: today,
      targets: item.targets,
      sessions: sessions.get(item.exerciseId) ?? [],
      adjustments: readAdjustments(item.adjustments),
    });
    return {
      name: item.exercise.name,
      target: formatPlanTarget(evaluation.target),
      change: evaluation.change,
      done: evaluation.doneThisWeek,
    };
  });

  return { routines: weekRoutines, plan };
}

const READOUT_WEEKS = 8;

function rollingWeeks(ymds: Array<{ ymd: string; value: number }>, today: string) {
  const values = new Array(READOUT_WEEKS).fill(0) as number[];
  for (const { ymd, value } of ymds) {
    const bucket = Math.floor(diffYmdDays(today, ymd) / 7);
    if (bucket >= 0 && bucket < READOUT_WEEKS) values[READOUT_WEEKS - 1 - bucket] += value;
  }
  return values.map((v) => Math.round(v * 10) / 10);
}

async function loadReadouts(
  program: { pursuitKey: string | null; objectiveKind: string },
  nextEntry: {
    step: { scopeKind: string; scopeRef: string | null; gateKind: string; gateFreqPerWeek: number | null; gateFreqWeeks: number | null };
    phaseNumber: number;
  } | null,
  activityByRoutine: Map<string, { weeklyCounts: number[] }>,
  today: string,
): Promise<Readout[]> {
  const readouts: Readout[] = [];
  const since = new Date(`${addDaysYmd(today, -(READOUT_WEEKS * 7 - 1))}T00:00:00.000Z`);

  const gate = nextEntry?.step;
  if (gate && gate.gateKind === "FREQUENCY" && gate.scopeKind === "ROUTINE" && gate.scopeRef && gate.gateFreqPerWeek != null && gate.gateFreqWeeks != null) {
    const counts = activityByRoutine.get(gate.scopeRef)?.weeklyCounts ?? new Array(READOUT_WEEKS).fill(0);
    const routine = await prisma.routine.findFirst({ where: { id: gate.scopeRef }, select: { name: true } });
    const verdict = evaluateFrequencyGate(counts, gate.gateFreqPerWeek, gate.gateFreqWeeks);
    readouts.push({
      kind: "weekly",
      key: `freq-${gate.scopeRef}`,
      title: `${routine?.name ?? "Sessions"} per week`,
      headline: `${counts.at(-1) ?? 0} in the last 7 days`,
      meta: verdict.summary,
      unit: "sessions",
      values: counts,
      target: { value: gate.gateFreqPerWeek, label: `Phase ${nextEntry.phaseNumber}: ${gate.gateFreqPerWeek}×/wk for ${gate.gateFreqWeeks} wk`, met: verdict.met },
    });
  }

  if (program.pursuitKey === "climbing") {
    const attempts = await prisma.climbAttempt.findMany({
      where: { sessionLog: { performedAt: { gte: since } } },
      select: { grade: true, gradeSystem: true, outcome: true, sessionLog: { select: { performedAt: true } } },
    });
    const sends = attempts.filter((a) => isSendOutcome(a.outcome));
    const hardest = (system: "BOULDER_V" | "YOSEMITE") =>
      sends
        .filter((a) => a.gradeSystem === system)
        .sort((a, b) => gradeSort(b.grade, system) - gradeSort(a.grade, system))[0] ?? null;
    const top = [hardest("BOULDER_V"), hardest("YOSEMITE")].filter((a): a is NonNullable<typeof a> => a != null);
    readouts.push({
      kind: "stat",
      key: "climb-sends",
      title: "Sends",
      headline: `${sends.length} send${sends.length === 1 ? "" : "s"} in ${READOUT_WEEKS} weeks`,
      meta: top.length
        ? `hardest ${top.map((a) => `${a.grade} (${formatShort(toAppYmd(a.sessionLog.performedAt))})`).join(" · ")}`
        : attempts.length
          ? `${attempts.length} climbs logged, none sent`
          : null,
    });
  }

  if (program.pursuitKey === "endurance" || program.objectiveKind === "ENDURANCE") {
    const logs = await prisma.routineLog.findMany({
      where: {
        performedAt: { gte: since },
        distanceMi: { not: null },
        OR: [{ routineId: "endurance-synthetic" }, { routine: { kind: "CARDIO" } }],
      },
      select: { performedAt: true, distanceMi: true, activityType: { select: { name: true } }, routine: { select: { name: true } } },
    });
    const rows = logs.map((l) => ({ ymd: toAppYmd(l.performedAt), value: l.distanceMi ?? 0, name: l.activityType?.name ?? l.routine.name }));
    const values = rollingWeeks(rows, today);
    const longest = rows.sort((a, b) => b.value - a.value)[0] ?? null;
    readouts.push({
      kind: "weekly",
      key: "endurance-miles",
      title: "Miles per week",
      headline: `${values.at(-1) ?? 0} mi in the last 7 days`,
      meta: longest ? `longest ${Math.round(longest.value * 10) / 10} mi · ${longest.name}, ${formatShort(longest.ymd)}` : null,
      unit: "mi",
      values,
      target: null,
    });
  }

  return readouts;
}

const shortFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function formatShort(ymd: string) {
  return shortFormat.format(new Date(`${ymd}T00:00:00.000Z`));
}

