import Link from "next/link";
import { Fragment } from "react";
import CoverageGroupedBarChart from "./CoverageGroupedBarChart";
import ProgressSearchTrigger, { type ProgressSearchSuggestion } from "./ProgressSearchTrigger";
import { getExerciseIndex, getMetadataIndex, getRoutineIndex, getRoutineLogs, resolveGroupTarget, summarizeRoutineLogs } from "./data";
import { getCoverageOverviewModel, type CoverageLens, type CoverageRange } from "./coverage";
import CardioIndexView from "./CardioIndexView";
import ExercisesIndexView from "./ExercisesIndexView";
import GroupsIndexView from "./GroupsIndexView";
import { PillNav, ProgressShell, SectionCard, SectionLinkButton, TargetCard } from "./ui";
import RoutinesIndexView from "./RoutinesIndexView";
import { exerciseMatchesQuery, exerciseUnitLabel } from "@/lib/exercises";
import { getRecommendationModel, type TrainingRecommendation } from "@/lib/recommendations";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses } from "@/lib/routine-frequency";
import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain, type RoutineDomain } from "@/lib/routines";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const cardGrid: React.CSSProperties = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" };
const subtleText: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, opacity: 0.75 };
const coverageRangeRowStyle: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" };
const coverageRangeButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 9px",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1.2,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
};
const coverageRangeButtonActiveStyle: React.CSSProperties = {
  borderColor: "rgba(120,190,255,0.34)",
  background: "rgba(120,190,255,0.14)",
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCoverageLens(value: string | undefined): CoverageLens {
  return value === "patterns" || value === "sports" ? value : "muscles";
}

function normalizeCoverageRange(value: string | undefined): CoverageRange {
  if (value === "week" || value === "2w" || value === "4w" || value === "12w" || value === "ytd") return value;
  return "4w";
}

function truthyParam(value: string | undefined) {
  return value === "1" || value === "true";
}

function formatShortDate(date: Date | null) {
  if (!date) return "No recent activity";
  return `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}`;
}

function trendLabel(current: number, baseline: number) {
  const safeBaseline = Math.max(0.1, baseline);
  const ratio = current / safeBaseline;
  if (ratio >= 1.2) return "Improving";
  if (ratio <= 0.72) return "Slipping";
  return "Stable";
}

function recommendationLabel(item: TrainingRecommendation) {
  if (item.sourceType === "ROUTINE_TARGET") return "Behind Target";
  if (item.sourceType === "COVERAGE_GAP") return "Coverage Gap";
  if (item.sourceType === "REPETITION") return "Rebalance";
  if (item.sourceType === "MAINTENANCE") return "Maintenance";
  if (item.sourceType === "LIGHT") return "On Track";
  return "Foundation";
}

function recommendationStatus(item: TrainingRecommendation) {
  if (item.sourceType === "ROUTINE_TARGET") return "Behind";
  if (item.sourceType === "COVERAGE_GAP") return item.rationaleSignals.includes("coverage_absent") ? "Quiet" : "Thin";
  if (item.sourceType === "REPETITION") return "Dominating";
  if (item.sourceType === "LIGHT") return "Stable";
  return "Watch";
}

function QuickStatChip({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div style={{ display: "grid", gap: 3, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.55, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1, color: accent ?? "inherit" }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.3 }}>{sub}</div>
    </div>
  );
}

type DomainWeekCell = { domain: RoutineDomain; label: string; weeks: number[] };

function DomainHeatMatrix({ rows, weekLabels }: { rows: DomainWeekCell[]; weekLabels: string[] }) {
  const maxSessions = Math.max(1, ...rows.flatMap((r) => r.weeks));

  function cellFill(count: number): string {
    if (count === 0) return "rgba(255,255,255,0.04)";
    const intensity = Math.min(1, count / Math.max(3, maxSessions));
    return `rgba(84,203,130,${0.12 + intensity * 0.60})`;
  }

  function cellBorder(count: number): string {
    if (count === 0) return "rgba(255,255,255,0.06)";
    return `rgba(84,203,130,${0.15 + Math.min(0.5, (count / Math.max(3, maxSessions)) * 0.5)})`;
  }

  if (rows.length === 0) return <div style={{ fontSize: 13, opacity: 0.55 }}>No training logged in this period.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${weekLabels.length}, minmax(48px, 1fr))`, gap: 4, minWidth: 0 }}>
        {/* Header row */}
        <div />
        {weekLabels.map((label) => (
          <div key={label} style={{ fontSize: 10, fontWeight: 800, opacity: 0.5, textAlign: "center", paddingBottom: 4 }}>{label}</div>
        ))}
        {/* Data rows */}
        {rows.map((row) => (
          <Fragment key={row.domain}>
            <Link
              href={`?tab=routines&domain=${row.domain}`}
              style={{ fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", paddingRight: 8, textDecoration: "none", color: "inherit", opacity: 0.9 }}
            >
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: domainAccent(row.domain), marginRight: 7, flexShrink: 0 }} />
              {row.label}
            </Link>
            {row.weeks.map((count, wi) => (
              <div
                key={`cell-${row.domain}-${wi}`}
                title={count > 0 ? `${count} session${count !== 1 ? "s" : ""}` : "None"}
                style={{
                  height: 36,
                  borderRadius: 8,
                  background: cellFill(count),
                  border: `1px solid ${cellBorder(count)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: count > 0 ? 900 : 400,
                  opacity: count > 0 ? 1 : 0.5,
                  color: count > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.25)",
                }}
              >
                {count > 0 ? count : "·"}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function domainAccent(domain: RoutineDomain): string {
  switch (domain) {
    case "strength":  return "rgba(84,203,130,0.9)";
    case "cardio":    return "rgba(78,148,255,0.9)";
    case "mobility":  return "rgba(192,132,252,0.9)";
    case "sport":     return "rgba(251,146,60,0.9)";
    case "recovery":  return "rgba(251,113,133,0.9)";
    case "skill":     return "rgba(251,199,92,0.9)";
    case "habit":     return "rgba(156,163,175,0.85)";
    default:          return "rgba(156,163,175,0.7)";
  }
}

function FocusCard({
  eyebrow,
  status,
  title,
  summary,
  evidence,
  href,
  ctaLabel,
}: {
  eyebrow: string;
  status: string;
  title: string;
  summary: string;
  evidence: string[];
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="mobileCard" style={{ display: "grid", gap: 10, padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.035)" }}>
      <div className="mobileProgressFocusHeader" style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.68, fontWeight: 900 }}>{eyebrow}</div>
          <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.3, fontWeight: 900 }}>{title}</div>
        </div>
        <span style={{ padding: "5px 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", fontSize: 12, fontWeight: 800 }}>{status}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.82 }}>{summary}</div>
      <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>
        {evidence.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
      <Link href={href} style={{ display: "inline-flex", width: "fit-content", alignItems: "center", justifyContent: "center", padding: "8px 11px", borderRadius: 10, textDecoration: "none", color: "inherit", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 800 }}>
        {ctaLabel}
      </Link>
    </div>
  );
}

function SidebarList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ href: string; title: string; meta: string }>;
}) {
  return (
    <div className="mobileCard" style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 900, color: "rgba(167,224,255,0.88)" }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>{subtitle}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <Link key={`${item.href}-${item.title}`} href={item.href} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 12, textDecoration: "none", color: "inherit", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800 }}>{item.title}</div>
            <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>{item.meta}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function ProgressOverviewPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const params = await Promise.resolve(searchParams ?? {});
  const rawQuery = (getParam(params, "q") ?? "").trim();
  const query = rawQuery.toLowerCase();
  const section = (getParam(params, "section") ?? "overview").trim().toLowerCase();
  const coverageLens = normalizeCoverageLens(getParam(params, "coverageLens"));
  const coverageRange = normalizeCoverageRange(getParam(params, "coverageRange"));
  const showQuietCoverage = truthyParam(getParam(params, "showQuiet"));
  const showAllCoverage = truthyParam(getParam(params, "showAllCoverage"));
  const now = new Date();

  if (section === "routines") return <RoutinesIndexView searchParams={params} />;
  if (section === "exercises") return <ExercisesIndexView searchParams={params} />;
  if (section === "groups") return <GroupsIndexView searchParams={params} />;
  if (section === "cardio") return <CardioIndexView searchParams={params} />;

  const needsExtraCoverageOverview = coverageRange !== "week" && coverageRange !== "4w";
  const [[routines, exercises, groups, recentLogs], weekCoverageOverview, fourWeekCoverageOverview, extraCoverageOverview, recommendationModel] = await Promise.all([
    Promise.all([getRoutineIndex(), getExerciseIndex(), getMetadataIndex(), getRoutineLogs("4w")]),
    getCoverageOverviewModel("week"),
    getCoverageOverviewModel("4w"),
    needsExtraCoverageOverview ? getCoverageOverviewModel(coverageRange) : Promise.resolve(null),
    getRecommendationModel(),
  ]);
  const coverageOverview =
    coverageRange === "week"
      ? weekCoverageOverview
      : coverageRange === "4w"
      ? fourWeekCoverageOverview
      : extraCoverageOverview ?? fourWeekCoverageOverview;

  const maxFrequencyWindowDays = getMaxRoutineFrequencyWindowDays(routines);
  const frequencyWindowStart = new Date(now.getTime() - Math.max(1, maxFrequencyWindowDays) * 24 * 60 * 60 * 1000);
  const frequencyLogs = maxFrequencyWindowDays > 0 ? await prisma.routineLog.findMany({ where: { performedAt: { gte: frequencyWindowStart } }, select: { routineId: true, performedAt: true } }) : [];
  const frequencyStatusByRoutineId = getRoutineFrequencyStatuses({ routines, logs: frequencyLogs, now });

  const activeRoutines = routines.filter((routine) => routine.isActive);
  const cardioRoutines = routines.filter((routine) => routine.kind === "CARDIO");
  const cardioGroups = groups.filter((group) => group.kind === "CARDIO_ACTIVITY");
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLogs = recentLogs.filter((log) => log.performedAt >= weekStart);
  const weekActiveDays = new Set(weekLogs.map((log) => log.performedAt.toISOString().slice(0, 10))).size;
  const baselineWeeklyLogs = fourWeekCoverageOverview.totalLogs / 4;
  const totalCardioMilesWeek = weekLogs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0);

  // Domain heat matrix: domain × week for last 4 weeks
  const routineDomainMap = new Map(
    routines.map((r) => [r.id, effectiveRoutineDomain(r.domain, r.kind, r.subtype)])
  );
  // Build 4 ISO-week labels (Sun-based) going backwards from now
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const heatWeekStarts: Date[] = Array.from({ length: 4 }, (_, i) => new Date(now.getTime() - (3 - i) * msPerWeek));
  const heatWeekLabels: string[] = heatWeekStarts.map((d) => {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}/${day}`;
  });
  const domainOrder: RoutineDomain[] = ["strength", "cardio", "mobility", "sport", "recovery", "skill", "habit"];
  const domainLabel: Record<RoutineDomain, string> = {
    strength: "Strength", cardio: "Cardio", mobility: "Mobility",
    sport: "Sport / Sessions", recovery: "Recovery", skill: "Skill Work",
    habit: "Habits", general: "General",
  };
  // Build a 2D count: domain -> week index -> session count
  const heatData = new Map<RoutineDomain, number[]>();
  for (const d of domainOrder) heatData.set(d, Array(4).fill(0));
  for (const log of recentLogs) {
    const domain = routineDomainMap.get(log.routineId);
    if (!domain || domain === "general") continue;
    const logTime = log.performedAt.getTime();
    const weekIdx = heatWeekStarts.findIndex((wStart, i) => {
      const wEnd = i < 3 ? heatWeekStarts[i + 1].getTime() : now.getTime() + msPerWeek;
      return logTime >= wStart.getTime() && logTime < wEnd;
    });
    if (weekIdx >= 0) {
      const row = heatData.get(domain)!;
      row[weekIdx]++;
    }
  }
  const heatMatrixRows: DomainWeekCell[] = domainOrder
    .filter((domain) => {
      const weeks = heatData.get(domain)!;
      const hasLogs = weeks.some((c) => c > 0);
      const hasRoutine = routines.some((r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === domain && r.isActive);
      return hasLogs || hasRoutine;
    })
    .map((domain) => ({
      domain,
      label: domainLabel[domain],
      weeks: heatData.get(domain)!,
    }));

  const routineSnapshots = activeRoutines
    .map((routine) => {
      const logs = recentLogs.filter((log) => log.routineId === routine.id);
      const summary = summarizeRoutineLogs(logs, routine.timesPerWeek);
      const targetSessions = (routine.timesPerWeek ?? 0) * 4;
      const gap = Math.max(0, targetSessions - summary.sessions);
      const progressRatio = targetSessions > 0 ? summary.sessions / targetSessions : summary.weeksActive / 4;
      return { routine, summary, gap, progressRatio, targetSessions };
    })
    .sort((a, b) => b.summary.sessions - a.summary.sessions || a.routine.name.localeCompare(b.routine.name));
  const routineSnapshotById = new Map(routineSnapshots.map((snapshot) => [snapshot.routine.id, snapshot]));
  const recentActive = routineSnapshots.slice(0, 5);
  const attentionRoutine =
    routineSnapshots.filter((entry) => entry.targetSessions > 0).sort((a, b) => b.gap - a.gap || a.progressRatio - b.progressRatio || b.summary.sessions - a.summary.sessions)[0] ??
    recentActive[0] ??
    null;

  const onTrackRoutines = activeRoutines.filter((routine) => {
    const frequencySummary = frequencyStatusByRoutineId.get(routine.id);
    return frequencySummary?.status === "on_track" || frequencySummary?.status === "ahead";
  }).length;

  const featuredExercise =
    exercises
      .map((exercise) => {
        const sessions = recentLogs.flatMap((log) =>
          log.exercises.filter((entry) => entry.exerciseId === exercise.id).map((entry) => ({
            totalSets: entry.sets.length,
            totalReps: entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
            topWeight: Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0)),
            topSeconds: Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0)),
          }))
        );
        return {
          exercise,
          sessionCount: sessions.length,
          totalSets: sessions.reduce((sum, session) => sum + session.totalSets, 0),
          totalReps: sessions.reduce((sum, session) => sum + session.totalReps, 0),
          topMetric: exercise.unit === "TIME" && !exercise.supportsWeight ? Math.max(0, ...sessions.map((session) => session.topSeconds)) : Math.max(0, ...sessions.map((session) => session.topWeight)),
        };
      })
      .filter((entry) => entry.sessionCount > 0)
      .sort((a, b) => b.sessionCount - a.sessionCount || a.exercise.name.localeCompare(b.exercise.name))[0] ?? null;

  const quickCardioTargets = (
    await Promise.all(cardioGroups.filter((group) => group.slug !== "climbing").map(async (group) => ({ group, target: await resolveGroupTarget(group.slug, "4w") })))
  )
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label))
    .slice(0, 3);

  const featuredGroups = groups.filter((group) => group.appliesToRoutine || group.appliesToExercise).slice(0, 4);
  const selectedCoverageSection = coverageOverview.sections.find((entry) => entry.lens === coverageLens) ?? coverageOverview.sections[0];
  const activeCoverageCategories = selectedCoverageSection.categories.filter((category) => category.totalCount > 0);
  const hiddenQuietCount = selectedCoverageSection.categories.length - activeCoverageCategories.length;
  const categoryPool = showQuietCoverage ? selectedCoverageSection.categories : activeCoverageCategories;
  const visibleCoverageCategories = showAllCoverage ? categoryPool : categoryPool.slice(0, 10);
  const hiddenActiveCount = Math.max(0, categoryPool.length - visibleCoverageCategories.length);

  const focusCards = [recommendationModel.primaryRecommendation, ...recommendationModel.secondaryRecommendations]
    .filter((item): item is TrainingRecommendation => Boolean(item))
    .slice(0, 3)
    .map((item) => {
      const suggestedRoutineId = item.suggestedRoutineIds[0];
      const suggestedRoutine = suggestedRoutineId ? routineSnapshotById.get(suggestedRoutineId) : null;
      return {
        eyebrow: recommendationLabel(item),
        status: recommendationStatus(item),
        title: item.title,
        summary: item.summary,
        evidence: [item.rationale[0], item.behindByCount ? `${item.behindByCount} short in the current window.` : null, suggestedRoutine ? formatShortDate(suggestedRoutine.summary.lastSession) : null].filter((value): value is string => Boolean(value)),
        href: item.suggestedAction.href,
        ctaLabel: item.suggestedAction.label,
      };
    });

  const primaryFocusCard = focusCards[0] ?? (attentionRoutine
    ? {
        eyebrow: "Routine Check",
        status: frequencyStatusByRoutineId.get(attentionRoutine.routine.id)?.status === "behind" ? "Behind" : "Stable",
        title: attentionRoutine.routine.name,
        summary: frequencyStatusByRoutineId.get(attentionRoutine.routine.id)?.detailLabel ?? `${attentionRoutine.summary.sessions} sessions in the last 4 weeks across ${attentionRoutine.summary.weeksActive} active weeks.`,
        evidence: [formatShortDate(attentionRoutine.summary.lastSession), `${attentionRoutine.routine.kind} | ${attentionRoutine.routine.category}`],
        href: `/progress/routines/${attentionRoutine.routine.id}?tab=overview&range=4w`,
        ctaLabel: "Open routine view",
      }
    : null);
  const secondaryFocusCards = focusCards.slice(1, 3);

  const searchResults = query
    ? [
        ...routines.filter((routine) => routine.name.toLowerCase().includes(query) || routine.category.toLowerCase().includes(query)).slice(0, 4).map((routine) => ({ href: `/progress/routines/${routine.id}?tab=overview&range=4w`, title: `Routine: ${routine.name}`, subtitle: `${routine.kind.toLowerCase()} routine in ${routine.category.toLowerCase()}` })),
        ...exercises.filter((exercise) => exerciseMatchesQuery(exercise.name, query)).slice(0, 4).map((exercise) => ({ href: `/progress/exercises/${exercise.id}?tab=overview&range=4w`, title: `Exercise: ${exercise.name}`, subtitle: `${exerciseUnitLabel(exercise.unit)}${exercise.supportsWeight ? ", weighted" : ""} progress view` })),
        ...groups.filter((group) => group.label.toLowerCase().includes(query) || group.slug.includes(query)).slice(0, 6).map((group) => ({ href: group.kind === "CARDIO_ACTIVITY" ? `/progress/cardio/${group.slug}?tab=overview&range=4w` : `/progress/groups/${group.slug}?tab=overview&range=4w`, title: `${group.kind === "CARDIO_ACTIVITY" ? "Sport" : "Coverage group"}: ${group.label}`, subtitle: group.kind === "CARDIO_ACTIVITY" ? "Sport-specific cardio coverage" : `${group.kind.replaceAll("_", " ").toLowerCase()} coverage rollup` })),
      ].slice(0, 10)
    : [];

  const searchSuggestions: ProgressSearchSuggestion[] = [
    ...routines.slice(0, 40).map((routine) => ({
      href: `/progress/routines/${routine.id}?tab=overview&range=4w`,
      title: `Routine: ${routine.name}`,
      subtitle: `${routine.kind.toLowerCase()} routine in ${routine.category.toLowerCase()}`,
      keywords: [routine.name, routine.category, routine.kind],
    })),
    ...exercises.slice(0, 40).map((exercise) => ({
      href: `/progress/exercises/${exercise.id}?tab=overview&range=4w`,
      title: `Exercise: ${exercise.name}`,
      subtitle: `${exerciseUnitLabel(exercise.unit)}${exercise.supportsWeight ? ", weighted" : ""} progress view`,
      keywords: [exercise.name, exercise.unit, exercise.supportsWeight ? "weighted" : "bodyweight"],
    })),
    ...groups.slice(0, 40).map((group) => ({
      href: group.kind === "CARDIO_ACTIVITY" ? `/progress/cardio/${group.slug}?tab=overview&range=4w` : `/progress/groups/${group.slug}?tab=overview&range=4w`,
      title: `${group.kind === "CARDIO_ACTIVITY" ? "Sport" : "Coverage group"}: ${group.label}`,
      subtitle: group.kind === "CARDIO_ACTIVITY" ? "Sport-specific cardio coverage" : `${group.kind.replaceAll("_", " ").toLowerCase()} coverage rollup`,
      keywords: [group.label, group.slug, group.kind.replaceAll("_", " ")],
    })),
  ];

  const coverageHref = (nextLens: CoverageLens, nextRange: CoverageRange = coverageRange, nextQuiet = showQuietCoverage, nextAll = showAllCoverage) => `/progress?coverageLens=${nextLens}&coverageRange=${nextRange}${nextQuiet ? "&showQuiet=1" : ""}${nextAll ? "&showAllCoverage=1" : ""}`;

  return (
    <ProgressShell
      section="overview"
      title="Progress"
      subtitle="One place to scan overall momentum, surface what needs attention, and jump into the right detail view."
      actions={
        <>
          <ProgressSearchTrigger initialQuery={rawQuery} suggestions={searchSuggestions} />
          <SectionLinkButton href="/goals" label="View Goals" />
        </>
      }
    >
      <SectionCard title="This Week" subtitle="Scan the high-level state first, then use Focus Now for the clearest next review.">
        {/* Quick Stats Strip */}
        <div className="mobileProgressQuickStats" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginBottom: 14 }}>
          <QuickStatChip label="Sessions" value={String(weekCoverageOverview.totalLogs)} sub={`${trendLabel(weekCoverageOverview.totalLogs, baselineWeeklyLogs)} vs avg`} accent={weekCoverageOverview.totalLogs > baselineWeeklyLogs ? "rgba(84,203,130,0.95)" : undefined} />
          <QuickStatChip label="Active Days" value={String(weekActiveDays)} sub="this week" />
          <QuickStatChip label="Cardio Miles" value={totalCardioMilesWeek > 0 ? `${totalCardioMilesWeek.toFixed(1)} mi` : "—"} sub="this week" accent={totalCardioMilesWeek > 0 ? "rgba(78,148,255,0.9)" : undefined} />
          <QuickStatChip label="On Target" value={`${onTrackRoutines}/${activeRoutines.length}`} sub="routines" accent={onTrackRoutines >= Math.ceil(activeRoutines.length * 0.6) ? "rgba(84,203,130,0.9)" : "rgba(251,199,92,0.9)"} />
          <QuickStatChip label="Coverage" value={String(weekCoverageOverview.coveredCategoryCounts.muscles)} sub={`muscle groups hit`} />
        </div>

        <div className="mobileProgressOverviewGrid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
          <div className="mobileProgressOverviewPrimary" style={{ display: "grid", gap: 14 }}>
            <div />

            {primaryFocusCard ? (
              <div className="mobileProgressFocusCard" style={{ display: "grid", gap: 14, padding: 16, borderRadius: 20, border: "1px solid rgba(120,190,255,0.18)", background: "radial-gradient(circle at top right, rgba(120,190,255,0.16), transparent 34%), linear-gradient(180deg, rgba(18,34,58,0.96), rgba(12,19,33,0.94))" }}>
                <div className="mobileProgressFocusHeader" style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div className="mobileProgressFocusCopy" style={{ display: "grid", gap: 6, minWidth: 0, flex: "1 1 320px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 900, color: "rgba(167,224,255,0.88)" }}>Focus Now</div>
                    <div className="mobileProgressFocusTitle" style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 950 }}>{primaryFocusCard.title}</div>
                    <div className="mobileProgressFocusSummary" style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.82 }}>{primaryFocusCard.summary}</div>
                  </div>
                  <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,196,107,0.28)", background: "rgba(255,196,107,0.12)", fontSize: 12, fontWeight: 800 }}>{primaryFocusCard.status}</span>
                </div>
                <div className="mobileProgressFocusEvidence" style={{ display: "grid", gap: 8 }}>
                  {primaryFocusCard.evidence.map((item) => (
                    <div key={item} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.045)", fontSize: 13, lineHeight: 1.45, opacity: 0.9 }}>{item}</div>
                  ))}
                </div>
                <div className="mobileProgressFocusActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={primaryFocusCard.href} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 12px", borderRadius: 12, textDecoration: "none", color: "inherit", border: "1px solid rgba(84,203,130,0.34)", background: "rgba(84,203,130,0.18)", fontSize: 12, fontWeight: 900 }}>{primaryFocusCard.ctaLabel}</Link>
                  <Link href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 12px", borderRadius: 12, textDecoration: "none", color: "inherit", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 800 }}>Open dashboard</Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mobileProgressOverviewSecondary" style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 900, color: "rgba(167,224,255,0.88)" }}>Needs Attention</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Concrete watch items</div>
            </div>
            {secondaryFocusCards.length > 0 ? secondaryFocusCards.map((card) => <FocusCard key={`${card.eyebrow}-${card.title}`} {...card} />) : <div className="mobileCard" style={{ padding: "14px 16px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontSize: 13, opacity: 0.78 }}>No additional high-priority watch items right now.</div>}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Training Balance"
        subtitle="Sessions logged per training domain, week by week. Empty cells for active domains are where the gaps are."
      >
        <DomainHeatMatrix rows={heatMatrixRows} weekLabels={heatWeekLabels} />
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {heatMatrixRows.filter((r) => r.weeks.every((c) => c === 0)).map((r) => (
            <span key={r.domain} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 999, border: "1px solid rgba(251,113,133,0.3)", background: "rgba(251,113,133,0.08)", color: "rgba(251,113,133,0.9)", fontWeight: 800 }}>
              {r.label} — no sessions in 4 weeks
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Coverage"
        subtitle={`${selectedCoverageSection.label} in ${coverageOverview.rangeLabel.toLowerCase()}. Quiet rows stay hidden by default so the active evidence is easier to scan.`}
        actions={
          <div className="mobileCoverageHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link href={coverageHref(coverageLens, coverageRange, !showQuietCoverage, showAllCoverage)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 11px", borderRadius: 10, textDecoration: "none", color: "inherit", fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>{showQuietCoverage ? "Hide quiet" : `Show quiet (${hiddenQuietCount})`}</Link>
            {hiddenActiveCount > 0 ? <Link href={coverageHref(coverageLens, coverageRange, showQuietCoverage, !showAllCoverage)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 11px", borderRadius: 10, textDecoration: "none", color: "inherit", fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>{showAllCoverage ? "Show less" : `Show all active (${hiddenActiveCount} more)`}</Link> : null}
          </div>
        }
      >
          <div className="mobileCoverageSectionBody" style={{ display: "grid", gap: 14 }}>
            <div className="mobileCoverageControls" style={{ display: "grid", gap: 10 }}>
              <PillNav items={[{ href: coverageHref("muscles"), label: "Muscle Groups", active: coverageLens === "muscles" }, { href: coverageHref("patterns"), label: "Movement Patterns", active: coverageLens === "patterns" }, { href: coverageHref("sports"), label: "Sports", active: coverageLens === "sports" }]} />
            <div className="mobileCoverageRangeRow" style={coverageRangeRowStyle}>
              {[
                { key: "week", label: "This Week" },
                { key: "2w", label: "Last 2 Weeks" },
                { key: "4w", label: "Last 4 Weeks" },
                { key: "12w", label: "Last 12 Weeks" },
                { key: "ytd", label: "YTD" },
              ].map((item) => (
                <Link
                  key={item.key}
                  href={coverageHref(coverageLens, item.key as CoverageRange)}
                  style={{
                    ...coverageRangeButtonStyle,
                    ...((coverageRange === item.key ? coverageRangeButtonActiveStyle : {}) as React.CSSProperties),
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mobileCoverageSummaryRow" style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div style={subtleText}>{selectedCoverageSection.description}</div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>{showQuietCoverage ? "Quiet rows visible." : hiddenQuietCount > 0 ? `${hiddenQuietCount} quiet rows hidden.` : "Only active rows showing."}</div>
          </div>
          <CoverageGroupedBarChart categories={visibleCoverageCategories} legend={coverageOverview.routineKindLegend} rangeLabel={coverageOverview.rangeLabel} emptyMessage={selectedCoverageSection.emptyMessage} />
        </div>
      </SectionCard>

      <SectionCard title="Drill Down" subtitle="Use these focused entry points when you already know which layer you want to inspect.">
        <div className="mobileProgressDrillGrid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
          <div className="mobileProgressDrillPrimary" style={{ display: "grid", gap: 14 }}>
            {query ? (
              <div className="mobileProgressSearchResults" style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 900, color: "rgba(167,224,255,0.88)" }}>Search results</div>
                {searchResults.length > 0 ? (
                  <div className="mobileProgressSearchResultsGrid" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                    {searchResults.map((result) => (
                      <Link key={`${result.href}-${result.title}`} href={result.href} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none" }}>
                        <div style={{ fontWeight: 800 }}>{result.title}</div>
                        <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>{result.subtitle}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={subtleText}>No progress targets matched that search.</div>
                )}
              </div>
            ) : null}

            <div className="mobileProgressTargetGrid" style={cardGrid}>
              <TargetCard href="/progress?section=routines" eyebrow="Overview" title="Routines" subtitle="Consistency, frequency targets, adherence, and recent momentum." description="Best when the question is whether you are doing the plan often enough." />
              <TargetCard href="/progress?section=exercises" eyebrow="Strength" title="Exercises" subtitle="Top-set trends, reps, volume, and single-movement progression." description="Best when the question is whether one lift or drill is moving." />
              <TargetCard href="/progress?section=cardio" eyebrow="Endurance" title="Cardio" subtitle="Mileage, pace, duration, elevation, and sport-specific conditioning." description="Best when the question is whether cardio or sport output is building." />
              <TargetCard href="/progress?section=groups" eyebrow="Evidence" title="Groups" subtitle="Body-area and movement-pattern rollups across routines." description="Best when the question is what has been covered or neglected lately." />
            </div>
          </div>

          <div className="mobileProgressDrillSidebar" style={{ display: "grid", gap: 12 }}>
            <SidebarList title="Most Active Routines" subtitle="Fast links into the routines driving most of the recent history." items={recentActive.map(({ routine, summary }) => ({ href: `/progress/routines/${routine.id}?tab=overview&range=4w`, title: routine.name, meta: `${summary.sessions} sessions | ${formatShortDate(summary.lastSession)}` }))} />
            <SidebarList title="Quick Cardio Targets" subtitle="High-utility rollups for mileage, duration, and elevation." items={[...quickCardioTargets.map(({ group, target }) => ({ href: `/progress/cardio/${group.slug}?tab=overview&range=4w`, title: group.label, meta: `${target?.logs.length ?? 0} sessions | ${(target?.logs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0) ?? 0).toFixed(1)} mi` })), ...cardioRoutines.slice(0, 1).map((routine) => ({ href: `/progress/routines/${routine.id}?tab=overview&range=4w`, title: routine.name, meta: `${routine.kind} routine` }))]} />
            <SidebarList title="Useful Group Rollups" subtitle="Shortcuts into broader summaries you are likely to revisit." items={featuredGroups.map((group) => ({ href: group.kind === "CARDIO_ACTIVITY" ? `/progress/cardio/${group.slug}?tab=overview&range=4w` : `/progress/groups/${group.slug}?tab=overview&range=4w`, title: group.label, meta: group.kind.replaceAll("_", " ").toLowerCase() }))} />
            {featuredExercise ? <TargetCard href={`/progress/exercises/${featuredExercise.exercise.id}?tab=overview&range=4w`} eyebrow="Featured Exercise" title={featuredExercise.exercise.name} subtitle={featuredExercise.exercise.supportsWeight ? `${featuredExercise.topMetric.toFixed(1)} lb top set` : `${featuredExercise.totalReps} reps logged`} description="A fast single-click check when you want the clearest evidence of progression." chips={[`${featuredExercise.sessionCount} sessions`, `${featuredExercise.totalSets} sets`]} /> : null}
          </div>
        </div>
      </SectionCard>
    </ProgressShell>
  );
}
