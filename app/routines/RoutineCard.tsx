import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { formatAppDate } from "@/lib/dates";
import {
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCompletionKind,
  isGuidedKind,
  isWorkoutKind,
  normalizeRoutineKind,
} from "@/lib/routines";
import { formatRoutineTargetLabel, type RoutineFrequencySummary } from "@/lib/routine-frequency";
import {
  logRoutineCompletion,
  logCompletionWithDate,
  removeLastRoutineCompletion,
  updateRoutineFrequencyTarget,
} from "./actions";
import DeleteRoutineButton from "./DeleteRoutineButton";

export type RoutineWithExercises = Prisma.RoutineGetPayload<{
  include: {
    exercises: {
      orderBy: { sortOrder: "asc" };
      include: { exercise: { select: { name: true } } };
    };
    tagAssignments: {
      select: { tag: { select: { name: true } } };
    };
  };
}>;

function loggingHref(routine: Pick<RoutineWithExercises, "id" | "kind">) {
  return `/routines/${routine.id}/log`;
}

function loggingLabel(kind: string) {
  const normalized = normalizeRoutineKind(kind);
  if (normalized === "WORKOUT") return "Log Workout";
  if (normalized === "CARDIO") return "Log Cardio";
  if (normalized === "GUIDED") return "Log Guided";
  if (normalized === "SESSION") return "Log Session";
  return "Log Completion";
}

export default function RoutineCard({
  routine,
  weeklyMap,
  lastCompletedMap,
  allowLogging,
  frequencySummary,
  goalContributions = [],
}: {
  routine: RoutineWithExercises;
  weeklyMap: Map<string, number>;
  lastCompletedMap: Map<string, Date | null>;
  allowLogging: boolean;
  frequencySummary: RoutineFrequencySummary;
  goalContributions?: string[];
}) {
  const kind = normalizeRoutineKind(routine.kind);
  const count = weeklyMap.get(routine.id) ?? 0;
  const subtypeLabel = formatRoutineSubtype(routine.subtype);
  const exercisePreview = isWorkoutKind(kind)
    ? routine.exercises.map((item) => item.exercise.name).join(", ")
    : "";
  const lastCompletedAt = lastCompletedMap.get(routine.id) ?? null;
  const lastCompletedLabel = lastCompletedAt ? formatAppDate(lastCompletedAt) : "Never";

  const quickLogAction = logRoutineCompletion.bind(null, routine.id);
  const undoLastAction = removeLastRoutineCompletion.bind(null, routine.id);
  const datedLogAction = logCompletionWithDate.bind(null, routine.id);

  return (
    <div style={{ ...styles.card, opacity: allowLogging ? 1 : 0.7 }}>
      <div className="mobileRoutinesCardShell" style={{ display: "grid", gap: 12 }}>
        <div
          className="mobileRoutinesCardHeader"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 14,
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
                <Link href={loggingHref(routine)} style={styles.compactBtnLink}>
                  {loggingLabel(kind)}
                </Link>
                {isWorkoutKind(kind) && (
                  <Link href={`/routines/${routine.id}/template`} style={styles.compactBtnLink}>
                    Template
                  </Link>
                )}
                {isGuidedKind(kind) && (
                  <Link href={`/routines/${routine.id}/guided`} style={styles.compactBtnLink}>
                    Steps
                  </Link>
                )}
                {isCompletionKind(kind) && (
                  <form action={quickLogAction}>
                    <button type="submit" suppressHydrationWarning style={styles.compactBtnLink}>
                      Quick Log
                    </button>
                  </form>
                )}
                {isCompletionKind(kind) && (
                  <form action={undoLastAction}>
                    <button type="submit" suppressHydrationWarning style={styles.compactBtnLink}>
                      Undo Last
                    </button>
                  </form>
                )}
              </div>
            )}

            <div style={{ fontSize: 13, opacity: 0.85 }}>
              This week: <b>{count}</b> logs | Last completed: <b>{lastCompletedLabel}</b>
            </div>
            <div style={{ fontSize: 13, opacity: 0.82 }}>
              Target: <b>{frequencySummary.summaryLabel}</b>
              {frequencySummary.hasTarget ? ` | ${frequencySummary.detailLabel}` : ""}
            </div>
            {goalContributions.length > 0 ? (
              <div style={{ fontSize: 12, opacity: 0.72 }}>
                Counts toward: <b>{goalContributions.join(", ")}</b>
              </div>
            ) : null}
            {routine.tagAssignments.length > 0 ? (
              <div style={{ fontSize: 11, opacity: 0.58, display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                {routine.tagAssignments.map((a) => (
                  <span key={a.tag.name} style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 6, padding: "1px 6px" }}>
                    {a.tag.name}
                  </span>
                ))}
              </div>
            ) : null}
            <details style={styles.detailsBox}>
              <summary data-collapsible-summary style={styles.detailsSummary}>
                Adjust target frequency
              </summary>
              <form action={updateRoutineFrequencyTarget} style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <input type="hidden" name="routineId" value={routine.id} />
                <div style={styles.targetEditorRow}>
                  <input
                    name="targetFrequencyCount"
                    style={{ ...styles.input, width: 76 }}
                    inputMode="numeric"
                    defaultValue={routine.targetFrequencyCount ?? 3}
                  />
                  <span style={styles.targetEditorLabel}>times per</span>
                  <input
                    name="targetFrequencyInterval"
                    style={{ ...styles.input, width: 76 }}
                    inputMode="numeric"
                    defaultValue={routine.targetFrequencyInterval ?? 1}
                  />
                  <select
                    name="targetFrequencyUnit"
                    style={{ ...styles.input, width: 110 }}
                    defaultValue={routine.targetFrequencyUnit ?? "WEEK"}
                  >
                    <option value="DAY">day</option>
                    <option value="WEEK">week</option>
                    <option value="MONTH">month</option>
                  </select>
                </div>
                <div style={styles.helpText}>Current target: {formatRoutineTargetLabel(routine)}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="submit" name="intent" value="save" suppressHydrationWarning style={styles.compactBtnLink}>
                    Save Target
                  </button>
                  <button type="submit" name="intent" value="clear" suppressHydrationWarning style={styles.compactBtnLink}>
                    Clear Target
                  </button>
                </div>
              </form>
            </details>
          </div>

          <div
            className="mobileRoutinesCardMetaWrap"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
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
                flexShrink: 0,
                alignSelf: "flex-start",
              }}
            >
              <Link href={`/routines/${routine.id}/edit`} style={styles.smallLink}>
                Edit
              </Link>
              {allowLogging && <DeleteRoutineButton routineId={routine.id} compact />}
            </div>
          </div>
        </div>

        {allowLogging && isCompletionKind(kind) && (
          <div className="mobileRoutinesQuickDate" style={{ minWidth: 0, width: "100%", maxWidth: 320 }}>
            <details style={styles.detailsBox}>
              <summary data-collapsible-summary style={styles.detailsSummary}>
                Quick log with custom date/time
              </summary>
              <form action={datedLogAction} style={{ marginTop: 8, display: "grid", gap: 8 }}>
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

const styles = {
  card: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(128,128,128,0.06)",
  },
  compactBtnLink: {
    minHeight: 38,
    padding: "7px 10px",
    border: "1px solid rgba(128,128,128,0.55)",
    borderRadius: 10,
    textAlign: "center" as const,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(255,255,255,0.05)",
    fontWeight: 700,
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
  detailsBox: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(128,128,128,0.05)",
  },
  detailsSummary: {
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
  },
  targetEditorRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    alignItems: "center" as const,
  },
  targetEditorLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.82,
  },
  helpText: {
    fontSize: 12,
    opacity: 0.74,
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
  smallLink: {
    fontSize: 13,
    color: "inherit",
    opacity: 0.85,
    textDecoration: "none",
  },
};
