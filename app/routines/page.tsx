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
import { getFrequencyGoalProgressList, getFrequencyGoalWindowDays } from "@/lib/frequency-goals";
import { createFrequencyGoal, deleteFrequencyGoal, updateFrequencyGoal } from "./actions";

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
  section: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 16,
    overflow: "hidden",
  },
  sectionHeader: {
    padding: "10px 14px",
    background: "rgba(128,128,128,0.14)",
    borderBottom: "1px solid rgba(128,128,128,0.25)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    color: "inherit",
    cursor: "pointer",
    listStyle: "none",
  },
  sectionActionLink: {
    position: "absolute" as const,
    right: 14,
    top: 8,
    minHeight: 40,
    padding: "8px 10px",
    border: "1px solid rgba(128,128,128,0.7)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 800,
    fontSize: 12,
    lineHeight: 1.2,
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
  goalCard: {
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: 12,
    padding: "12px 14px",
    background: "rgba(128,128,128,0.05)",
    display: "grid",
    gap: 6,
  },
  detailsBox: {
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(128,128,128,0.04)",
    marginTop: 4,
  },
  detailsSummary: {
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
  },
  compactBtn: {
    minHeight: 36,
    padding: "6px 10px",
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 8,
    background: "rgba(128,128,128,0.1)",
    color: "inherit",
    fontWeight: 700,
    fontSize: 12,
  },
};

export default async function RoutinesPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
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

  const [routines, frequencyGoals] = await Promise.all([
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
        tagAssignments: {
          select: { tag: { select: { name: true } } },
        },
      },
    }),
    prisma.frequencyGoal.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const maxFrequencyWindowDays = getMaxRoutineFrequencyWindowDays(routines);
  const maxGoalWindowDays = frequencyGoals.reduce(
    (max, goal) => Math.max(max, getFrequencyGoalWindowDays(goal)),
    0
  );
  const maxWindowDays = Math.max(maxFrequencyWindowDays, maxGoalWindowDays);
  const frequencyWindowStart = new Date(now.getTime() - Math.max(1, maxFrequencyWindowDays) * 24 * 60 * 60 * 1000);
  const goalsWindowStart = new Date(now.getTime() - Math.max(1, maxWindowDays) * 24 * 60 * 60 * 1000);

  const [weeklyCounts, latestLogs, frequencyLogs, goalLogs] = await Promise.all([
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: { performedAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
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
    frequencyGoals.length > 0
      ? prisma.routineLog.findMany({
          where: { performedAt: { gte: goalsWindowStart } },
          select: { routineId: true, performedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const routineTags = new Map(
    routines.map((r) => [r.id, r.tagAssignments.map((a) => a.tag.name)])
  );
  const goalProgressList = getFrequencyGoalProgressList({
    goals: frequencyGoals,
    routineTags,
    logs: goalLogs,
    now,
  });
  // Map: routineId → goal names it contributes to
  const goalContributionsByRoutineId = new Map<string, string[]>();
  for (const progress of goalProgressList) {
    for (const routineId of progress.matchingRoutineIds) {
      const current = goalContributionsByRoutineId.get(routineId) ?? [];
      current.push(progress.goal.name);
      goalContributionsByRoutineId.set(routineId, current);
    }
  }

  const weeklyMap = new Map(weeklyCounts.map((row) => [row.routineId, row._count._all]));
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

      {/* Group Frequency Goals section */}
      <section className="mobileSectionCard" style={styles.section}>
        <details>
          <summary data-collapsible-summary className="mobileSectionHeader" style={styles.sectionHeader}>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>GROUP FREQUENCY GOALS</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{goalProgressList.length} goals</div>
          </summary>
          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            {goalProgressList.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>No group goals yet. Add one below to track frequency across multiple routines.</div>
            ) : (
              goalProgressList.map((progress) => (
                <div key={progress.goal.id} style={styles.goalCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" as const }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{progress.goal.name}</div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: progress.status === "behind" ? "rgba(255,100,100,0.9)" : progress.status === "ahead" ? "rgba(100,220,100,0.9)" : "rgba(100,200,255,0.9)",
                    }}>
                      {progress.summaryLabel}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{progress.detailLabel}</div>
                  <div style={{ fontSize: 11, opacity: 0.65 }}>
                    Tags: {progress.goal.matchTags.join(", ")} · {progress.matchingRoutineIds.length} matching routines
                  </div>
                  <details style={styles.detailsBox}>
                    <summary data-collapsible-summary style={styles.detailsSummary}>Edit goal</summary>
                    <form action={updateFrequencyGoal} style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <input type="hidden" name="id" value={progress.goal.id} />
                      <input name="name" defaultValue={progress.goal.name} style={styles.input} placeholder="Goal name" />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
                        <input name="targetCount" defaultValue={progress.goal.targetCount} style={{ ...styles.input, width: 70 }} inputMode="numeric" />
                        <span style={{ fontSize: 12, opacity: 0.8 }}>times per</span>
                        <input name="targetInterval" defaultValue={progress.goal.targetInterval} style={{ ...styles.input, width: 70 }} inputMode="numeric" />
                        <select name="targetUnit" defaultValue={progress.goal.targetUnit} style={{ ...styles.input, width: 110 }}>
                          <option value="DAY">day</option>
                          <option value="WEEK">week</option>
                          <option value="MONTH">month</option>
                        </select>
                      </div>
                      <input name="matchTags" defaultValue={progress.goal.matchTags.join(", ")} style={styles.input} placeholder="pull, climbing..." />
                      <div style={{ fontSize: 11, opacity: 0.65 }}>Comma-separated tags — any routine with a matching tag counts toward this goal.</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="submit" suppressHydrationWarning style={styles.compactBtn}>Save</button>
                        <button formAction={deleteFrequencyGoal.bind(null, progress.goal.id)} type="submit" suppressHydrationWarning style={{ ...styles.compactBtn, borderColor: "rgba(255,80,80,0.5)" }}>Delete</button>
                      </div>
                    </form>
                  </details>
                </div>
              ))
            )}

            <details style={styles.detailsBox}>
              <summary data-collapsible-summary style={styles.detailsSummary}>+ New group goal</summary>
              <form action={createFrequencyGoal} style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <input name="name" style={styles.input} placeholder="Goal name (e.g. Pull Sessions)" required />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
                  <input name="targetCount" defaultValue={3} style={{ ...styles.input, width: 70 }} inputMode="numeric" />
                  <span style={{ fontSize: 12, opacity: 0.8 }}>times per</span>
                  <input name="targetInterval" defaultValue={1} style={{ ...styles.input, width: 70 }} inputMode="numeric" />
                  <select name="targetUnit" defaultValue="WEEK" style={{ ...styles.input, width: 110 }}>
                    <option value="DAY">day</option>
                    <option value="WEEK">week</option>
                    <option value="MONTH">month</option>
                  </select>
                </div>
                <input name="matchTags" style={styles.input} placeholder="pull, climbing, strength..." required />
                <div style={{ fontSize: 11, opacity: 0.65 }}>Any routine tagged with any of these will count toward this goal.</div>
                <button type="submit" suppressHydrationWarning style={styles.compactBtn}>Create Goal</button>
              </form>
            </details>
          </div>
        </details>
      </section>

      <div className="mobileListStack" style={{ display: "grid", gap: 18 }}>
        {searchQuery && filteredRoutines.length === 0 ? (
          <section style={styles.section}>
            <div style={{ padding: 14, fontSize: 13, opacity: 0.8 }}>
              No routines match <b>{searchQuery}</b>.
            </div>
          </section>
        ) : null}
        {orderedTypes.map((typeLabel) => {
          const list = groups.get(typeLabel)!;
          const isWorkoutSection = typeLabel === formatRoutineTypeLabel("WORKOUT");
          return (
            <section key={typeLabel} className="mobileSectionCard" style={styles.section}>
              <details open style={{ position: "relative" }}>
                <summary
                  data-collapsible-summary
                  className="mobileRoutinesHeader mobileSectionHeader"
                  style={{
                    ...styles.sectionHeader,
                    ...(isWorkoutSection ? { paddingRight: 118 } : null),
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>{typeLabel.toUpperCase()}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{list.length} routines</div>
                </summary>
                {isWorkoutSection ? (
                  <Link href="/routines?mode=quick-log" style={styles.sectionActionLink}>
                    Quick Log
                  </Link>
                ) : null}
                <div className="mobileSectionBody" style={{ padding: 12, display: "grid", gap: 10 }}>
                  {list.map((routine) => (
                    <RoutineCard
                      key={routine.id}
                      routine={routine}
                      weeklyMap={weeklyMap}
                      lastCompletedMap={lastCompletedMap}
                      allowLogging={true}
                      frequencySummary={frequencyStatusByRoutineId.get(routine.id)!}
                      goalContributions={goalContributionsByRoutineId.get(routine.id) ?? []}
                    />
                  ))}
                </div>
              </details>
            </section>
          );
        })}

        {archived.length > 0 && (
          <section className="mobileSectionCard" style={styles.section}>
            <details open>
              <summary data-collapsible-summary className="mobileRoutinesHeader mobileSectionHeader" style={styles.sectionHeader}>
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>ARCHIVED</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{archived.length} routines</div>
              </summary>
              <div className="mobileSectionBody" style={{ padding: 12, display: "grid", gap: 10 }}>
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
                      weeklyMap={weeklyMap}
                      lastCompletedMap={lastCompletedMap}
                      allowLogging={false}
                      frequencySummary={frequencyStatusByRoutineId.get(routine.id)!}
                      goalContributions={[]}
                    />
                  ))}
              </div>
            </details>
          </section>
        )}
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
        Archived routines show at the bottom. Deleted routines are hidden but logs remain for Progress.
      </div>
    </div>
  );
}
