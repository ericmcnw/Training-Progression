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
  effectiveRoutineDomain,
  domainColor,
} from "@/lib/routines";
import DrawerLogButton from "./DrawerLogButton";
import type { computeHabitStats } from "@/lib/habits";
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
    guidedSteps: {
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

function formatRoutinePreviewExerciseName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s*\((reps|time)\)\s*$/i, "");
}

function getDefiningLabel(routine: RoutineWithExercises) {
  const subtypeLabel = formatRoutineSubtype(routine.subtype);
  if (subtypeLabel && subtypeLabel !== "Other") return subtypeLabel;
  const firstTag = routine.tagAssignments[0]?.tag.name?.trim();
  if (firstTag) return firstTag;
  const firstExercise = formatRoutinePreviewExerciseName(routine.exercises[0]?.exercise.name);
  if (firstExercise) return firstExercise;
  return null;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M11.854 1.646a.5.5 0 0 1 .707 0l1.086 1.086a.5.5 0 0 1 0 .707l-7.5 7.5L4 11.5l.561-2.147zM3.5 12.5l2.244-.59L13 4.654 11.346 3 4.09 10.256zM3 13h10v1H3z"
        fill="currentColor"
      />
    </svg>
  );
}

function targetProgressTone(summary: RoutineFrequencySummary) {
  if (!summary.hasTarget) return "rgba(255,255,255,0.62)";
  if (summary.currentCount <= 0) return "#f87171";
  if (summary.currentCount < (summary.targetCount ?? 0)) return "#fbbf24";
  return "#4ade80";
}

export default function RoutineCard({
  routine,
  lastCompletedMap,
  allowLogging,
  frequencySummary,
  goalContributions = [],
  habitStats,
}: {
  routine: RoutineWithExercises;
  lastCompletedMap: Map<string, Date | null>;
  allowLogging: boolean;
  frequencySummary: RoutineFrequencySummary;
  goalContributions?: string[];
  habitStats?: ReturnType<typeof computeHabitStats>;
}) {
  const kind = normalizeRoutineKind(routine.kind);
  const domain = effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype);
  const kindColor = domainColor(domain);
  const definingLabel = getDefiningLabel(routine);
  const exercisePreview = isWorkoutKind(kind)
    ? routine.exercises.map((item) => formatRoutinePreviewExerciseName(item.exercise.name)).join(", ")
    : "";
  const guidedPreview = isGuidedKind(kind)
    ? routine.guidedSteps
        .map((step) => step.title.trim() || formatRoutinePreviewExerciseName(step.exercise?.name) || "")
        .filter(Boolean)
        .join(", ")
    : "";
  const lastCompletedAt = lastCompletedMap.get(routine.id) ?? null;
  const lastCompletedLabel = lastCompletedAt ? formatAppDate(lastCompletedAt) : "Never";

  const quickLogAction = logRoutineCompletion.bind(null, routine.id);
  const undoLastAction = removeLastRoutineCompletion.bind(null, routine.id);
  const datedLogAction = logCompletionWithDate.bind(null, routine.id);

  const secondarySummary = exercisePreview
    ? `Exercises: ${exercisePreview}`
    : guidedPreview
    ? `Steps: ${guidedPreview}`
    : goalContributions.length > 0
    ? `Goals: ${goalContributions.join(", ")}`
    : null;
  const kindSummary = !isWorkoutKind(kind) && definingLabel
    ? `${formatRoutineTypeLabel(kind)} · ${definingLabel}`
    : formatRoutineTypeLabel(kind);
  const frequencyWindowProgress = frequencySummary.hasTarget
    ? `[${frequencySummary.currentCount}/${frequencySummary.targetCount} ${frequencySummary.windowLabel}]`
    : null;
  const targetFrequencyLabel =
    frequencySummary.hasTarget && frequencySummary.targetCount && frequencySummary.unit
      ? `${frequencySummary.targetCount} ${
          frequencySummary.targetCount === 1 ? "log" : "logs"
        }/${frequencySummary.interval === 1 ? frequencySummary.unit.toLowerCase() : `${frequencySummary.interval} ${frequencySummary.unit.toLowerCase()}s`}`
      : formatRoutineTargetLabel(routine);

  return (
    <div className="routineCard" style={{ opacity: allowLogging ? 1 : 0.72, borderLeftColor: kindColor, borderLeftWidth: 3 }}>
      <div className="routineCardLayout">
        <div className="routineCardContent">
          <div className="routineCardTitleRow">
            <div className="routineCardTitle">{routine.name}</div>
            {allowLogging ? (
              <div className="routineCardActionRow">
                {isCompletionKind(kind) ? (
                  <form action={quickLogAction}>
                    <button type="submit" suppressHydrationWarning className="routineCardPrimaryAction">
                      Log
                    </button>
                  </form>
                ) : (
                  <DrawerLogButton routineId={routine.id} />
                )}
                {isCompletionKind(kind) ? (
                  <form action={undoLastAction}>
                    <button type="submit" suppressHydrationWarning className="routineCardMiniButton routineCardMiniButtonGhost">
                      Undo
                    </button>
                  </form>
                ) : null}
                {isWorkoutKind(kind) ? (
                  <Link href={`/routines/${routine.id}/template`} className="routineCardMiniLink">
                    Template
                  </Link>
                ) : null}
                {isGuidedKind(kind) ? (
                  <Link href={`/routines/${routine.id}/guided`} className="routineCardMiniLink">
                    Steps
                  </Link>
                ) : null}
              </div>
            ) : null}
            {!allowLogging ? <span className="routineCardArchivedPill">Archived</span> : null}
          </div>

          {kindSummary ? <div className="routineCardKindLine" style={{ color: kindColor }}>{kindSummary}</div> : null}

          <div className="routineCardMetaLine">
            <span>Last: <b>{lastCompletedLabel}</b></span>
            {habitStats !== undefined && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                {habitStats.currentStreak > 0 ? (
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(251,191,36,0.14)",
                    border: "1px solid rgba(251,191,36,0.35)",
                    color: "rgba(251,191,36,1)",
                    fontWeight: 800,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}>
                    {habitStats.currentStreak === 1 ? "1 day streak" : `${habitStats.currentStreak} day streak`}
                  </span>
                ) : (
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(251,113,133,0.1)",
                    border: "1px solid rgba(251,113,133,0.28)",
                    color: "rgba(251,113,133,0.9)",
                    fontWeight: 800,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}>
                    Streak broken
                  </span>
                )}
                {habitStats.missedLast30 > 0 && (
                  <span style={{ opacity: 0.55, fontSize: 11 }}>
                    {habitStats.missedLast30} missed / 30d
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="routineCardFrequencyRow">
            <details className="routineTargetPopover">
              <summary className="routineTargetPopoverButton" aria-label={`Edit target frequency for ${routine.name}`}>
                <PencilIcon />
              </summary>
              <form action={updateRoutineFrequencyTarget} className="routineTargetPopoverPanel">
                <input type="hidden" name="routineId" value={routine.id} />
                <div className="routineTargetPopoverTitle">Target Frequency</div>
                <div className="routineTargetPopoverFields">
                  <input
                    name="targetFrequencyCount"
                    className="routineTargetPopoverInput"
                    inputMode="numeric"
                    defaultValue={routine.targetFrequencyCount ?? 3}
                  />
                  <span className="routineTargetPopoverText">times per</span>
                  <input
                    name="targetFrequencyInterval"
                    className="routineTargetPopoverInput"
                    inputMode="numeric"
                    defaultValue={routine.targetFrequencyInterval ?? 1}
                  />
                  <select
                    name="targetFrequencyUnit"
                    className="routineTargetPopoverSelect"
                    defaultValue={routine.targetFrequencyUnit ?? "WEEK"}
                  >
                    <option value="DAY">day</option>
                    <option value="WEEK">week</option>
                    <option value="MONTH">month</option>
                  </select>
                </div>
                <div className="routineTargetPopoverHint">{frequencySummary.summaryLabel}</div>
                <div className="routineTargetPopoverActions">
                  <button type="submit" name="intent" value="save" suppressHydrationWarning className="routineCardMiniButton">
                    Save
                  </button>
                  <button type="submit" name="intent" value="clear" suppressHydrationWarning className="routineCardMiniButton routineCardMiniButtonGhost">
                    Clear
                  </button>
                </div>
              </form>
            </details>
            <div className="routineCardMetaLine" style={{ gap: 6 }}>
              <span>Target Frequency: <b>{targetFrequencyLabel}</b></span>
              {frequencyWindowProgress ? (
                <span style={{ color: targetProgressTone(frequencySummary) }}>
                  <b>{frequencyWindowProgress}</b>
                </span>
              ) : null}
            </div>
          </div>

          {secondarySummary ? <div className="routineCardSecondaryLine">{secondarySummary}</div> : null}
        </div>

        <div className="routineCardActions">
          <div className="routineCardActionRow">
            <Link href={`/routines/${routine.id}/edit`} className="routineCardMiniLink">
              Edit
            </Link>
            {allowLogging ? <DeleteRoutineButton routineId={routine.id} compact /> : null}
          </div>

          {allowLogging && isCompletionKind(kind) ? (
            <details className="routineCardDateDetails">
              <summary className="routineCardMiniLink">More</summary>
              <form action={datedLogAction} className="routineCardDateForm">
                <input type="datetime-local" name="performedAtLocal" className="routineCardDateInput" />
                <button type="submit" suppressHydrationWarning className="routineCardMiniButton">
                  Save
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
