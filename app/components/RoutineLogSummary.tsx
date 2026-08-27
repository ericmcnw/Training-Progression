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
import WeatherBadge from "@/app/components/WeatherBadge";
import { gearTypeMeta } from "@/lib/gear-types";
import {
  describePoolSwimSet,
  formatPoolDistance,
  formatSwimPace,
  poolSwimTotals,
  type PoolSwimData,
} from "@/lib/pool-swim";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BackpackingLogSheet from "@/app/routines/BackpackingLogSheet";
import {
  getBackpackingTripForEdit,
  deleteBackpackingTrip,
  type BackpackingEditData,
} from "@/app/log/backpacking-log-actions";

const formatSeconds = formatGuidedSeconds;

function formatMetricValue(value: number, unit?: string | null) {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${normalized} ${unit}` : normalized;
}

export default function RoutineLogSummary({ data }: { data: LogSummaryData }) {
  const { logKind } = data;
  const pool = data.sportData?.kind === "pool-swim" ? data.sportData.pool : null;
  const poolTotals = pool ? poolSwimTotals(pool, data.durationSec) : null;
  return (
    <>
      <section style={panel}>
        <div style={panelHeader}>SUMMARY</div>
        {data.weather ? (
          <div style={{ marginBottom: 10 }}>
            <WeatherBadge weather={data.weather} detailed />
          </div>
        ) : null}
        {data.gear.length > 0 ? (
          <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.gear.map((g, i) => (
              <span
                key={`${g.name}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(128,128,128,0.3)",
                  background: "rgba(128,128,128,0.06)",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                <span aria-hidden>{gearTypeMeta(g.type).icon}</span>
                {g.name}
              </span>
            ))}
          </div>
        ) : null}
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
                <div style={statValue}>
                  {pool && poolTotals
                    ? formatPoolDistance(poolTotals.distance, pool.poolUnit)
                    : `${(data.distanceMi ?? 0).toFixed(2)} mi`}
                </div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(data.durationSec)}</div>
              </div>
              {/* Pools are flat and measured in lengths, so elevation gives
                  way to the two numbers a swimmer actually reads. */}
              {pool && poolTotals ? (
                <>
                  <div style={statCard}>
                    <div style={statLabel}>Lengths</div>
                    <div style={statValue}>
                      {poolTotals.lengths != null ? Math.round(poolTotals.lengths * 10) / 10 : "—"}
                    </div>
                    <div style={statSub}>{`${pool.poolLength} ${pool.poolUnit} pool`}</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>Pace</div>
                    <div style={statValue}>
                      {formatSwimPace(poolTotals.paceSecPer100, pool.poolUnit) ?? "—"}
                    </div>
                  </div>
                </>
              ) : (
                <div style={statCard}>
                  <div style={statLabel}>Elevation</div>
                  <div style={statValue}>{data.elevationGainFt ? `${data.elevationGainFt} ft` : "0 ft"}</div>
                </div>
              )}
              {data.packWeightGrams ? (
                <div style={statCard}>
                  <div style={statLabel}>Carried</div>
                  <div style={statValue}>{Math.round((data.packWeightGrams / 453.59237) * 10) / 10} lb</div>
                </div>
              ) : null}
              {/* Sprint / Interval Run reps as a stat chip so the
                  structured workout flavor reads at-a-glance alongside
                  the volume totals. Full breakdown lives in the
                  dedicated section below. */}
              {data.intervals?.reps != null && (
                <div style={statCard}>
                  <div style={statLabel}>Reps</div>
                  <div style={statValue}>{data.intervals.reps}</div>
                </div>
              )}
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
              {data.spot ? (
                <div style={statCard}>
                  <div style={statLabel}>Location</div>
                  <div style={statValue}>{data.spot.name}</div>
                  {data.spot.region ? (
                    <div style={statSub}>{data.spot.region}</div>
                  ) : null}
                </div>
              ) : data.location ? (
                <div style={statCard}>
                  <div style={statLabel}>Location</div>
                  <div style={statValue}>{data.location}</div>
                </div>
              ) : null}
              {data.sportData?.kind === "golf" ? (
                <div style={statCard}>
                  <div style={statLabel}>Mode</div>
                  <div style={statValue}>
                    {data.sportData.mode === "COURSE" ? "Course" : "Range"}
                  </div>
                </div>
              ) : null}
              {data.sportData?.kind === "generic-sport" && data.sportData.sessionType ? (
                <div style={statCard}>
                  <div style={statLabel}>Type</div>
                  <div style={statValue}>{prettifySessionType(data.sportData.sessionType)}</div>
                </div>
              ) : null}
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

      {/* Backpacking trip rollup — shown on every day-log of a trip, so
          opening any day surfaces the whole trip: per-day miles table,
          totals, and the gear list + pack weight. */}
      {data.backpacking ? <BackpackingPanel trip={data.backpacking} /> : null}

      {/* Golf scorecard — appears on COURSE-mode logs with at least
          one hole row. Shows total par, total score, vs-par + the
          hole-by-hole grid the user filled in. RANGE mode renders a
          per-club list instead. */}
      {data.sportData?.kind === "golf" && data.sportData.mode === "COURSE" && data.sportData.course ? (
        <GolfCoursePanel course={data.sportData.course} />
      ) : null}
      {data.sportData?.kind === "golf" && data.sportData.mode === "RANGE" && data.sportData.range ? (
        <GolfRangePanel range={data.sportData.range} />
      ) : null}

      {/* Pool swim set list — the workout as written on the whiteboard. */}
      {pool && pool.sets.length > 0 ? <PoolSwimPanel pool={pool} /> : null}

      {/* Generic-sport extras grid — basketball points, surfing wave
          count, snowboarding runs, etc. Each value renders as a
          labeled chip; empty extras hides the panel. */}
      {data.sportData?.kind === "generic-sport" &&
      data.sportData.extras &&
      Object.keys(data.sportData.extras).length > 0 ? (
        <SportExtrasPanel extras={data.sportData.extras} />
      ) : null}

      {/* Interval breakdown — only shown when the log has structured
          interval data (Sprint, Interval Run, or future structured
          types). Reads as "5 × 400m · 1:30 work / 90s rest." Each
          field is independently optional so a partial entry (e.g.
          reps + work distance, no times) still renders cleanly. */}
      {isCardioKind(logKind) && data.intervals && (
        <section style={panel}>
          <div style={panelHeader}>INTERVAL STRUCTURE</div>
          <div style={contentPad}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13.5, fontWeight: 700 }}>
              {data.intervals.reps != null && data.intervals.workDistanceM != null ? (
                <span>{data.intervals.reps} × {data.intervals.workDistanceM}m</span>
              ) : data.intervals.reps != null ? (
                <span>{data.intervals.reps} reps</span>
              ) : null}
              {data.intervals.workDurationSec != null && (
                <span style={{ opacity: 0.75 }}>· {formatSeconds(data.intervals.workDurationSec)} work</span>
              )}
              {data.intervals.restSec != null && (
                <span style={{ opacity: 0.75 }}>· {formatSeconds(data.intervals.restSec)} rest</span>
              )}
            </div>
          </div>
        </section>
      )}

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

const statSub: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.65,
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

// ─── Sport-specific render panels ─────────────────────────────────────────

function prettifySessionType(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function formatTripDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function BackpackingPanel({ trip }: { trip: NonNullable<LogSummaryData["backpacking"]> }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>BACKPACKING TRIP</div>
      <div style={contentPad}>
        {trip.trail ? <div style={{ fontWeight: 900, fontSize: 15 }}>{trip.trail}</div> : null}
        {trip.location ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{trip.location}</div> : null}

        <div style={{ ...summaryGrid, padding: 0, marginTop: 12 }}>
          <div style={statCard}>
            <div style={statLabel}>Total</div>
            <div style={statValue}>{(trip.totalMiles ?? 0).toFixed(1)} mi</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Days</div>
            <div style={statValue}>{trip.days.length}</div>
          </div>
          {trip.nights > 0 ? (
            <div style={statCard}>
              <div style={statLabel}>Nights</div>
              <div style={statValue}>{trip.nights}</div>
            </div>
          ) : null}
          {trip.totalDurationSec > 0 ? (
            <div style={statCard}>
              <div style={statLabel}>Time</div>
              <div style={statValue}>{formatSeconds(trip.totalDurationSec)}</div>
            </div>
          ) : null}
          {trip.packLb != null ? (
            <div style={statCard}>
              <div style={statLabel}>Pack weight</div>
              <div style={statValue}>{trip.packLb} lb</div>
              {trip.baseLb != null ? <div style={statSub}>{trip.baseLb} lb base</div> : null}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {trip.days.map((d, i) => (
            <div key={`${d.ymd}-${i}`} style={itemCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900 }}>Day {i + 1} · {formatTripDay(d.ymd)}</span>
                <span style={{ fontWeight: 800, opacity: 0.85 }}>
                  {d.miles != null ? `${d.miles.toFixed(1)} mi` : "—"}
                  {d.durationSec ? ` · ${formatSeconds(d.durationSec)}` : ""}
                  {d.elevGainFt ? ` · ${d.elevGainFt} ft` : ""}
                </span>
              </div>
              {d.campsite ? <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>⛺ {d.campsite}</div> : null}
              {d.notes ? <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{d.notes}</div> : null}
            </div>
          ))}
        </div>

        {trip.gear.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...statLabel, marginBottom: 6 }}>Gear · {trip.gear.length} item{trip.gear.length === 1 ? "" : "s"}</div>
            <div style={{ display: "grid", gap: 4 }}>
              {trip.gear.map((g, i) => (
                <div key={`${g.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                  <span>{g.type ? `${gearTypeMeta(g.type).icon} ` : ""}{g.consumable ? "🍫 " : ""}{g.name}{g.quantity > 1 ? ` ×${g.quantity}` : ""}</span>
                  <span style={{ opacity: 0.65 }}>{g.oz != null ? `${g.oz} oz` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <BackpackingTripActions tripId={trip.id} />
      </div>
    </section>
  );
}

function BackpackingTripActions({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editData, setEditData] = useState<BackpackingEditData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function openEdit() {
    setLoadingEdit(true);
    try {
      const data = await getBackpackingTripForEdit(tripId);
      if (data) setEditData(data);
    } finally {
      setLoadingEdit(false);
    }
  }

  function doDelete() {
    // Editing/deleting regenerates or removes the day-logs, so the current
    // log id won't survive — land on home, where the trip bar reflects it.
    startTransition(async () => {
      await deleteBackpackingTrip(tripId);
      router.push("/");
    });
  }

  return (
    <div style={tripActionsRow}>
      <button type="button" onClick={openEdit} disabled={loadingEdit || pending} style={tripEditBtn}>
        {loadingEdit ? "Loading…" : "Edit trip"}
      </button>
      {!confirmDelete ? (
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={pending} style={tripDeleteBtn}>
          Delete
        </button>
      ) : (
        <>
          <button type="button" onClick={doDelete} disabled={pending} style={tripConfirmBtn}>
            {pending ? "Deleting…" : "Confirm delete"}
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} disabled={pending} style={tripEditBtn}>
            Keep
          </button>
        </>
      )}
      {editData ? (
        <BackpackingLogSheet
          editTripId={tripId}
          initialEdit={editData}
          onClose={() => setEditData(null)}
          onSaved={() => router.push("/")}
        />
      ) : null}
    </div>
  );
}

const tripActionsRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid rgba(128,128,128,0.2)",
  flexWrap: "wrap",
};
const tripEditBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.5)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const tripDeleteBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.3)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,160,160,0.95)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const tripConfirmBtn: React.CSSProperties = {
  ...tripDeleteBtn,
  border: "1px solid rgba(248,113,113,0.6)",
  background: "rgba(248,113,113,0.2)",
  color: "rgba(255,210,210,0.98)",
};

function GolfCoursePanel({
  course,
}: {
  course: NonNullable<Extract<LogSummaryData["sportData"], { kind: "golf" }>["course"]>;
}) {
  if (!course.holes || course.holes.length === 0) return null;
  const totalPar = course.holes.reduce((sum, h) => sum + (h.par ?? 0), 0);
  const totalScore = course.holes.reduce((sum, h) => sum + (h.score ?? 0), 0);
  const diff = totalScore - totalPar;
  return (
    <section style={panel}>
      <div style={panelHeader}>GOLF · {course.location ? course.location.toUpperCase() : "ROUND"}</div>
      <div style={contentPad}>
        <div style={golfTotalsRow}>
          <div style={golfTotalCell}>
            <span style={golfTotalLabel}>Par</span>
            <span style={golfTotalValue}>{totalPar || "—"}</span>
          </div>
          <div style={golfTotalCell}>
            <span style={golfTotalLabel}>Score</span>
            <span style={golfTotalValue}>{totalScore || "—"}</span>
          </div>
          <div style={golfTotalCell}>
            <span style={golfTotalLabel}>vs Par</span>
            <span
              style={{
                ...golfTotalValue,
                color:
                  totalScore && totalPar
                    ? diff > 0
                      ? "rgba(248,113,113,0.95)"
                      : "rgba(51,255,122,0.95)"
                    : undefined,
              }}
            >
              {totalScore && totalPar
                ? diff > 0
                  ? `+${diff}`
                  : diff === 0
                  ? "E"
                  : `${diff}`
                : "—"}
            </span>
          </div>
        </div>
        <div style={golfHolesGrid}>
          <div style={golfHolesHeader}>
            <span>Hole</span>
            <span>Par</span>
            <span>You</span>
            <span>Club</span>
          </div>
          {course.holes.map((h) => (
            <div key={h.number} style={golfHoleRow}>
              <span style={golfHoleNum}>{h.number}</span>
              <span>{h.par ?? "—"}</span>
              <span
                style={{
                  fontWeight: 800,
                  color:
                    h.par != null && h.score != null
                      ? h.score < h.par
                        ? "rgba(51,255,122,0.95)"
                        : h.score > h.par
                        ? "rgba(248,113,113,0.95)"
                        : "inherit"
                      : "inherit",
                }}
              >
                {h.score ?? "—"}
              </span>
              <span style={golfHoleClub}>{h.club ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GolfRangePanel({
  range,
}: {
  range: NonNullable<Extract<LogSummaryData["sportData"], { kind: "golf" }>["range"]>;
}) {
  if (!range.shots || range.shots.length === 0) return null;
  return (
    <section style={panel}>
      <div style={panelHeader}>GOLF · RANGE</div>
      <div style={contentPad}>
        {range.ballCount ? (
          <div style={{ marginBottom: 10, fontSize: 13, opacity: 0.78 }}>
            <strong style={{ fontWeight: 900 }}>{range.ballCount}</strong> balls hit
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 6 }}>
          {range.shots.map((s, idx) => (
            <div key={`${s.club}-${idx}`} style={itemCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 900 }}>{s.club}</span>
                <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.78 }}>
                  {s.distanceYards != null ? `${s.distanceYards} yds` : null}
                  {s.distanceYards != null && s.ballCount ? " · " : ""}
                  {s.ballCount ? `${s.ballCount} balls` : null}
                </span>
              </div>
              {s.notes ? (
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>{s.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PoolSwimPanel({ pool }: { pool: PoolSwimData }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>SETS</div>
      <div style={contentPad}>
        <div style={{ display: "grid", gap: 8 }}>
          {pool.sets.map((set, i) => (
            <div key={i} style={poolSetRow}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={poolSetIndex}>{i + 1}</span>
                <span style={poolSetLabel}>{describePoolSwimSet(set, pool.poolUnit)}</span>
              </div>
              {set.note ? <div style={poolSetNote}>{set.note}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SportExtrasPanel({ extras }: { extras: Record<string, string | number> }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>DETAILS</div>
      <div style={contentPad}>
        <div style={extrasGrid}>
          {Object.entries(extras).map(([key, value]) => (
            <div key={key} style={statCard}>
              <div style={statLabel}>{prettifyExtraKey(key)}</div>
              <div style={statValue}>{String(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function prettifyExtraKey(key: string): string {
  // camelCase → Title Case With Spaces
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const poolSetRow: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(6,182,212,0.25)",
  background: "rgba(6,182,212,0.06)",
};

const poolSetIndex: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  opacity: 0.55,
  minWidth: 14,
};

const poolSetLabel: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  overflowWrap: "anywhere",
};

const poolSetNote: React.CSSProperties = {
  fontSize: 12.5,
  opacity: 0.75,
  paddingLeft: 22,
};

const golfTotalsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(40,212,160,0.18)",
  background: "rgba(40,212,160,0.06)",
  marginBottom: 12,
};
const golfTotalCell: React.CSSProperties = {
  display: "grid",
  gap: 2,
  textAlign: "center",
};
const golfTotalLabel: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.6,
};
const golfTotalValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  fontVariantNumeric: "tabular-nums",
};

const golfHolesGrid: React.CSSProperties = {
  display: "grid",
  gap: 2,
};
const golfHolesHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 60px 60px 1fr",
  gap: 6,
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.5,
};
const golfHoleRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 60px 60px 1fr",
  gap: 6,
  padding: "8px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  alignItems: "center",
};
const golfHoleNum: React.CSSProperties = {
  fontWeight: 900,
  opacity: 0.7,
};
const golfHoleClub: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  opacity: 0.7,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const extrasGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
};
