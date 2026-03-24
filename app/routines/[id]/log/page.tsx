import Link from "next/link";
import type React from "react";
import type { Prisma } from "@/generated/prisma";
import { formatGuidedSeconds } from "@/lib/guided";
import { prisma } from "@/lib/prisma";
import {
  isCardioKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
  normalizeRoutineKind,
} from "@/lib/routines";
import { withSessionMetricConfig } from "@/lib/session-templates";
import LogRunForm from "../log-cardio/ui";
import CompletionLogForm from "../log-completion/CompletionLogForm";
import GuidedLogForm from "../log-guided/GuidedLogForm";
import SessionLogForm from "../log-session/SessionLogForm";
import LogWorkoutForm from "./ui";

export const dynamic = "force-dynamic";

type Params = { id: string };

type RoutineLogSummary =
  | { id: string; performedAt: Date; notes: string | null; type: "WORKOUT"; setCount: number }
  | { id: string; performedAt: Date; notes: string | null; type: "CARDIO"; distanceMi: number | null; durationSec: number | null; elevationGainFt: number | null }
  | { id: string; performedAt: Date; notes: string | null; type: "GUIDED"; durationSec: number | null; guidedStepCount: number }
  | { id: string; performedAt: Date; notes: string | null; type: "SESSION"; durationSec: number | null; location: string | null; metricSummary: string | null }
  | { id: string; performedAt: Date; notes: string | null; type: "COMPLETION"; completionCount: number | null };

function preferredClimbingGrades(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).preferredClimbingGrades;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function getDetailHeading(kind: string) {
  if (isWorkoutKind(kind)) return "WORKOUT DETAILS";
  if (isCardioKind(kind)) return "CARDIO DETAILS";
  if (isGuidedKind(kind)) return "GUIDED DETAILS";
  if (isSessionKind(kind)) return "SESSION DETAILS";
  return "COMPLETION DETAILS";
}

function getRecentLogHeading(kind: string) {
  if (isWorkoutKind(kind)) return "RECENT WORKOUT LOGS";
  if (isCardioKind(kind)) return "RECENT CARDIO LOGS";
  if (isGuidedKind(kind)) return "RECENT GUIDED LOGS";
  if (isSessionKind(kind)) return "RECENT SESSION LOGS";
  return "RECENT COMPLETION LOGS";
}

export default async function LogRoutinePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;

  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      category: true,
      kind: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          exerciseId: true,
          defaultSets: true,
          exercise: {
            select: {
              name: true,
              unit: true,
              supportsWeight: true,
            },
          },
        },
      },
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          exerciseId: true,
          durationSec: true,
          restSec: true,
          repeatCount: true,
          repCount: true,
          setCount: true,
          sortOrder: true,
          exercise: { select: { name: true } },
        },
      },
      sessionDetails: {
        select: {
          templateConfig: true,
          template: {
            include: {
              metricDefinitions: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const kind = normalizeRoutineKind(routine.kind);
  const availableExercises = isWorkoutKind(kind)
    ? await prisma.exercise.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          unit: true,
          supportsWeight: true,
        },
      })
    : [];
  const lastWorkoutLog = isWorkoutKind(kind)
    ? await prisma.routineLog.findFirst({
        where: { routineId, exercises: { some: {} } },
        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
        select: {
          performedAt: true,
          exercises: {
            orderBy: { createdAt: "asc" },
            select: {
              exerciseId: true,
              sets: {
                orderBy: { setNumber: "asc" },
                select: {
                  setNumber: true,
                  reps: true,
                  seconds: true,
                  weightLb: true,
                },
              },
            },
          },
        },
      })
    : null;

  const recentLogs: RoutineLogSummary[] = isWorkoutKind(kind)
    ? (
        await prisma.routineLog.findMany({
          where: { routineId, exercises: { some: {} } },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: {
            id: true,
            performedAt: true,
            notes: true,
            exercises: { select: { id: true, sets: { select: { id: true } } } },
          },
        })
      ).map((log) => ({
        id: log.id,
        performedAt: log.performedAt,
        notes: log.notes,
        type: "WORKOUT",
        setCount: log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
      }))
    : isCardioKind(kind)
    ? (
        await prisma.routineLog.findMany({
          where: { routineId, distanceMi: { not: null }, durationSec: { not: null } },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: { id: true, performedAt: true, distanceMi: true, durationSec: true, elevationGainFt: true, notes: true },
        })
      ).map((log) => ({ ...log, type: "CARDIO" as const }))
    : isGuidedKind(kind)
    ? (
        await prisma.routineLog.findMany({
          where: { routineId },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: { id: true, performedAt: true, durationSec: true, notes: true, guidedSteps: { select: { id: true } } },
        })
      ).map((log) => ({
        id: log.id,
        performedAt: log.performedAt,
        durationSec: log.durationSec,
        notes: log.notes,
        guidedStepCount: log.guidedSteps.length,
        type: "GUIDED" as const,
      }))
    : isSessionKind(kind)
    ? (
        await prisma.routineLog.findMany({
          where: { routineId },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: {
            id: true,
            performedAt: true,
            durationSec: true,
            location: true,
            notes: true,
            sessionMetricValues: {
              orderBy: { metricDefinition: { sortOrder: "asc" } },
              select: {
                numberValue: true,
                textValue: true,
                booleanValue: true,
                metricDefinition: {
                  select: {
                    label: true,
                    unit: true,
                  },
                },
              },
            },
          },
        })
      ).map((log) => ({
        id: log.id,
        performedAt: log.performedAt,
        durationSec: log.durationSec,
        location: log.location,
        notes: log.notes,
        metricSummary:
          log.sessionMetricValues
            .map((metric) => {
              if (metric.textValue) return `${metric.metricDefinition.label}: ${metric.textValue}`;
              if (metric.numberValue !== null && metric.numberValue !== undefined) {
                return `${metric.metricDefinition.label}: ${metric.numberValue}${metric.metricDefinition.unit ? ` ${metric.metricDefinition.unit}` : ""}`;
              }
              if (metric.booleanValue !== null && metric.booleanValue !== undefined) {
                return `${metric.metricDefinition.label}: ${metric.booleanValue ? "Yes" : "No"}`;
              }
              return null;
            })
            .filter(Boolean)
            .join(" | ") || null,
        type: "SESSION" as const,
      }))
    : (
        await prisma.routineLog.findMany({
          where: { routineId, exercises: { none: {} }, guidedSteps: { none: {} } },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: { id: true, performedAt: true, notes: true, completionCount: true },
        })
      ).map((log) => ({ ...log, type: "COMPLETION" as const }));

  const lastWorkoutExerciseMap = new Map(
    (lastWorkoutLog?.exercises ?? []).map((exercise) => [exercise.exerciseId, exercise])
  );

  const initialBlocks = routine.exercises.map((exercise) => {
    const previousExercise = lastWorkoutExerciseMap.get(exercise.exerciseId);
    const previousRows =
      previousExercise?.sets
        .filter((set) => set.reps !== null || set.seconds !== null || set.weightLb !== null)
        .map((set) => ({
          setNumber: set.setNumber,
          reps: set.reps !== null ? String(set.reps) : undefined,
          seconds: set.seconds !== null ? String(set.seconds) : undefined,
          weightLb: set.weightLb !== null ? String(set.weightLb) : undefined,
        })) ?? [];

    return {
      exerciseId: exercise.exerciseId,
      name: exercise.exercise.name,
      unit: exercise.exercise.unit,
      supportsWeight: exercise.exercise.supportsWeight,
      rows:
        previousRows.length > 0
          ? previousRows
          : Array.from({ length: Math.max(1, exercise.defaultSets ?? 3) }, (_, index) => ({
              setNumber: index + 1,
            })),
    };
  });

  const sessionDefinitions = routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>
            {routine.name} - Log {isWorkoutKind(kind) ? "Workout" : isCardioKind(kind) ? "Cardio" : isGuidedKind(kind) ? "Guided Routine" : isSessionKind(kind) ? "Session" : "Completion"}
          </h1>
          <div style={styles.sub}>{routine.category}</div>
        </div>
        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>{getDetailHeading(kind)}</div>
        <div style={{ padding: 14 }}>
          {isWorkoutKind(kind) ? (
            <LogWorkoutForm
              routineId={routineId}
              initialBlocks={initialBlocks}
              availableExercises={availableExercises}
              smartDefaultLabel={
                lastWorkoutLog?.performedAt
                  ? `Prefilled from your last workout on ${new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                    }).format(lastWorkoutLog.performedAt)}.`
                  : null
              }
            />
          ) : isCardioKind(kind) ? (
            <LogRunForm routineId={routineId} />
          ) : isGuidedKind(kind) ? (
            <GuidedLogForm
              routineId={routineId}
              steps={routine.guidedSteps.map((step) => ({
                id: step.id,
                kind: step.kind,
                title: step.title,
                exerciseId: step.exerciseId,
                exerciseName: step.exercise?.name ?? null,
                durationSec: step.durationSec,
                restSec: step.restSec,
                repeatCount: step.repeatCount,
                repCount: step.repCount,
                setCount: step.setCount,
                sortOrder: step.sortOrder,
              }))}
            />
          ) : isSessionKind(kind) ? (
            <SessionLogForm
              routineId={routineId}
              templateKey={routine.sessionDetails?.template?.key ?? null}
              templateName={routine.sessionDetails?.template?.name ?? null}
              definitions={sessionDefinitions}
              preferredClimbingGrades={preferredClimbingGrades(routine.sessionDetails?.templateConfig)}
            />
          ) : (
            <CompletionLogForm routineId={routineId} />
          )}
        </div>
      </section>

      <section style={{ ...styles.panel, marginTop: 16 }}>
        <div style={styles.panelHeader}>{getRecentLogHeading(kind)}</div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
          {recentLogs.map((log) => (
            <div key={log.id} style={styles.logCard}>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 800 }}>{new Date(log.performedAt).toLocaleString()}</div>
                <div style={{ opacity: 0.8, marginTop: 2 }}>
                  {log.type === "WORKOUT"
                    ? `Sets: ${log.setCount}`
                    : log.type === "CARDIO"
                    ? `${(log.distanceMi ?? 0).toFixed(2)} mi | ${Math.floor((log.durationSec ?? 0) / 60)}m ${(log.durationSec ?? 0) % 60}s${log.elevationGainFt ? ` | ${log.elevationGainFt} ft` : ""}`
                    : log.type === "GUIDED"
                    ? `${log.durationSec ? formatGuidedSeconds(log.durationSec) : "No duration"} | ${log.guidedStepCount} saved items`
                    : log.type === "SESSION"
                    ? `${log.durationSec ? `${Math.round(log.durationSec / 60)} min` : "No duration"}${log.location ? ` | ${log.location}` : ""}`
                    : log.completionCount
                    ? `Count: ${log.completionCount}`
                    : "Simple completion log"}
                </div>
                {log.type === "SESSION" && log.metricSummary ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.metricSummary}</div> : null}
                {log.notes ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.notes}</div> : null}
              </div>
              <Link href={`/routines/${routineId}/logs/${log.id}/edit`} style={styles.editBtn}>
                Edit
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";
const bgBar = "rgba(128,128,128,0.14)";

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 980, margin: "0 auto", padding: 20 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" },
  h1: { fontSize: 24, fontWeight: 900 as const, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },
  panel: { marginTop: 16, border, borderRadius: 12, overflow: "hidden" },
  panelHeader: { padding: "10px 14px", background: bgBar, borderBottom: border, fontWeight: 900 as const },
  linkBtn: {
    padding: "8px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800 as const,
    background: "rgba(128,128,128,0.12)",
  },
  logCard: {
    border: "1px solid rgba(128,128,128,0.28)",
    borderRadius: 10,
    padding: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    background: "rgba(128,128,128,0.06)",
  },
  editBtn: {
    padding: "8px 10px",
    border: "1px solid rgba(128,128,128,0.7)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(128,128,128,0.12)",
    fontWeight: 800 as const,
  },
};
