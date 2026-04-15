import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import NewRoutinePageContent from "./NewRoutinePageContent";
import QuickWorkoutLogPageContent from "./QuickWorkoutLogPageContent";
import StarterPackPageContent from "./StarterPackPageContent";
import { formatRoutineTypeLabel, normalizeRoutineKind } from "@/lib/routines";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses } from "@/lib/routine-frequency";
import { getWeekBoundsSunday } from "@/lib/week";
import RoutineCard from "./RoutineCard";
import RoutineSection from "./RoutineSection";

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
};

export default async function RoutinesPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const mode = getParam(searchParams, "mode");
  if (mode === "new") {
    return <NewRoutinePageContent />;
  }
  if (mode === "quick-log") {
    return <QuickWorkoutLogPageContent />;
  }
  if (mode === "starter") {
    return <StarterPackPageContent />;
  }

  const searchQuery = (getParam(searchParams, "q") ?? "").trim();
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const now = new Date();
  const { start, end } = getWeekBoundsSunday(now);

  const [routines, goalRoutines, routineFrequencyGoals] = await Promise.all([
    prisma.routine.findMany({
      where: { isDeleted: false },
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

  const filteredRoutines = routines.filter((routine) => {
    if (!normalizedSearchQuery) return true;
    return routine.name.toLowerCase().includes(normalizedSearchQuery);
  });

  const active = filteredRoutines.filter((routine) => routine.isActive);
  const archived = filteredRoutines.filter((routine) => !routine.isActive);

  const groups = new Map<string, typeof active>();
  for (const routine of active) {
    const key = formatRoutineTypeLabel(normalizeRoutineKind(routine.kind));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(routine);
  }

  const orderedTypes = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

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
          <Link href="/routines?mode=new" className="mobileRoutinesPrimaryCta" style={styles.primaryLink}>
            + New Routine
          </Link>
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
        {searchQuery ? (
          <Link href="/routines" style={styles.btnLink}>
            Clear
          </Link>
        ) : null}
      </form>


      <div className="mobileListStack" style={{ display: "grid", gap: 18 }}>
        {searchQuery && filteredRoutines.length === 0 ? (
          <section style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: 14, fontSize: 13, opacity: 0.8 }}>
              No routines match <b>{searchQuery}</b>.
            </div>
          </section>
        ) : null}
        {orderedTypes.map((typeLabel) => {
          const list = groups.get(typeLabel)!;
          const isWorkoutSection = typeLabel === formatRoutineTypeLabel("WORKOUT");
          return (
            <RoutineSection
              key={typeLabel}
              title={typeLabel.toUpperCase()}
              count={list.length}
              quickLogHref={isWorkoutSection ? "/routines?mode=quick-log" : undefined}
            >
              {list.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  lastCompletedMap={lastCompletedMap}
                  allowLogging={true}
                  frequencySummary={frequencyStatusByRoutineId.get(routine.id)!}
                  goalContributions={goalContributionsByRoutineId.get(routine.id) ?? []}
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
