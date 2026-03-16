import Link from "next/link";
import type { Prisma, Routine } from "@/generated/prisma";
import { formatAppDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCompletionKind,
  isGuidedKind,
  isWorkoutKind,
  normalizeRoutineKind,
} from "@/lib/routines";
import { getWeekBoundsSunday } from "@/lib/week";
import { logRoutineCompletion, removeLastRoutineCompletion } from "./actions";
import DeleteRoutineButton from "./DeleteRoutineButton";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type RoutineWithExercises = Prisma.RoutineGetPayload<{
  include: {
    exercises: {
      orderBy: { sortOrder: "asc" };
      include: { exercise: { select: { name: true } } };
    };
  };
}>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

const styles = {
  container: { maxWidth: 980, margin: "0 auto", padding: 20 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  subText: { marginTop: 6, opacity: 0.75, fontSize: 13 },
  primaryLink: {
    padding: "8px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800,
    background: "rgba(128,128,128,0.12)",
  },
  section: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
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
  card: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
  btnLink: {
    padding: "8px 10px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textAlign: "center" as const,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(128,128,128,0.12)",
    fontWeight: 700,
  },
  smallLink: {
    fontSize: 13,
    color: "inherit",
    opacity: 0.85,
    textDecoration: "none",
  },
  detailsBox: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(128,128,128,0.06)",
  },
  detailsSummary: {
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
  },
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
};

function loggingHref(routine: Pick<Routine, "id" | "kind">) {
  const kind = normalizeRoutineKind(routine.kind);
  if (kind === "WORKOUT") return `/routines/${routine.id}/log`;
  if (kind === "CARDIO") return `/routines/${routine.id}/log-cardio`;
  if (kind === "GUIDED") return `/routines/${routine.id}/log-guided`;
  if (kind === "SESSION") return `/routines/${routine.id}/log-session`;
  return `/routines/${routine.id}/log-completion`;
}

function loggingLabel(kind: string) {
  const normalized = normalizeRoutineKind(kind);
  if (normalized === "WORKOUT") return "Log Workout";
  if (normalized === "CARDIO") return "Log Cardio";
  if (normalized === "GUIDED") return "Log Guided";
  if (normalized === "SESSION") return "Log Session";
  return "Log Completion";
}

function RoutineCard({
  routine,
  weeklyMap,
  lastCompletedMap,
  allowLogging,
}: {
  routine: RoutineWithExercises;
  weeklyMap: Map<string, number>;
  lastCompletedMap: Map<string, Date | null>;
  allowLogging: boolean;
}) {
  const kind = normalizeRoutineKind(routine.kind);
  const count = weeklyMap.get(routine.id) ?? 0;
  const subtypeLabel = formatRoutineSubtype(routine.subtype);
  const exercisePreview = isWorkoutKind(kind)
    ? routine.exercises.map((item) => item.exercise.name).join(", ")
    : "";
  const lastCompletedAt = lastCompletedMap.get(routine.id) ?? null;
  const lastCompletedLabel = lastCompletedAt ? formatAppDate(lastCompletedAt) : "Never";

  return (
    <div key={routine.id} style={{ ...styles.card, opacity: allowLogging ? 1 : 0.7 }}>
      <div className="mobileRoutinesCardShell" style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <div className="mobileRoutinesCardMain" style={{ flex: 1, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            className="mobileRoutinesCardInfo"
            style={{
              flex: 1,
              minWidth: 0,
              display: "grid",
              gap: 10,
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "start",
            }}
          >
              <div className="mobileRoutinesCardPrimary" style={{ display: "grid", gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{routine.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {routine.category} | {formatRoutineTypeLabel(kind)}
                  {subtypeLabel ? ` | ${subtypeLabel}` : ""}
                </div>
                {allowLogging && (
                  <div className="mobileRoutinesCardActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={loggingHref(routine)} style={styles.btnLink}>
                      {loggingLabel(kind)}
                    </Link>
                    {isWorkoutKind(kind) && (
                      <Link href={`/routines/${routine.id}/template`} style={styles.btnLink}>
                        Template
                      </Link>
                    )}
                    {isGuidedKind(kind) && (
                      <Link href={`/routines/${routine.id}/guided`} style={styles.btnLink}>
                        Steps
                      </Link>
                    )}
                    {isCompletionKind(kind) && (
                      <form
                        action={async () => {
                          "use server";
                          await logRoutineCompletion(routine.id);
                        }}
                      >
                        <button type="submit" suppressHydrationWarning style={styles.btnLink}>
                          Quick Log
                        </button>
                      </form>
                    )}
                    {isCompletionKind(kind) && (
                      <form
                        action={async () => {
                          "use server";
                          await removeLastRoutineCompletion(routine.id);
                        }}
                      >
                        <button type="submit" suppressHydrationWarning style={styles.btnLink}>
                          Undo Last
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  This week: <b>{count}</b> logs | Last completed: <b>{lastCompletedLabel}</b>
                </div>
              </div>

            {exercisePreview ? (
              <div
                className="mobileRoutinesExerciseList"
                style={{
                  fontSize: 12,
                  opacity: 0.78,
                  display: "grid",
                  gap: 6,
                  minWidth: 180,
                  maxWidth: 240,
                  alignContent: "start",
                  padding: 10,
                  border: "1px solid rgba(128,128,128,0.25)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.7 }}>
                  Exercises
                </div>
                {routine.exercises.map((item) => (
                  <div
                    key={`${routine.id}-${item.exercise.name}`}
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      width: "100%",
                      paddingBottom: 2,
                    }}
                  >
                    {item.exercise.name}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className="mobileRoutinesCardMeta"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                justifyContent: "flex-end",
                marginLeft: "auto",
                flexShrink: 0,
                alignSelf: "start",
              }}
            >
              <Link href={`/routines/${routine.id}/edit`} style={styles.smallLink}>
                Edit
              </Link>
              {allowLogging && <DeleteRoutineButton routineId={routine.id} />}
            </div>

          </div>
        </div>

        {allowLogging && isCompletionKind(kind) && (
          <div className="mobileRoutinesQuickDate" style={{ minWidth: 0, width: "100%", maxWidth: 280 }}>
            <details style={styles.detailsBox}>
              <summary data-collapsible-summary style={styles.detailsSummary}>
                Quick log with custom date/time
              </summary>
              <form
                style={{ marginTop: 8, display: "grid", gap: 8 }}
                action={async (formData) => {
                  "use server";
                  const performedAtLocal = String(formData.get("performedAtLocal") || "").trim();
                  await logRoutineCompletion(routine.id, performedAtLocal || undefined);
                }}
              >
                <input type="datetime-local" name="performedAtLocal" style={styles.input} />
                <button type="submit" suppressHydrationWarning style={{ ...styles.btnLink, width: "100%" }}>
                  Save Dated Log
                </button>
              </form>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function RoutinesPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const searchQuery = (getParam(searchParams, "q") ?? "").trim();
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const { start, end } = getWeekBoundsSunday(new Date());

  const [routines, weeklyCounts, latestLogs] = await Promise.all([
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
      },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: { performedAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      _max: { performedAt: true },
    }),
  ]);

  const weeklyMap = new Map(weeklyCounts.map((row) => [row.routineId, row._count._all]));
  const lastCompletedMap = new Map(latestLogs.map((row) => [row.routineId, row._max.performedAt]));

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
    <div className="mobileRoutinesPage" style={styles.container}>
      <div className="mobileRoutinesTopRow" style={styles.topRow}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Routines</h1>
          <div style={styles.subText}>
            Week (Sun-Sat): {formatAppDate(start)} - {formatAppDate(new Date(end.getTime() - 1))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/exercises" className="mobileRoutinesPrimaryCta" style={styles.primaryLink}>
            Manage Exercises
          </Link>
          <Link href="/routines/new" className="mobileRoutinesPrimaryCta" style={styles.primaryLink}>
            + New Routine
          </Link>
        </div>
      </div>

      <form method="get" style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
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

      <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
        {searchQuery && filteredRoutines.length === 0 ? (
          <section style={styles.section}>
            <div style={{ padding: 14, fontSize: 13, opacity: 0.8 }}>
              No routines match <b>{searchQuery}</b>.
            </div>
          </section>
        ) : null}
        {orderedTypes.map((typeLabel) => {
          const list = groups.get(typeLabel)!;
          return (
            <section key={typeLabel} style={styles.section}>
              <details open>
                <summary data-collapsible-summary className="mobileRoutinesHeader" style={styles.sectionHeader}>
                  <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>{typeLabel.toUpperCase()}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{list.length} routines</div>
                </summary>
                <div style={{ padding: 12, display: "grid", gap: 10 }}>
                  {list.map((routine) => (
                    <RoutineCard
                      key={routine.id}
                      routine={routine}
                      weeklyMap={weeklyMap}
                      lastCompletedMap={lastCompletedMap}
                      allowLogging={true}
                    />
                  ))}
                </div>
              </details>
            </section>
          );
        })}

        {archived.length > 0 && (
          <section style={styles.section}>
            <details open>
              <summary data-collapsible-summary className="mobileRoutinesHeader" style={styles.sectionHeader}>
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>ARCHIVED</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{archived.length} routines</div>
              </summary>
              <div style={{ padding: 12, display: "grid", gap: 10 }}>
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
