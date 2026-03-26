import Link from "next/link";
import CoverageGroupedBarChart from "./CoverageGroupedBarChart";
import {
  getExerciseIndex,
  getMetadataIndex,
  getRoutineIndex,
  getRoutineLogs,
  resolveGroupTarget,
  summarizeRoutineLogs,
} from "./data";
import { getCoverageOverviewModel, type CoverageLens, type CoverageRange } from "./coverage";
import CardioIndexView from "./CardioIndexView";
import ExercisesIndexView from "./ExercisesIndexView";
import GroupsIndexView from "./GroupsIndexView";
import { PillNav, ProgressShell, SectionCard, SectionLinkButton, StatGrid, TargetCard } from "./ui";
import RoutinesIndexView from "./RoutinesIndexView";
import { exerciseMatchesQuery, exerciseUnitLabel } from "@/lib/exercises";
import { getRecommendationModel } from "@/lib/recommendations";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses } from "@/lib/routine-frequency";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatShortDate(date: Date | null) {
  if (!date) return "No recent activity";
  return `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}`;
}

function formatMinutes(seconds: number) {
  return String(Math.round(seconds / 60));
}

function normalizeCoverageLens(value: string | undefined): CoverageLens {
  if (value === "muscles" || value === "patterns" || value === "sports") return value;
  return "muscles";
}

function normalizeCoverageRange(value: string | undefined): CoverageRange {
  if (value === "4w") return "4w";
  return "week";
}

export default async function ProgressOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const query = (getParam(params, "q") ?? "").trim().toLowerCase();
  const section = (getParam(params, "section") ?? "overview").trim().toLowerCase();
  const coverageLens = normalizeCoverageLens(getParam(params, "coverageLens"));
  const coverageRange = normalizeCoverageRange(getParam(params, "coverageRange"));
  const now = new Date();

  if (section === "routines") {
    return <RoutinesIndexView searchParams={params} />;
  }
  if (section === "exercises") {
    return <ExercisesIndexView searchParams={params} />;
  }
  if (section === "groups") {
    return <GroupsIndexView searchParams={params} />;
  }
  if (section === "cardio") {
    return <CardioIndexView searchParams={params} />;
  }

  const [routines, exercises, groups, recentLogs] = await Promise.all([
    getRoutineIndex(),
    getExerciseIndex(),
    getMetadataIndex(),
    getRoutineLogs("4w"),
  ]);
  const [coverageOverview, recommendationModel] = await Promise.all([
    getCoverageOverviewModel(coverageRange),
    getRecommendationModel(),
  ]);
  const maxFrequencyWindowDays = getMaxRoutineFrequencyWindowDays(routines);
  const frequencyWindowStart = new Date(now.getTime() - Math.max(1, maxFrequencyWindowDays) * 24 * 60 * 60 * 1000);
  const frequencyLogs =
    maxFrequencyWindowDays > 0
      ? await prisma.routineLog.findMany({
          where: { performedAt: { gte: frequencyWindowStart } },
          select: { routineId: true, performedAt: true },
        })
      : [];
  const frequencyStatusByRoutineId = getRoutineFrequencyStatuses({
    routines,
    logs: frequencyLogs,
    now,
  });

  const cardioRoutines = routines.filter((routine) => routine.kind === "CARDIO");
  const activeRoutines = routines.filter((routine) => routine.isActive);
  const cardioGroups = groups.filter((group) => group.kind === "CARDIO_ACTIVITY");

  const routineSnapshots = activeRoutines
    .map((routine) => {
      const logs = recentLogs.filter((log) => log.routineId === routine.id);
      const summary = summarizeRoutineLogs(logs, routine.timesPerWeek);
      const targetSessions = (routine.timesPerWeek ?? 0) * 4;
      const gap = Math.max(0, targetSessions - summary.sessions);
      const progressRatio = targetSessions > 0 ? summary.sessions / targetSessions : summary.weeksActive / 4;

      return { routine, logs, summary, gap, progressRatio, targetSessions };
    })
    .sort((a, b) => b.summary.sessions - a.summary.sessions || a.routine.name.localeCompare(b.routine.name));

  const recentActive = [...routineSnapshots].slice(0, 6);
  const attentionRoutine =
    routineSnapshots
      .filter((entry) => entry.targetSessions > 0)
      .sort((a, b) => b.gap - a.gap || a.progressRatio - b.progressRatio || b.summary.sessions - a.summary.sessions)[0] ??
    recentActive[0] ??
    null;

  const onTrackRoutines = activeRoutines.filter((routine) => {
    const frequencySummary = frequencyStatusByRoutineId.get(routine.id);
    return frequencySummary?.status === "on_track" || frequencySummary?.status === "ahead";
  }).length;

  const exerciseLeaders = exercises
    .map((exercise) => {
      const sessions = recentLogs.flatMap((log) =>
        log.exercises
          .filter((entry) => entry.exerciseId === exercise.id)
          .map((entry) => ({
            totalSets: entry.sets.length,
            totalReps: entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
            totalVolume: entry.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0),
            topWeight: Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0)),
            topSeconds: Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0)),
          }))
      );

      return {
        exercise,
        sessionCount: sessions.length,
        totalSets: sessions.reduce((sum, session) => sum + session.totalSets, 0),
        totalReps: sessions.reduce((sum, session) => sum + session.totalReps, 0),
        totalVolume: sessions.reduce((sum, session) => sum + session.totalVolume, 0),
        topMetric:
          exercise.unit === "TIME" && !exercise.supportsWeight
            ? Math.max(0, ...sessions.map((session) => session.topSeconds))
            : Math.max(0, ...sessions.map((session) => session.topWeight)),
      };
    })
    .filter((entry) => entry.sessionCount > 0)
    .sort((a, b) => {
      const weightedBias = Number(b.exercise.supportsWeight) - Number(a.exercise.supportsWeight);
      return (
        weightedBias ||
        b.sessionCount - a.sessionCount ||
        b.totalVolume - a.totalVolume ||
        b.totalSets - a.totalSets ||
        a.exercise.name.localeCompare(b.exercise.name)
      );
    });

  const featuredExercise = exerciseLeaders[0] ?? null;

  const cardioQuickCandidates = cardioGroups.filter((group) => group.slug !== "climbing");
  const cardioGroupPreviews = await Promise.all(
    cardioQuickCandidates.map(async (group) => ({
      group,
      target: await resolveGroupTarget(group.slug, "4w"),
    }))
  );
  const sortedQuickCardioTargets = cardioGroupPreviews.sort((a, b) => {
    const aHasData = (a.target?.logs.length ?? 0) > 0 ? 1 : 0;
    const bHasData = (b.target?.logs.length ?? 0) > 0 ? 1 : 0;
    if (bHasData !== aHasData) return bHasData - aHasData;
    if (a.group.slug === "running" && b.group.slug !== "running") return -1;
    if (b.group.slug === "running" && a.group.slug !== "running") return 1;
    return (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label);
  });
  const quickCardioTargets = sortedQuickCardioTargets.slice(0, 4);
  const featuredCardio = sortedQuickCardioTargets[0] ?? null;

  const featuredGroups = groups
    .filter((group) => group.appliesToRoutine || group.appliesToExercise)
    .slice(0, 6);
  const selectedCoverageSection =
    coverageOverview.sections.find((entry) => entry.lens === coverageLens) ?? coverageOverview.sections[0];

  const searchResults = query
    ? [
        ...routines
          .filter((routine) => routine.name.toLowerCase().includes(query) || routine.category.toLowerCase().includes(query))
          .slice(0, 5)
          .map((routine) => ({
            href: `/progress/routines/${routine.id}?tab=overview&range=4w`,
            title: routine.name,
            subtitle: `Routine | ${routine.category} | ${routine.kind}`,
          })),
        ...exercises
          .filter((exercise) => exerciseMatchesQuery(exercise.name, query))
          .slice(0, 5)
          .map((exercise) => ({
            href: `/progress/exercises/${exercise.id}?tab=overview&range=4w`,
            title: exercise.name,
            subtitle: `Exercise | ${exerciseUnitLabel(exercise.unit)}${exercise.supportsWeight ? " | Weighted" : ""}`,
          })),
        ...groups
          .filter((group) => group.label.toLowerCase().includes(query) || group.slug.includes(query))
          .slice(0, 8)
          .map((group) => ({
            href:
              group.kind === "CARDIO_ACTIVITY"
                ? `/progress/cardio/${group.slug}?tab=overview&range=4w`
                : `/progress/groups/${group.slug}?tab=overview&range=4w`,
            title: group.label,
            subtitle: `${group.kind === "CARDIO_ACTIVITY" ? "Cardio target" : "Group"} | ${group.kind.replaceAll("_", " ").toLowerCase()}`,
          })),
      ].slice(0, 12)
    : [];

  return (
    <ProgressShell
      section="overview"
      title="Progress"
      subtitle="Use this as the command center for recent activity, frequency, and coverage. The important targets should still be one click away, but the overview now starts with interpretable evidence."
      actions={<SectionLinkButton href="/goals" label="Goals" />}
    >
      <SectionCard
        title="Find Any Target"
        subtitle="Search by the thing you care about first. The app will send you to the right progress view."
      >
        <form method="get" style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="coverageLens" value={coverageLens} />
          <input type="hidden" name="coverageRange" value={coverageRange} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search routines, exercises, cardio targets, or groups"
              style={searchInputStyle}
            />
            <button type="submit" style={searchButtonStyle}>
              Search
            </button>
          </div>
          {query ? (
            searchResults.length > 0 ? (
              <div style={cardGridStyle}>
                {searchResults.map((result) => (
                  <TargetCard key={`${result.href}-${result.title}`} href={result.href} title={result.title} subtitle={result.subtitle} />
                ))}
              </div>
            ) : (
              <div style={helperTextStyle}>No progress targets matched that search.</div>
            )
          ) : (
            <div style={helperTextStyle}>
              Try a routine name, an exercise like squat or pull-up, or a rollup like running, legs, or push.
            </div>
          )}
        </form>
      </SectionCard>

      <SectionCard
        title="Key Signals"
        subtitle={`${coverageOverview.rangeLabel} at a glance. These are the quickest coverage and frequency signals to scan first.`}
      >
        <StatGrid
          items={[
            { label: "Completed logs", value: String(coverageOverview.totalLogs) },
            { label: "Muscle groups hit", value: String(coverageOverview.coveredCategoryCounts.muscles) },
            { label: "Patterns covered", value: String(coverageOverview.coveredCategoryCounts.patterns) },
            { label: "Sports covered", value: String(coverageOverview.coveredCategoryCounts.sports) },
            { label: "Workout logs", value: String(coverageOverview.countsByKind.WORKOUT) },
            { label: "Cardio logs", value: String(coverageOverview.countsByKind.CARDIO) },
            { label: "Guided logs", value: String(coverageOverview.countsByKind.GUIDED) },
            { label: "Session logs", value: String(coverageOverview.countsByKind.SESSION) },
            { label: "Completion logs", value: String(coverageOverview.countsByKind.COMPLETION) },
            { label: "On-track routines", value: `${onTrackRoutines}/${activeRoutines.length}` },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Coverage Overview"
        subtitle={`${selectedCoverageSection.label} in ${coverageOverview.rangeLabel.toLowerCase()}, broken down by routine kind so recent activity is easy to trust and inspect.`}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <PillNav
              items={[
                { href: `/progress?coverageLens=muscles&coverageRange=${coverageRange}`, label: "Muscle Groups", active: coverageLens === "muscles" },
                { href: `/progress?coverageLens=patterns&coverageRange=${coverageRange}`, label: "Movement Patterns", active: coverageLens === "patterns" },
                { href: `/progress?coverageLens=sports&coverageRange=${coverageRange}`, label: "Sports", active: coverageLens === "sports" },
              ]}
            />
            <PillNav
              items={[
                { href: `/progress?coverageLens=${coverageLens}&coverageRange=week`, label: "This Week", active: coverageRange === "week" },
                { href: `/progress?coverageLens=${coverageLens}&coverageRange=4w`, label: "Last 4 Weeks", active: coverageRange === "4w" },
              ]}
            />
          </div>
          <div style={helperTextStyle}>{selectedCoverageSection.description}</div>

          <CoverageGroupedBarChart
            categories={selectedCoverageSection.categories}
            legend={coverageOverview.routineKindLegend}
            rangeLabel={coverageOverview.rangeLabel}
            emptyMessage={selectedCoverageSection.emptyMessage}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Recommendation Snapshot"
        subtitle="Dashboard recommendations now lean on behind-target routines, thin lens coverage, and recent concentration. Progress keeps the evidence visible without turning into another what-next panel."
      >
        {recommendationModel.primaryRecommendation ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={recommendationSnapshotStyle}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{recommendationModel.primaryRecommendation.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.78 }}>{recommendationModel.primaryRecommendation.summary}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {recommendationModel.primaryRecommendation.targetCategories.map((slug) => (
                  <span key={slug} style={coverageChipStyle}>
                    {slug}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href={recommendationModel.primaryRecommendation.suggestedAction.href} style={recommendationActionStyle}>
                  {recommendationModel.primaryRecommendation.suggestedAction.label}
                </a>
                <Link href="/" style={recommendationLinkStyle}>
                  Open dashboard
                </Link>
              </div>
            </div>

            {recommendationModel.secondaryRecommendations.length > 0 ? (
              <div style={cardGridStyle}>
                {recommendationModel.secondaryRecommendations.slice(0, 2).map((item) => (
                  <TargetCard
                    key={item.id}
                    href={item.suggestedAction.href}
                    eyebrow={item.sourceType === "ROUTINE_TARGET" ? "Behind Target" : item.sourceType === "COVERAGE_GAP" ? "Coverage Gap" : "Watch"}
                    title={item.title}
                    subtitle={item.summary}
                    description={item.rationale[0] ?? "Recent evidence suggests this is worth keeping an eye on."}
                    chips={item.targetCategories.slice(0, 2)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={helperTextStyle}>Recommendations will appear here after a bit more routine and coverage history is available.</div>
        )}
      </SectionCard>

      <SectionCard
        title="Start Here"
        subtitle="These are the highest-value entry points right now based on your recent data."
      >
        <div style={featuredGridStyle}>
          {attentionRoutine ? (
            <TargetCard
              href={`/progress/routines/${attentionRoutine.routine.id}?tab=overview&range=4w`}
              eyebrow="Consistency"
              title={attentionRoutine.routine.name}
              subtitle={
                frequencyStatusByRoutineId.get(attentionRoutine.routine.id)?.summaryLabel ??
                `${attentionRoutine.summary.sessions} sessions in the last 4 weeks`
              }
              description={
                frequencyStatusByRoutineId.get(attentionRoutine.routine.id)?.hasTarget
                  ? frequencyStatusByRoutineId.get(attentionRoutine.routine.id)?.detailLabel ??
                    "Best place to review adherence first, then drop into completion and workload."
                  : "This routine has the most recent momentum, so it is a strong first stop for routine-level progress."
              }
              chips={[
                `${attentionRoutine.summary.weeksActive} active weeks`,
                frequencyStatusByRoutineId.get(attentionRoutine.routine.id)?.shortStatusLabel ?? "No target",
                formatShortDate(attentionRoutine.summary.lastSession),
              ]}
              emphasis="featured"
            />
          ) : null}

          {featuredExercise ? (
            <TargetCard
              href={`/progress/exercises/${featuredExercise.exercise.id}?tab=overview&range=4w`}
              eyebrow="Strength"
              title={featuredExercise.exercise.name}
              subtitle={
                featuredExercise.exercise.supportsWeight
                  ? "Useful for fast top-set and workload checks."
                  : "Useful for session-by-session output and volume checks."
              }
              description="Use the exercise view when you want the clearest graph for progression on a single movement."
              chips={[
                `${featuredExercise.sessionCount} sessions`,
                `${featuredExercise.totalSets} sets`,
                featuredExercise.exercise.supportsWeight
                  ? `${featuredExercise.topMetric.toFixed(1)} lb top set`
                  : `${featuredExercise.totalReps} reps`,
              ]}
              emphasis="featured"
            />
          ) : null}

          {featuredCardio ? (
            <TargetCard
              href={`/progress/cardio/${featuredCardio.group.slug}?tab=overview&range=4w`}
              eyebrow="Cardio"
              title={featuredCardio.group.label}
              subtitle="Most useful cardio rollup to review first."
              description="This view surfaces pace, weekly distance, and total session load in the cleanest cardio layout."
              chips={[
                `${featuredCardio.target?.logs.length ?? 0} sessions`,
                `${(featuredCardio.target?.logs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0) ?? 0).toFixed(1)} mi`,
                `${(featuredCardio.target?.logs.reduce((sum, log) => sum + (log.elevationGainFt ?? 0), 0) ?? 0).toFixed(0)} ft`,
                `${formatMinutes(featuredCardio.target?.logs.reduce((sum, log) => sum + (log.durationSec ?? 0), 0) ?? 0)} min`,
              ]}
              emphasis="featured"
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Browse By Goal"
        subtitle="Pick the analysis mode that matches the question you are trying to answer."
      >
        <div style={cardGridStyle}>
          <TargetCard
            href="/progress?section=routines"
            eyebrow="Stay Consistent"
            title="Routine Progress"
            subtitle="Best for adherence, recent momentum, and weekly workload."
            description="Start here when you want to know whether a program is being executed as planned."
          />
          <TargetCard
            href="/progress?section=exercises"
            eyebrow="Build Strength"
            title="Exercise Progress"
            subtitle="Best for top-set trends, reps, and single-exercise workload."
            description="This is the fastest path to the most important strength graphs in the app."
          />
          <TargetCard
            href="/progress?section=cardio"
            eyebrow="Endurance"
            title="Cardio Progress"
            subtitle="Best for weekly mileage, pace, duration, and cardio consistency."
            description="Use cardio rollups when you want running and other conditioning targets summarized cleanly."
          />
          <TargetCard
            href="/progress?section=groups"
            eyebrow="Patterns"
            title="Group Progress"
            subtitle="Best for body-area and movement-pattern rollups."
            description="Use groups to answer broader questions like how much legs, push, lower body, or climbing work is happening."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Most Active Routines"
        subtitle="High-traffic routines should always be easy to reach from the overview."
      >
        <div style={cardGridStyle}>
          {recentActive.map(({ routine, summary }) => (
            <TargetCard
              key={routine.id}
              href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
              title={routine.name}
              subtitle={`${routine.category} | ${routine.kind}`}
              chips={[
                `${summary.sessions} sessions`,
                `${summary.weeksActive} active weeks`,
                formatShortDate(summary.lastSession),
              ]}
            />
          ))}
        </div>
      </SectionCard>

      <div style={twoColumnStyle}>
        <SectionCard
          title="Quick Cardio Targets"
          subtitle="Fast access to the cardio rollups you are most likely to check often."
        >
          <div style={cardGridStyle}>
            {quickCardioTargets.map(({ group, target }) => (
              <TargetCard
                key={group.id}
                href={`/progress/cardio/${group.slug}?tab=overview&range=4w`}
                title={group.label}
                subtitle={(target?.logs.length ?? 0) > 0 ? "Cardio rollup target" : "Cardio rollup target | no recent data"}
                chips={[
                  `${target?.logs.length ?? 0} sessions`,
                  `${(target?.logs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0) ?? 0).toFixed(1)} mi`,
                  `${(target?.logs.reduce((sum, log) => sum + (log.elevationGainFt ?? 0), 0) ?? 0).toFixed(0)} ft`,
                ]}
              />
            ))}
            {cardioRoutines.slice(0, 2).map((routine) => (
              <TargetCard
                key={routine.id}
                href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
                title={routine.name}
                subtitle="Specific cardio routine"
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Useful Group Rollups"
          subtitle="Broader summaries for spotting training balance across related areas."
        >
          <div style={cardGridStyle}>
            {featuredGroups.map((group) => (
              <TargetCard
                key={group.id}
                href={`/progress/groups/${group.slug}?tab=overview&range=4w`}
                title={group.label}
                subtitle={group.kind.replaceAll("_", " ")}
              />
            ))}
          </div>
        </SectionCard>
      </div>
    </ProgressShell>
  );
}

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const featuredGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const coverageChipStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  fontSize: 12,
  fontWeight: 700,
};

const recommendationSnapshotStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(142,197,255,0.18)",
  background: "linear-gradient(135deg, rgba(142,197,255,0.1), rgba(84,203,130,0.05))",
};

const recommendationActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(84,203,130,0.34)",
  background: "rgba(84,203,130,0.16)",
  fontSize: 12,
  fontWeight: 900,
};

const recommendationLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  fontSize: 12,
  fontWeight: 800,
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
};

const searchInputStyle: React.CSSProperties = {
  flex: "1 1 320px",
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
};

const searchButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.08)",
  color: "inherit",
  fontWeight: 800,
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  opacity: 0.75,
};
