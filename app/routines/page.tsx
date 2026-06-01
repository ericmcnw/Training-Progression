import Link from "next/link";
import { formatAppDate, toAppYmd, todayAppYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import StarterPackPageContent from "./StarterPackPageContent";
import { formatRoutineTypeLabel, normalizeRoutineKind, effectiveRoutineDomain, domainColor, ROUTINE_DOMAIN_OPTIONS } from "@/lib/routines";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses, routineWithFrequencyTarget } from "@/lib/routine-frequency";
import { getWeekBoundsSunday } from "@/lib/week";
import { computeHabitStats } from "@/lib/habits";
import RoutineCard from "./RoutineCard";
import RoutineSection from "./RoutineSection";
import QuickLogDrawerButton from "./QuickLogDrawerButton";
import EnduranceQuickLogButton from "./EnduranceQuickLogButton";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

const styles = {
  container: { maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 18 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" as const },
  subText: { marginTop: 6, opacity: 0.75, fontSize: 13 },
  primaryLink: {
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 12,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800,
    background: "rgba(128,128,128,0.12)",
  },
  btnLink: {
    minHeight: 42,
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 12,
    textAlign: "center" as const,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(128,128,128,0.12)",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    minHeight: 46,
    padding: 10,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
  quickLogPill: {
    minHeight: 28,
    padding: "4px 8px",
    border: "1px solid rgba(128,128,128,0.7)",
    borderRadius: 8,
    color: "inherit",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 800,
    fontSize: 11,
    lineHeight: 1.2,
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
  },
};

export default async function RoutinesPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const mode = getParam(searchParams, "mode");
  if (mode === "starter") {
    return <StarterPackPageContent />;
  }

  const searchQuery = (getParam(searchParams, "q") ?? "").trim();
  const normalizedSearchQuery = searchQuery.toLowerCase();
  // Normalize legacy `habit` → `lifestyle` so old bookmarks/links keep working.
  const rawDomainFilter = (getParam(searchParams, "domain") ?? "").trim().toLowerCase();
  const domainFilter = rawDomainFilter === "habit" ? "lifestyle" : rawDomainFilter;
  const now = new Date();
  const { start, end } = getWeekBoundsSunday(now);

  const [rawRoutines, goalRoutines, routineFrequencyGoals] = await Promise.all([
    prisma.routine.findMany({
      // Hide quick-log placeholder routines — they exist purely to host
      // ad-hoc logs and would clutter the routine list otherwise.
      where: { isDeleted: false, isPlaceholder: false },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: {
        exercises: {
          orderBy: { sortOrder: "asc" },
          include: {
            exercise: {
              select: { name: true },
            },
          },
        },
        guidedSteps: {
          orderBy: { sortOrder: "asc" },
          include: {
            exercise: {
              select: { name: true },
            },
          },
        },
        tagAssignments: {
          select: { tag: { select: { name: true } } },
        },
        frequencyGoalRoutines: {
          include: { goal: true },
        },
      },
    }),
    // Fetch all active goal memberships so each card knows which goals it contributes to
    prisma.frequencyGoalRoutine.findMany({
      where: { goal: { isActive: true } },
      select: { routineId: true, goal: { select: { name: true } } },
    }),
    prisma.goal.findMany({
      where: {
        isActive: true,
        goalType: "FREQUENCY",
        targetType: "ROUTINE",
        metricType: "SESSIONS",
      },
      select: {
        name: true,
        targetId: true,
      },
    }),
  ]);

  // Flatten frequencyGoalRoutines into the legacy target shape for downstream
  // helpers (getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses, etc.).
  const routines = rawRoutines.map(routineWithFrequencyTarget);

  // Build routineId → goal name list
  const goalContributionsByRoutineId = new Map<string, string[]>();
  for (const row of goalRoutines) {
    const current = goalContributionsByRoutineId.get(row.routineId) ?? [];
    current.push(row.goal.name);
    goalContributionsByRoutineId.set(row.routineId, current);
  }
  for (const goal of routineFrequencyGoals) {
    const routineId = goal.targetId.trim();
    if (!routineId) continue;
    const current = goalContributionsByRoutineId.get(routineId) ?? [];
    current.push(goal.name);
    goalContributionsByRoutineId.set(routineId, current);
  }
  for (const [routineId, names] of goalContributionsByRoutineId) {
    goalContributionsByRoutineId.set(routineId, Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
  }

  const maxFrequencyWindowDays = getMaxRoutineFrequencyWindowDays(routines);
  const frequencyWindowStart = new Date(now.getTime() - Math.max(1, maxFrequencyWindowDays) * 24 * 60 * 60 * 1000);

  const [latestLogs, frequencyLogs] = await Promise.all([
    prisma.routineLog.groupBy({
      by: ["routineId"],
      _max: { performedAt: true },
    }),
    maxFrequencyWindowDays > 0
      ? prisma.routineLog.findMany({
          where: { performedAt: { gte: frequencyWindowStart } },
          select: { routineId: true, performedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const lastCompletedMap = new Map(latestLogs.map((row) => [row.routineId, row._max.performedAt]));
  const frequencyStatusByRoutineId = getRoutineFrequencyStatuses({
    routines,
    logs: frequencyLogs,
    now,
  });

  // Habit streak computation. Picks up COMPLETION-kind routines with the
  // habit-shaped subtypes — same set that derives to domain=lifestyle. Future
  // work: formalize "habit" rendering as "any routine with a daily-shape
  // FrequencyGoal," independent of domain or subtype.
  const HABIT_COMPLETION_SUBTYPES = new Set(["HABIT", "HEALTH", "OTHER"]);
  const habitRoutineIds = routines
    .filter((r) => r.isActive && r.kind === "COMPLETION" && HABIT_COMPLETION_SUBTYPES.has(String(r.subtype ?? "").toUpperCase()))
    .map((r) => r.id);
  const habitLogs = habitRoutineIds.length > 0
    ? await prisma.routineLog.findMany({
        where: {
          routineId: { in: habitRoutineIds },
          performedAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
        select: { routineId: true, performedAt: true },
      })
    : [];
  const today = todayAppYmd();
  const habitStatsByRoutineId = new Map(
    habitRoutineIds.map((id) => [
      id,
      computeHabitStats(
        habitLogs.filter((l) => l.routineId === id).map((l) => l.performedAt),
        today
      ),
    ])
  );

  const filteredRoutines = routines.filter((routine) => {
    if (normalizedSearchQuery && !routine.name.toLowerCase().includes(normalizedSearchQuery)) return false;
    if (domainFilter) {
      const domain = effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype);
      if (domain !== domainFilter) return false;
    }
    return true;
  });

  const active = filteredRoutines.filter((routine) => routine.isActive);
  const archived = filteredRoutines.filter((routine) => !routine.isActive);

  const domainOrder = ROUTINE_DOMAIN_OPTIONS.map((opt) => opt.value);
  const domainLabelMap = Object.fromEntries(ROUTINE_DOMAIN_OPTIONS.map((opt) => [opt.value, opt.label]));

  const groups = new Map<string, typeof active>();
  for (const routine of active) {
    const domain = effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype);
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain)!.push(routine);
  }

  const orderedDomains = domainOrder.filter((d) => groups.has(d));

  return (
    <div className="mobileRoutinesPage mobilePageShell" style={styles.container}>
      <div className="mobileRoutinesTopRow mobilePageHeader" style={styles.topRow}>
        <div>
          <h1 className="mobilePageTitle" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Routines</h1>
          <div className="mobilePageSubtitle" style={styles.subText}>
            Week (Sun-Sat): {formatAppDate(start)} - {formatAppDate(new Date(end.getTime() - 1))}
          </div>
        </div>

        <div className="mobileActionRow" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/routines?mode=starter" className="mobileRoutinesPrimaryCta" style={styles.primaryLink}>
            Starter Pack
          </Link>
          <Link href="/exercises" className="mobileRoutinesPrimaryCta" style={styles.primaryLink}>
            Manage Exercises
          </Link>
          <NewRoutineDrawerButton className="mobileRoutinesPrimaryCta" style={styles.primaryLink}>
            + New Routine
          </NewRoutineDrawerButton>
        </div>
      </div>

      <form method="get" className="mobileActionStack" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ flex: "1 1 280px", display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search routines by name"
            style={styles.input}
          />
        </label>
        <button type="submit" style={{ ...styles.btnLink, minWidth: 110 }}>
          Search
        </button>
        {searchQuery || domainFilter ? (
          <Link href="/routines" style={styles.btnLink}>
            Clear
          </Link>
        ) : null}
      </form>

      {/* Domain filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.55, letterSpacing: 0.5, marginRight: 2 }}>FILTER</span>
        {ROUTINE_DOMAIN_OPTIONS.map((opt) => {
          const isActive = domainFilter === opt.value;
          const color = domainColor(opt.value);
          return (
            <Link
              key={opt.value}
              href={isActive ? "/routines" : `/routines?domain=${opt.value}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
                color: "inherit",
                border: `1px solid ${isActive ? color.replace("0.9", "0.5") : "rgba(255,255,255,0.12)"}`,
                background: isActive ? color.replace("0.9", "0.15") : "rgba(255,255,255,0.04)",
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: color, display: "inline-block", flexShrink: 0 }} />
              {opt.label}
            </Link>
          );
        })}
      </div>

      <div className="mobileListStack" style={{ display: "grid", gap: 18 }}>
        {(searchQuery || domainFilter) && filteredRoutines.length === 0 ? (
          <section style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: 14, fontSize: 13, opacity: 0.8 }}>
              No routines match{searchQuery ? <> <b>{searchQuery}</b></> : null}{domainFilter ? <> in <b>{domainLabelMap[domainFilter] ?? domainFilter}</b></> : null}.
            </div>
          </section>
        ) : null}
        {orderedDomains.map((domain) => {
          const list = groups.get(domain)!;
          const accent = domainColor(domain);
          const label = domainLabelMap[domain] ?? domain;
          return (
            <RoutineSection
              key={domain}
              title={label.toUpperCase()}
              count={list.length}
              accentColor={accent}
              quickLogSlot={
                domain === "strength" ? (
                  <QuickLogDrawerButton style={styles.quickLogPill} />
                ) : domain === "cardio" ? (
                  // Endurance section uses domain="cardio" under the hood
                  // (see ROUTINE_DOMAIN_OPTIONS in lib/routines). The
                  // section header still reads "Endurance" via that
                  // label map.
                  <EnduranceQuickLogButton style={styles.quickLogPill} />
                ) : undefined
              }
              defaultOpen={!!domainFilter}
            >
              {list.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  lastCompletedMap={lastCompletedMap}
                  allowLogging={true}
                  frequencySummary={frequencyStatusByRoutineId.get(routine.id)!}
                  goalContributions={goalContributionsByRoutineId.get(routine.id) ?? []}
                  habitStats={habitStatsByRoutineId.get(routine.id)}
                />
              ))}
            </RoutineSection>
          );
        })}

        {archived.length > 0 && (
          <RoutineSection title="ARCHIVED" count={archived.length}>
            {archived
              .slice()
              .sort((a, b) => {
                const aType = formatRoutineTypeLabel(normalizeRoutineKind(a.kind));
                const bType = formatRoutineTypeLabel(normalizeRoutineKind(b.kind));
                return aType.localeCompare(bType) || a.name.localeCompare(b.name);
              })
              .map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  lastCompletedMap={lastCompletedMap}
                  allowLogging={false}
                  frequencySummary={frequencyStatusByRoutineId.get(routine.id)!}
                  goalContributions={[]}
                />
              ))}
          </RoutineSection>
        )}
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
        Archived routines show at the bottom. Deleted routines are hidden but logs remain for Progress.
      </div>
    </div>
  );
}
