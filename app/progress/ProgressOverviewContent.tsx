import Link from "next/link";
import { Fragment, Suspense } from "react";
import CoverageGroupedBarChart from "./CoverageGroupedBarChart";
import DomainHeatMatrix, { type DomainWeekCell, type DomainWeekLog } from "./DomainHeatMatrix";
import ProgressSearchTrigger, { type ProgressSearchSuggestion } from "./ProgressSearchTrigger";
import { getExerciseIndex, getMetadataIndex, getRoutineIndex, getRoutineLogs, resolveGroupTarget, summarizeRoutineLogs } from "./data";
import { getCoverageOverviewModel, type CoverageLens, type CoverageRange } from "./coverage";
import CardioIndexView from "./CardioIndexView";
import ExercisesIndexView from "./ExercisesIndexView";
import GroupsIndexView from "./GroupsIndexView";
import { PillNav, ProgressShell, SectionCard, SectionLinkButton } from "./ui";
import RoutinesIndexView from "./RoutinesIndexView";
import { exerciseMatchesQuery, exerciseUnitLabel } from "@/lib/exercises";
import { getRecommendationModel, type TrainingRecommendation } from "@/lib/recommendations";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses } from "@/lib/routine-frequency";
import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain, type RoutineDomain } from "@/lib/routines";
import { toAppYmd } from "@/lib/dates";

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
      {sub ? <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.3 }}>{sub}</div> : null}
    </div>
  );
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
      <Link href={href} scroll={false} style={{ display: "inline-flex", width: "fit-content", alignItems: "center", justifyContent: "center", padding: "8px 11px", borderRadius: 10, textDecoration: "none", color: "inherit", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 800 }}>
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
          <Link key={`${item.href}-${item.title}`} href={item.href} scroll={false} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 12, textDecoration: "none", color: "inherit", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800 }}>{item.title}</div>
            <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>{item.meta}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Async server component: Focus / Recommendations (streams in) ─────────────

type RoutineSnapshotItem = {
  routine: { id: string; name: string; kind: string; category: string; timesPerWeek: number | null };
  summary: { sessions: number; weeksActive: number; lastSession: Date | null };
  gap: number;
  progressRatio: number;
  targetSessions: number;
};

type FrequencyStatusMap = Map<
  string,
  {
    hasTarget?: boolean;
    status: string;
    detailLabel?: string | null;
    currentCount?: number;
    remainingCount?: number;
    targetCount?: number | null;
  }
>;

async function FocusSection({
  routineSnapshots,
  frequencyStatusByRoutineId,
}: {
  routineSnapshots: RoutineSnapshotItem[];
  frequencyStatusByRoutineId: FrequencyStatusMap;
}) {
  const recommendationModel = await getRecommendationModel();
  const routineSnapshotById = new Map(routineSnapshots.map((s) => [s.routine.id, s]));

  const attentionRoutine =
    routineSnapshots.filter((e) => e.targetSessions > 0).sort((a, b) => b.gap - a.gap || a.progressRatio - b.progressRatio || b.summary.sessions - a.summary.sessions)[0] ??
    routineSnapshots[0] ??
    null;

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
        evidence: [item.rationale[0], item.behindByCount ? `${item.behindByCount} short in the current window.` : null, suggestedRoutine ? formatShortDate(suggestedRoutine.summary.lastSession) : null].filter((v): v is string => Boolean(v)),
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

  return (
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
              <Link href={primaryFocusCard.href} scroll={false} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 12px", borderRadius: 12, textDecoration: "none", color: "inherit", border: "1px solid rgba(84,203,130,0.34)", background: "rgba(84,203,130,0.18)", fontSize: 12, fontWeight: 900 }}>{primaryFocusCard.ctaLabel}</Link>
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
        {secondaryFocusCards.length > 0
          ? secondaryFocusCards.map((card) => <FocusCard key={`${card.eyebrow}-${card.title}`} {...card} />)
          : <div className="mobileCard" style={{ padding: "14px 16px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontSize: 13, opacity: 0.78 }}>No additional high-priority watch items right now.</div>}
      </div>
    </div>
  );
}

// ─── Async server component: Coverage (streams in) ────────────────────────────

async function CoverageSection({
  coverageLens,
  coverageRange,
  showQuiet,
  showAll,
}: {
  coverageLens: CoverageLens;
  coverageRange: CoverageRange;
  showQuiet: boolean;
  showAll: boolean;
}) {
  const coverageOverview = await getCoverageOverviewModel(coverageRange);

  const selectedCoverageSection = coverageOverview.sections.find((e) => e.lens === coverageLens) ?? coverageOverview.sections[0];
  const activeCoverageCategories = selectedCoverageSection.categories.filter((c) => c.totalCount > 0);
  const hiddenQuietCount = selectedCoverageSection.categories.length - activeCoverageCategories.length;
  const categoryPool = showQuiet ? selectedCoverageSection.categories : activeCoverageCategories;
  const visibleCoverageCategories = showAll ? categoryPool : categoryPool.slice(0, 10);
  const hiddenActiveCount = Math.max(0, categoryPool.length - visibleCoverageCategories.length);

  const coverageHref = (nextLens: CoverageLens, nextRange: CoverageRange = coverageRange, nextQuiet = showQuiet, nextAll = showAll) =>
    `/progress?coverageLens=${nextLens}&coverageRange=${nextRange}${nextQuiet ? "&showQuiet=1" : ""}${nextAll ? "&showAllCoverage=1" : ""}`;

  return (
    <SectionCard
      title="Coverage"
      subtitle={`${selectedCoverageSection.label} in ${coverageOverview.rangeLabel.toLowerCase()}. Quiet rows stay hidden by default so the active evidence is easier to scan.`}
      actions={
        <div className="mobileCoverageHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link href={coverageHref(coverageLens, coverageRange, !showQuiet, showAll)} scroll={false} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 11px", borderRadius: 10, textDecoration: "none", color: "inherit", fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>{showQuiet ? "Hide quiet" : `Show quiet (${hiddenQuietCount})`}</Link>
          {hiddenActiveCount > 0 ? <Link href={coverageHref(coverageLens, coverageRange, showQuiet, !showAll)} scroll={false} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 11px", borderRadius: 10, textDecoration: "none", color: "inherit", fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>{showAll ? "Show less" : `Show all active (${hiddenActiveCount} more)`}</Link> : null}
        </div>
      }
    >
      <div className="mobileCoverageSectionBody" style={{ display: "grid", gap: 14 }}>
        <div className="mobileCoverageControls" style={{ display: "grid", gap: 10 }}>
          <PillNav items={[{ href: coverageHref("muscles"), label: "Muscle Groups", active: coverageLens === "muscles" }, { href: coverageHref("patterns"), label: "Movement Patterns", active: coverageLens === "patterns" }, { href: coverageHref("sports"), label: "Sports", active: coverageLens === "sports" }]} />
          <div className="mobileCoverageRangeRow" style={coverageRangeRowStyle}>
            {[
              { key: "week", label: "Last 7 Days" },
              { key: "2w", label: "Last 2 Weeks" },
              { key: "4w", label: "Last 4 Weeks" },
              { key: "12w", label: "Last 12 Weeks" },
              { key: "ytd", label: "YTD" },
            ].map((item) => (
              <Link
                key={item.key}
                href={coverageHref(coverageLens, item.key as CoverageRange)}
                scroll={false}
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
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>{showQuiet ? "Quiet rows visible." : hiddenQuietCount > 0 ? `${hiddenQuietCount} quiet rows hidden.` : "Only active rows showing."}</div>
        </div>
        <CoverageGroupedBarChart categories={visibleCoverageCategories} legend={coverageOverview.routineKindLegend} rangeLabel={coverageOverview.rangeLabel} emptyMessage={selectedCoverageSection.emptyMessage} />
      </div>
    </SectionCard>
  );
}

// ─── Async server component: Drill Down (streams in) ──────────────────────────

type RoutineIndexItem = Awaited<ReturnType<typeof getRoutineIndex>>[number];
type ExerciseIndexItem = Awaited<ReturnType<typeof getExerciseIndex>>[number];
type GroupIndexItem = Awaited<ReturnType<typeof getMetadataIndex>>[number];

async function DrillDownSection({
  groups,
  recentActive,
  featuredExercise,
  featuredGroups,
  cardioRoutines,
  searchResults,
  hasQuery,
}: {
  groups: GroupIndexItem[];
  recentActive: RoutineSnapshotItem[];
  featuredExercise: {
    exercise: ExerciseIndexItem;
    sessionCount: number;
    totalSets: number;
    totalReps: number;
    topMetric: number;
  } | null;
  featuredGroups: GroupIndexItem[];
  cardioRoutines: RoutineIndexItem[];
  searchResults: Array<{ href: string; title: string; subtitle: string }>;
  hasQuery: boolean;
}) {
  const cardioGroups = groups.filter((g) => g.kind === "CARDIO_ACTIVITY" && g.slug !== "climbing");
  const quickCardioTargets = (
    await Promise.all(cardioGroups.map(async (group) => ({ group, target: await resolveGroupTarget(group.slug, "4w") })))
  )
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label))
    .slice(0, 3);

  return (
    <SectionCard title="Quick Access" subtitle="Fast links into the data you check most — active routines, cardio rollups, and group coverage.">
      {hasQuery && searchResults.length > 0 ? (
        <div className="mobileProgressSearchResults" style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", marginBottom: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 900, color: "rgba(167,224,255,0.88)" }}>Search results</div>
          <div className="mobileProgressSearchResultsGrid" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {searchResults.map((result) => (
              <Link key={`${result.href}-${result.title}`} href={result.href} scroll={false} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none" }}>
                <div style={{ fontWeight: 800 }}>{result.title}</div>
                <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>{result.subtitle}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : hasQuery ? (
        <div style={{ padding: "14px 16px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", ...subtleText, marginBottom: 4 }}>No progress targets matched that search.</div>
      ) : null}

      <div className="mobileProgressDrillGrid" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
        <SidebarList
          title="Most Active Routines"
          subtitle="Fast links into the routines driving most of the recent history."
          items={recentActive.map(({ routine, summary }) => ({ href: `/progress/routines/${routine.id}?tab=overview&range=4w`, title: routine.name, meta: `${summary.sessions} sessions · ${formatShortDate(summary.lastSession)}` }))}
        />
        {quickCardioTargets.length > 0 || cardioRoutines.length > 0 ? (
          <SidebarList
            title="Quick Cardio"
            subtitle="High-utility rollups for mileage, duration, and elevation."
            items={[
              ...quickCardioTargets.map(({ group, target }) => ({ href: `/progress/cardio/${group.slug}?tab=overview&range=4w`, title: group.label, meta: `${target?.logs.length ?? 0} sessions · ${(target?.logs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0) ?? 0).toFixed(1)} mi` })),
              ...cardioRoutines.slice(0, 1).map((r) => ({ href: `/progress/routines/${r.id}?tab=overview&range=4w`, title: r.name, meta: "Cardio routine" })),
            ]}
          />
        ) : null}
        <SidebarList
          title="Group Rollups"
          subtitle="Shortcuts into broader coverage summaries you are likely to revisit."
          items={featuredGroups.map((group) => ({ href: group.kind === "CARDIO_ACTIVITY" ? `/progress/cardio/${group.slug}?tab=overview&range=4w` : `/progress/groups/${group.slug}?tab=overview&range=4w`, title: group.label, meta: group.kind === "CARDIO_ACTIVITY" ? "Cardio activity" : group.kind === "MUSCLE_GROUP" ? "Muscle group" : group.kind === "ROUTINE_FOCUS" ? "Session category" : group.kind.replaceAll("_", " ").toLowerCase() }))}
        />
      </div>
    </SectionCard>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

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

  // Early return for index sections (no heavy data needed)
  if (section === "routines") return <RoutinesIndexView searchParams={params} />;
  if (section === "exercises") return <ExercisesIndexView searchParams={params} />;
  if (section === "groups") return <GroupsIndexView searchParams={params} />;
  if (section === "cardio") return <CardioIndexView searchParams={params} />;

  // Fetch all fast data in a single parallel batch.
  const [routines, exercises, groups, recentLogs] = await Promise.all([
    getRoutineIndex(),
    getExerciseIndex(),
    getMetadataIndex(),
    getRoutineLogs("4w"),
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

  // In-memory computations (fast)
  const frequencyStatusByRoutineId = getRoutineFrequencyStatuses({ routines, logs: frequencyLogs, now });
  const activeRoutines = routines.filter((r) => r.isActive);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLogs = recentLogs.filter((log) => log.performedAt >= weekStart);
  const weekActiveDays = new Set(weekLogs.map((log) => toAppYmd(log.performedAt))).size;
  const totalCardioMilesWeek = weekLogs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0);
  // Only count active routines that have an actual frequency target — routines
  // without one have status "no_target" and should not inflate the denominator.
  const activeRoutinesWithTarget = activeRoutines.filter(
    (r) => frequencyStatusByRoutineId.get(r.id)?.hasTarget === true
  );
  const onTrackRoutines = activeRoutinesWithTarget.filter((r) => {
    const fs = frequencyStatusByRoutineId.get(r.id);
    return fs?.status === "on_track" || fs?.status === "ahead";
  }).length;
  const baselineWeeklyLogs = recentLogs.length / 4;

  // Domain heat matrix
  const routineDomainMap = new Map(routines.map((r) => [r.id, effectiveRoutineDomain(r.domain, r.kind, r.subtype)]));
  const routineNameMap = new Map(routines.map((r) => [r.id, r.name]));
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const heatWeekStarts: Date[] = Array.from({ length: 4 }, (_, i) => new Date(now.getTime() - (3 - i) * msPerWeek));
  const heatWeekLabels: string[] = heatWeekStarts.map((d) => `${d.getMonth() + 1}/${d.getDate()}`);
  const domainOrder: RoutineDomain[] = ["strength", "cardio", "mobility", "sport", "recovery", "habit"];
  const domainLabel: Partial<Record<RoutineDomain, string>> = {
    strength: "Strength", cardio: "Cardio", mobility: "Mobility",
    sport: "Sport / Sessions", recovery: "Recovery",
    habit: "Habits",
  };
  const heatData = new Map<RoutineDomain, number[]>();
  const heatLogDetails = new Map<RoutineDomain, DomainWeekLog[][]>();
  for (const d of domainOrder) {
    heatData.set(d, Array(4).fill(0));
    heatLogDetails.set(d, Array.from({ length: 4 }, () => []));
  }
  const shortDateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  for (const log of recentLogs) {
    const domain = routineDomainMap.get(log.routineId);
    if (!domain || !heatData.has(domain)) continue;
    const weekIdx = heatWeekStarts.findIndex((wStart, i) => {
      const wEnd = i < 3 ? heatWeekStarts[i + 1].getTime() : now.getTime() + msPerWeek;
      return log.performedAt.getTime() >= wStart.getTime() && log.performedAt.getTime() < wEnd;
    });
    if (weekIdx >= 0) {
      heatData.get(domain)![weekIdx]++;
      const routineName = routineNameMap.get(log.routineId);
      if (routineName) {
        heatLogDetails.get(domain)![weekIdx].push({
          routineId: log.routineId,
          routineName,
          performedAtLabel: shortDateFmt.format(log.performedAt),
        });
      }
    }
  }
  const heatMatrixRows: DomainWeekCell[] = domainOrder
    .filter((d) => heatData.get(d)!.some((c) => c > 0) || routines.some((r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === d && r.isActive))
    .map((domain) => ({ domain, label: domainLabel[domain] ?? domain, weeks: heatData.get(domain)!, weekLogs: heatLogDetails.get(domain)! }));

  // Routine snapshots
  const routineSnapshots = activeRoutines
    .map((routine) => {
      const logs = recentLogs.filter((log) => log.routineId === routine.id);
      const summary = summarizeRoutineLogs(logs, routine.timesPerWeek);
      const frequencySummary = frequencyStatusByRoutineId.get(routine.id);
      const targetSessions =
        frequencySummary?.hasTarget && typeof frequencySummary.targetCount === "number"
          ? frequencySummary.targetCount
          : 0;
      const gap =
        frequencySummary?.hasTarget && typeof frequencySummary.remainingCount === "number"
          ? frequencySummary.remainingCount
          : 0;
      const progressRatio =
        frequencySummary?.hasTarget && targetSessions > 0
          ? (frequencySummary.currentCount ?? 0) / targetSessions
          : summary.weeksActive / 4;
      return { routine, summary, gap, progressRatio, targetSessions };
    })
    .sort((a, b) => b.summary.sessions - a.summary.sessions || a.routine.name.localeCompare(b.routine.name));
  const recentActive = routineSnapshots.slice(0, 5);

  // Featured exercise
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
          totalSets: sessions.reduce((sum, s) => sum + s.totalSets, 0),
          totalReps: sessions.reduce((sum, s) => sum + s.totalReps, 0),
          topMetric: exercise.unit === "TIME" && !exercise.supportsWeight ? Math.max(0, ...sessions.map((s) => s.topSeconds)) : Math.max(0, ...sessions.map((s) => s.topWeight)),
        };
      })
      .filter((e) => e.sessionCount > 0)
      .sort((a, b) => b.sessionCount - a.sessionCount || a.exercise.name.localeCompare(b.exercise.name))[0] ?? null;

  // Search
  const searchResults = query
    ? [
        ...routines.filter((r) => r.name.toLowerCase().includes(query) || r.category.toLowerCase().includes(query)).slice(0, 4).map((r) => ({ href: `/progress/routines/${r.id}?tab=overview&range=4w`, title: `Routine: ${r.name}`, subtitle: `${r.kind.toLowerCase()} routine in ${r.category.toLowerCase()}` })),
        ...exercises.filter((e) => exerciseMatchesQuery(e.name, query)).slice(0, 4).map((e) => ({ href: `/progress/exercises/${e.id}?tab=overview&range=4w`, title: `Exercise: ${e.name}`, subtitle: `${exerciseUnitLabel(e.unit)}${e.supportsWeight ? ", weighted" : ""} progress view` })),
        ...groups.filter((g) => g.label.toLowerCase().includes(query) || g.slug.includes(query)).slice(0, 6).map((g) => ({ href: g.kind === "CARDIO_ACTIVITY" ? `/progress/cardio/${g.slug}?tab=overview&range=4w` : `/progress/groups/${g.slug}?tab=overview&range=4w`, title: `${g.kind === "CARDIO_ACTIVITY" ? "Sport" : "Coverage group"}: ${g.label}`, subtitle: g.kind === "CARDIO_ACTIVITY" ? "Sport-specific cardio coverage" : `${g.kind.replaceAll("_", " ").toLowerCase()} coverage rollup` })),
      ].slice(0, 10)
    : [];

  const searchSuggestions: ProgressSearchSuggestion[] = [
    ...routines.slice(0, 40).map((r) => ({
      href: `/progress/routines/${r.id}?tab=overview&range=4w`,
      title: `Routine: ${r.name}`,
      subtitle: `${r.kind.toLowerCase()} routine in ${r.category.toLowerCase()}`,
      keywords: [r.name, r.category, r.kind],
    })),
    ...exercises.slice(0, 40).map((e) => ({
      href: `/progress/exercises/${e.id}?tab=overview&range=4w`,
      title: `Exercise: ${e.name}`,
      subtitle: `${exerciseUnitLabel(e.unit)}${e.supportsWeight ? ", weighted" : ""} progress view`,
      keywords: [e.name, e.unit, e.supportsWeight ? "weighted" : "bodyweight"],
    })),
    ...groups.slice(0, 40).map((g) => ({
      href: g.kind === "CARDIO_ACTIVITY" ? `/progress/cardio/${g.slug}?tab=overview&range=4w` : `/progress/groups/${g.slug}?tab=overview&range=4w`,
      title: `${g.kind === "CARDIO_ACTIVITY" ? "Sport" : "Coverage group"}: ${g.label}`,
      subtitle: g.kind === "CARDIO_ACTIVITY" ? "Sport-specific cardio coverage" : `${g.kind.replaceAll("_", " ").toLowerCase()} coverage rollup`,
      keywords: [g.label, g.slug, g.kind.replaceAll("_", " ")],
    })),
  ];

  const featuredGroups = groups.filter((g) => g.appliesToRoutine || g.appliesToExercise).slice(0, 4);
  const cardioRoutines = routines.filter((r) => r.kind === "CARDIO");

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
      {/* ── Last 7 Days: fast stats + streamed focus section ── */}
      <SectionCard title="Last 7 Days" subtitle="Scan the high-level state first, then use Focus Now for the clearest next review.">
        <div className="mobileProgressQuickStats" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginBottom: 14 }}>
          <QuickStatChip label="Sessions" value={String(weekLogs.length)} sub={`${trendLabel(weekLogs.length, baselineWeeklyLogs)} · avg ${baselineWeeklyLogs.toFixed(1)}/wk`} accent={weekLogs.length > baselineWeeklyLogs ? "rgba(84,203,130,0.95)" : undefined} />
          <QuickStatChip label="Active Days" value={`${weekActiveDays}/7`} sub="days trained this week" />
          <QuickStatChip label="Cardio Miles" value={totalCardioMilesWeek > 0 ? `${totalCardioMilesWeek.toFixed(1)} mi` : "—"} sub={totalCardioMilesWeek > 0 ? "this week" : "no cardio logged"} accent={totalCardioMilesWeek > 0 ? "rgba(78,148,255,0.9)" : undefined} />
          {(() => {
            const behindCount = activeRoutinesWithTarget.length - onTrackRoutines;
            const subLabel = activeRoutinesWithTarget.length === 0
              ? "no targets set"
              : behindCount > 0
              ? `${behindCount} behind schedule`
              : "all on track";
            const accent = activeRoutinesWithTarget.length === 0
              ? undefined
              : behindCount === 0
              ? "rgba(84,203,130,0.9)"
              : behindCount <= Math.floor(activeRoutinesWithTarget.length * 0.4)
              ? "rgba(251,199,92,0.9)"
              : "rgba(251,113,133,0.9)";
            return <QuickStatChip label="On Target" value={activeRoutinesWithTarget.length > 0 ? `${onTrackRoutines}/${activeRoutinesWithTarget.length}` : "—"} sub={subLabel} accent={accent} />;
          })()}
        </div>

        <Suspense
          fallback={
            <div className="mobileProgressOverviewGrid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <div className="skeleton" style={{ height: 200, borderRadius: 20 }} />
              <div style={{ display: "grid", gap: 10 }}>
                <div className="skeleton" style={{ height: 90, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 90, borderRadius: 16 }} />
              </div>
            </div>
          }
        >
          <FocusSection
            routineSnapshots={routineSnapshots}
            frequencyStatusByRoutineId={frequencyStatusByRoutineId}
          />
        </Suspense>
      </SectionCard>

      {/* ── Training Balance: fast, in-memory ── */}
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

      {/* ── Coverage: streams in independently ── */}
      <Suspense
        fallback={
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", display: "grid", gap: 6 }}>
              <div className="skeleton" style={{ width: 100, height: 16 }} />
              <div className="skeleton" style={{ width: 280, height: 12 }} />
            </div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div className="skeleton" style={{ height: 32, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
            </div>
          </div>
        }
      >
        <CoverageSection
          coverageLens={coverageLens}
          coverageRange={coverageRange}
          showQuiet={showQuietCoverage}
          showAll={showAllCoverage}
        />
      </Suspense>

      {/* ── Drill Down: streams in independently ── */}
      <Suspense
        fallback={
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", display: "grid", gap: 6 }}>
              <div className="skeleton" style={{ width: 120, height: 16 }} />
              <div className="skeleton" style={{ width: 320, height: 12 }} />
            </div>
            <div style={{ padding: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 18 }} />)}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 18 }} />)}
              </div>
            </div>
          </div>
        }
      >
        <DrillDownSection
          groups={groups}
          recentActive={recentActive}
          featuredExercise={featuredExercise}
          featuredGroups={featuredGroups}
          cardioRoutines={cardioRoutines}
          searchResults={searchResults}
          hasQuery={!!query}
        />
      </Suspense>
    </ProgressShell>
  );
}
