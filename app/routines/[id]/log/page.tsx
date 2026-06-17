import Link from "next/link";
import type React from "react";
import type { Prisma } from "@/generated/prisma";
import { formatGuidedSeconds } from "@/lib/guided";
import { prisma } from "@/lib/prisma";
import { formatHoursMinutes } from "@/lib/progress";
import {
  exerciseLibraryWhereForKinds,
  guidedPreferredLibraryKinds,
  isMissingExerciseLibraryKindError,
  orderExercisesForLibraryContext,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import {
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCardioKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
  normalizeRoutineKind,
} from "@/lib/routines";
import { withSessionMetricConfig, isClimbingTemplateKey } from "@/lib/session-templates";
import {
  buildSpotPickerItems,
  compatibleActivitySlugs,
  getActivitySpotConfig,
  resolveRoutineActivitySlug,
} from "@/lib/activity-spots";
import LogRunForm from "../log-cardio/ui";
import CompletionLogForm from "../log-completion/CompletionLogForm";
import GuidedLogForm from "../log-guided/GuidedLogForm";
import SessionLogForm from "../log-session/SessionLogForm";
import LogWorkoutForm from "./ui";
import { localDateTimeForYmd } from "./date-helpers";
import RoutineInjuryWarningBanner from "@/app/components/injuries/RoutineInjuryWarningBanner";
import { getExerciseInjuryWarnings, getRoutineInjuryLoadWarning, getRoutinePainCheckZones } from "@/lib/injury-warnings";
import { getTemplateDefaultZones } from "@/lib/template-zone-defaults";
import { todayAppYmd, formatUtcDateLabel, diffYmdDays } from "@/lib/dates";
import { getRoutineGoalContributions } from "@/lib/routine-frequency-context";
import ContributesToStrip from "./ContributesToStrip";

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

export default async function LogRoutinePage(props: {
  params: Promise<Params>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams: Record<string, string | string[] | undefined> = await Promise.resolve(
    props.searchParams ?? {}
  );
  const routineId = params?.id;

  // Optional `?date=YYYY-MM-DD` lets callers (the WaG detail card, the
  // heatmap quick-confirm) prefill the form for backfilling a past day.
  const rawDate = searchParams.date;
  const dateParam = Array.isArray(rawDate) ? rawDate[0] : rawDate;
  const backDateYmd = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      kind: true,
      subtype: true,
      metadataGroups: {
        select: { group: { select: { slug: true } } },
      },
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
    ? await (async () => {
        try {
          return await prisma.exercise.findMany({
            where: exerciseLibraryWhereForKinds(workoutLibraryKinds()),
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              unit: true,
              supportsWeight: true,
              libraryKind: true,
            },
          });
        } catch (error) {
          if (!isMissingExerciseLibraryKindError(error)) throw error;
          return withDerivedExerciseLibraryKind(
            await prisma.exercise.findMany({
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                unit: true,
                supportsWeight: true,
              },
            })
          ).filter((exercise) => workoutLibraryKinds().includes(exercise.libraryKind));
        }
      })()
    : [];
  const availableGuidedExercises = isGuidedKind(kind)
    ? await (async () => {
        try {
          return orderExercisesForLibraryContext(
            await prisma.exercise.findMany({
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                unit: true,
                supportsWeight: true,
                libraryKind: true,
              },
            }),
            guidedPreferredLibraryKinds()
          );
        } catch (error) {
          if (!isMissingExerciseLibraryKindError(error)) throw error;
          return orderExercisesForLibraryContext(
            withDerivedExerciseLibraryKind(
              await prisma.exercise.findMany({
                orderBy: { name: "asc" },
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  supportsWeight: true,
                },
              })
            ),
            guidedPreferredLibraryKinds()
          );
        }
      })()
    : [];
  const exerciseIds = isWorkoutKind(kind) ? routine.exercises.map((e) => e.exerciseId) : [];
  const lastExerciseEntries = exerciseIds.length > 0
    ? await Promise.all(
        exerciseIds.map((eid) =>
          prisma.sessionExercise.findFirst({
            where: {
              exerciseId: eid,
              sets: { some: { OR: [{ reps: { not: null } }, { seconds: { not: null } }, { weightLb: { not: null } }] } },
            },
            orderBy: { routineLog: { performedAt: "desc" } },
            select: {
              exerciseId: true,
              routineLog: { select: { performedAt: true } },
              sets: {
                orderBy: { setNumber: "asc" },
                select: { setNumber: true, reps: true, seconds: true, weightLb: true },
              },
            },
          })
        )
      )
    : [];
  const lastExerciseMap = new Map(
    lastExerciseEntries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => [e.exerciseId, e])
  );

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
          where: { routineId, OR: [{ distanceMi: { not: null } }, { durationSec: { not: null } }] },
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

  const initialBlocks = routine.exercises.map((exercise) => {
    const prev = lastExerciseMap.get(exercise.exerciseId);
    const lastRows =
      prev?.sets
        .filter((s) => s.reps !== null || s.seconds !== null || s.weightLb !== null)
        .map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps !== null ? String(s.reps) : undefined,
          seconds: s.seconds !== null ? String(s.seconds) : undefined,
          weightLb: s.weightLb !== null ? String(s.weightLb) : undefined,
        })) ?? [];
    const defaultSetCount = lastRows.length > 0 ? lastRows.length : Math.max(1, exercise.defaultSets ?? 3);
    const lastDate = prev?.routineLog?.performedAt
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(prev.routineLog.performedAt)
      : undefined;

    return {
      exerciseId: exercise.exerciseId,
      name: exercise.exercise.name,
      unit: exercise.exercise.unit,
      supportsWeight: exercise.exercise.supportsWeight,
      rows: Array.from({ length: defaultSetCount }, (_, index) => ({ setNumber: index + 1 })),
      lastRows: lastRows.length > 0 ? lastRows : undefined,
      lastDate,
    };
  });

  const sessionDefinitions = routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];

  // Spot-library data — feeds the structured location pickers in the
  // session/cardio forms. Climbing keeps its bespoke ClimbLocation library;
  // every other spot-eligible activity uses ActivitySpot.
  const sessionTemplateKey = routine.sessionDetails?.template?.key ?? null;
  const isClimbing = isSessionKind(kind) && isClimbingTemplateKey(sessionTemplateKey);
  const activitySlug = isClimbing
    ? null
    : resolveRoutineActivitySlug(routine.metadataGroups, routine.subtype);
  const activitySpotConfig = activitySlug ? getActivitySpotConfig(activitySlug) : null;
  const compatibleSlugs = activitySlug ? compatibleActivitySlugs(activitySlug) : [];
  const includeClimbingSpots = compatibleSlugs.includes("climbing") && !isClimbing;

  const [activePainZones, routineInjuryWarning, exerciseInjuryWarnings, savedClimbLocations, activitySpotRows, climbingCrossRows, goalContributions] = await Promise.all([
    getRoutinePainCheckZones(routineId),
    getRoutineInjuryLoadWarning(routineId),
    isWorkoutKind(kind) ? getExerciseInjuryWarnings(availableExercises.map((e) => e.id)) : Promise.resolve(new Map<string, string>()),
    isClimbing
      ? prisma.climbLocation.findMany({
          select: { id: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    activitySlug && activitySpotConfig?.supportsMap && compatibleSlugs.length > 0
      ? prisma.activitySpot.findMany({
          where: { activitySlug: { in: compatibleSlugs } },
          select: { id: true, activitySlug: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
    includeClimbingSpots
      ? prisma.climbLocation.findMany({
          select: { id: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
    getRoutineGoalContributions(routineId, todayAppYmd()),
  ]);
  const savedSpots = activitySlug
    ? buildSpotPickerItems({
        ownActivitySlug: activitySlug,
        activitySpots: activitySpotRows,
        climbLocations: climbingCrossRows,
      })
    : [];
  const availableExercisesForLog = availableExercises.map((exercise) => ({
    ...exercise,
    injuryWarning: exerciseInjuryWarnings.get(exercise.id),
  }));

  // Inline "Adjust Muscles Worked" data — only meaningful for sport sessions
  // backed by a SessionTemplate. The full zone list lets the user toggle any
  // muscle; the default subset is the template's metadata-derived set.
  const sessionTemplateId = routine.sessionDetails?.template?.id ?? null;
  const [templateDefaultZones, allBodyZones] = isSessionKind(kind) && sessionTemplateId
    ? await Promise.all([
        getTemplateDefaultZones(sessionTemplateId),
        prisma.bodyZone.findMany({
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
          select: { slug: true, label: true },
        }),
      ])
    : [[], []] as const;
  const defaultZoneSlugs = templateDefaultZones.map((zone) => zone.slug);
  const availableZones = allBodyZones.map((zone) => ({ slug: zone.slug, label: zone.label }));

  return (
    <div className="mobileRoutineDetailPage mobilePageShell" style={styles.container}>
      <div className="mobileRoutineLogTopRow mobilePageHeader" style={styles.topRow}>
        <div>
          <h1 className="mobilePageTitle" style={styles.h1}>
            {routine.name} - Log {isWorkoutKind(kind) ? "Workout" : isCardioKind(kind) ? "Cardio" : isGuidedKind(kind) ? "Guided Routine" : isSessionKind(kind) ? "Session" : "Completion"}
          </h1>
          <div className="mobilePageSubtitle" style={styles.sub}>{formatRoutineTypeLabel(routine.kind)}{routine.subtype ? ` | ${formatRoutineSubtype(routine.subtype)}` : ""}</div>
        </div>
        <Link href="/log" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <section className="mobileSectionCard" style={styles.panel}>
        <div className="mobileSectionHeader" style={styles.panelHeader}>{getDetailHeading(kind)}</div>
        <div className="mobileSectionBody" style={{ padding: 14 }}>
          {backDateYmd ? <BackDateBanner ymd={backDateYmd} /> : null}
          <ContributesToStrip contributions={goalContributions} />
          <RoutineInjuryWarningBanner warning={routineInjuryWarning} />
          {isWorkoutKind(kind) ? (
            <LogWorkoutForm
              routineId={routineId}
              routineName={routine.name}
              initialBlocks={initialBlocks}
              availableExercises={availableExercisesForLog}
              activePainZones={activePainZones}
              defaultPerformedAtLocal={backDateYmd ? localDateTimeForYmd(backDateYmd, 12) : undefined}
            />
          ) : isCardioKind(kind) ? (
            <LogRunForm
              routineId={routineId}
              routineName={routine.name}
              activePainZones={activePainZones}
              activitySlug={activitySlug}
              savedSpots={savedSpots}
              defaultPerformedAtLocal={backDateYmd ? localDateTimeForYmd(backDateYmd, 12) : undefined}
            />
          ) : isGuidedKind(kind) ? (
            <GuidedLogForm
              routineId={routineId}
              routineName={routine.name}
              availableExercises={availableGuidedExercises}
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
              activePainZones={activePainZones}
              defaultPerformedAtLocal={backDateYmd ? localDateTimeForYmd(backDateYmd, 12) : undefined}
            />
          ) : isSessionKind(kind) ? (
            <SessionLogForm
              routineId={routineId}
              routineName={routine.name}
              templateKey={routine.sessionDetails?.template?.key ?? null}
              templateName={routine.sessionDetails?.template?.name ?? null}
              definitions={sessionDefinitions}
              preferredClimbingGrades={preferredClimbingGrades(routine.sessionDetails?.templateConfig)}
              activePainZones={activePainZones}
              savedClimbLocations={savedClimbLocations}
              activitySlug={activitySlug}
              savedSpots={savedSpots}
              availableZones={availableZones}
              defaultZoneSlugs={defaultZoneSlugs}
              defaultPerformedAtLocal={backDateYmd ? localDateTimeForYmd(backDateYmd, 12) : undefined}
            />
          ) : (
            <CompletionLogForm routineId={routineId} />
          )}
        </div>
      </section>

      <section className="mobileSectionCard" style={styles.panel}>
        <div className="mobileSectionHeader" style={styles.panelHeader}>{getRecentLogHeading(kind)}</div>
        <div className="mobileSectionBody" style={{ padding: 12, display: "grid", gap: 10 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
          {recentLogs.map((log) => (
            <div key={log.id} className="mobileRoutineLogCard mobileCard" style={styles.logCard}>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 800 }}>{new Date(log.performedAt).toLocaleString()}</div>
                <div style={{ opacity: 0.8, marginTop: 2 }}>
                  {log.type === "WORKOUT"
                    ? `Sets: ${log.setCount}`
                    : log.type === "CARDIO"
                    ? [
                        log.distanceMi != null ? `${log.distanceMi.toFixed(2)} mi` : null,
                        log.durationSec ? formatHoursMinutes(log.durationSec) : null,
                        log.elevationGainFt ? `${log.elevationGainFt} ft` : null,
                      ].filter(Boolean).join(" | ") || "Logged"
                    : log.type === "GUIDED"
                    ? `${log.durationSec ? formatGuidedSeconds(log.durationSec) : "No duration"} | ${log.guidedStepCount} saved items`
                    : log.type === "SESSION"
                    ? `${log.durationSec ? formatHoursMinutes(log.durationSec) : "No duration"}${log.location ? ` | ${log.location}` : ""}`
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

// Banner shown above the log form when arrived via `?date=` — gives the
// user clear feedback that they're back-dating and how far back.
function BackDateBanner({ ymd }: { ymd: string }) {
  const today = todayAppYmd();
  const daysBack = diffYmdDays(today, ymd);
  const dateLabel = formatUtcDateLabel(ymd, { weekday: "long", month: "short", day: "numeric" });
  const ago =
    daysBack === 0
      ? "today"
      : daysBack === 1
      ? "yesterday"
      : `${daysBack} days ago`;
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(251,191,36,0.32)",
        background: "rgba(251,191,36,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(251,191,36,0.95)", letterSpacing: 0.4 }}>BACK-DATING</span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>Logging for {dateLabel}</span>
      <span style={{ fontSize: 11.5, opacity: 0.7 }}>· {ago} · time defaults to noon</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 18 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" },
  h1: { fontSize: 24, fontWeight: 900 as const, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },
  panel: { border, borderRadius: 16, overflow: "hidden" },
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
    borderRadius: 16,
    padding: 14,
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
