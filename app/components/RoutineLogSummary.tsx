"use client";

// Pure render of one log's body panels (no chrome, no fetching).
//
// Used by:
//   - The full detail page wrapper, which adds page title + Back/Edit buttons
//   - The view-log modal, which adds per-card header + Edit/Delete buttons
//
// Data shape comes from `getLogSummaryData()` in lib/log-summary.ts. Keeping
// this component data-in / DOM-out means both surfaces stay in lockstep — any
// future panel (gear, pain snapshot, zones) lands once and shows in both.

import { exerciseUnitLabel } from "@/lib/exercises";
import { formatGuidedRepSetSummary, formatGuidedSeconds, formatGuidedStepLabel } from "@/lib/guided";
import { isCardioKind, isCompletionKind, isGuidedKind, isSessionKind, isWorkoutKind } from "@/lib/routines";
import { climbOutcomeColor, climbOutcomeBg, climbOutcomeLabel } from "@/lib/climb-types";
import type { ClimbOutcome, ClimbGradeSystem } from "@/lib/climb-types";
import type { LogSummaryData } from "@/lib/log-summary";

const formatSeconds = formatGuidedSeconds;

function formatMetricValue(value: number, unit?: string | null) {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${normalized} ${unit}` : normalized;
}

export default function RoutineLogSummary({ data }: { data: LogSummaryData }) {
  const { logKind } = data;
  return (
    <>
      <section style={panel}>
        <div style={panelHeader}>SUMMARY</div>
        <div style={summaryGrid}>
          {isCompletionKind(logKind) && (
            <div style={statCard}>
              <div style={statLabel}>Count</div>
              <div style={statValue}>{data.completionCount ?? 1}</div>
            </div>
          )}
          {isCardioKind(logKind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Distance</div>
                <div style={statValue}>{(data.distanceMi ?? 0).toFixed(2)} mi</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(data.durationSec)}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Elevation</div>
                <div style={statValue}>{data.elevationGainFt ? `${data.elevationGainFt} ft` : "0 ft"}</div>
              </div>
            </>
          )}
          {isGuidedKind(logKind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(data.durationSec)}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Steps</div>
                <div style={statValue}>{data.guidedSteps.length}</div>
              </div>
            </>
          )}
          {isSessionKind(logKind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(data.durationSec)}</div>
              </div>
              {data.location && (
                <div style={statCard}>
                  <div style={statLabel}>Location</div>
                  <div style={statValue}>{data.location}</div>
                </div>
              )}
              {data.climbAttempts.length > 0 && (
                <>
                  <div style={statCard}>
                    <div style={statLabel}>Climbs</div>
                    <div style={statValue}>{data.climbAttempts.length}</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>Sends</div>
                    <div style={{ ...statValue, color: "rgba(74,222,128,0.9)" }}>
                      {
                        data.climbAttempts.filter(
                          (a) =>
                            a.outcome === "FLASH" ||
                            a.outcome === "ONSIGHT" ||
                            a.outcome === "SEND" ||
                            a.outcome === "REDPOINT"
                        ).length
                      }
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {isWorkoutKind(logKind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Exercises</div>
                <div style={statValue}>{data.exercises.length}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Sets</div>
                <div style={statValue}>
                  {data.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {isWorkoutKind(logKind) && data.exercises.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>EXERCISES</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 10 }}>
              {data.exercises.map((exercise) => (
                <div key={exercise.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{exercise.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                    {exerciseUnitLabel(exercise.unit)} | Weight: {exercise.supportsWeight ? "Yes" : "No"}
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {exercise.sets.map((set) => (
                      <div key={set.id} style={setRow}>
                        <div style={{ fontWeight: 700 }}>Set {set.setNumber}</div>
                        <div style={{ fontSize: 12, opacity: 0.82 }}>
                          {exercise.unit === "TIME"
                            ? `${formatSeconds(set.seconds)}`
                            : `${set.reps ?? 0} reps`}
                          {set.weightLb !== null ? ` | ${set.weightLb} lb` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isGuidedKind(logKind) && data.guidedSteps.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>GUIDED STEPS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 8 }}>
              {data.guidedSteps.map((step, index) => (
                <div key={step.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>
                    {index + 1}.{" "}
                    {formatGuidedStepLabel({
                      kind: step.kind,
                      title: step.title,
                      exerciseName: step.exerciseName,
                    })}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.82 }}>
                    {step.kind === "EXERCISE" ? "Exercise" : "Step"} | Work: {formatSeconds(step.durationSec)} | Rest:{" "}
                    {formatSeconds(step.restSec)}
                    {formatGuidedRepSetSummary(step) ? ` | ${formatGuidedRepSetSummary(step)}` : ""}
                    {step.weightLb !== null && step.weightLb !== undefined ? ` | Weight: ${step.weightLb} lb` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isSessionKind(logKind) && data.metrics.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>METRICS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 8 }}>
              {data.metrics.map((metric) => (
                <div key={metric.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{metric.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.82 }}>
                    {formatMetricValue(metric.value, metric.unit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.climbAttempts.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>CLIMBS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 6 }}>
              {data.climbAttempts.map((attempt) => {
                const outcome = attempt.outcome as ClimbOutcome;
                const system = attempt.gradeSystem as ClimbGradeSystem;
                const color = climbOutcomeColor(outcome);
                const bg = climbOutcomeBg(outcome);
                return (
                  <div
                    key={attempt.id}
                    style={{ ...itemCard, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}
                  >
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        flexShrink: 0,
                      }}
                    >
                      {attempt.grade}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: bg,
                        flexShrink: 0,
                      }}
                    >
                      {climbOutcomeLabel(outcome, system)}
                    </span>
                    {attempt.problem && (
                      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>{attempt.problem.name}</span>
                    )}
                    {attempt.movesCompleted != null && (
                      <span style={{ fontSize: 12, opacity: 0.6 }}>
                        {attempt.movesCompleted}
                        {attempt.totalMoves != null ? `/${attempt.totalMoves}` : ""} moves
                      </span>
                    )}
                    {attempt.notes && (
                      <span style={{ fontSize: 12, opacity: 0.65, width: "100%", marginTop: 2 }}>{attempt.notes}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {data.notes ? (
        <section style={panel}>
          <div style={panelHeader}>NOTES</div>
          <div style={contentPad}>
            <div style={itemCard}>{data.notes}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.3,
};

const contentPad: React.CSSProperties = {
  padding: 14,
};

const summaryGrid: React.CSSProperties = {
  padding: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const statCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 10,
  padding: 12,
  background: "rgba(128,128,128,0.05)",
};

const statLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.72,
  textTransform: "uppercase",
};

const statValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 18,
  fontWeight: 900,
};

const itemCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(128,128,128,0.05)",
};

const setRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 6,
};
