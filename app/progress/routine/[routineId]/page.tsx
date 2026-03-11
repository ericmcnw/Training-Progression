import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  GOAL_TYPE,
  dateYmd,
  formatDuration,
  formatPace,
  getWorkoutSessionMetrics,
  normalizeProgressRange,
  parseExerciseRepsAtWeightGoalType,
  toPerformedAtFilter,
} from "@/lib/progress";
import MetricLineChart from "../../MetricLineChart";

export const dynamic = "force-dynamic";

type Params = { routineId: string };
type SearchParams = Record<string, string | string[] | undefined>;

type WorkoutMetricRow = {
  label: string;
  date: Date;
  topWeight: number;
  totalReps: number;
  totalSets: number;
  totalVolume: number;
  maxTimeSeconds: number;
  setReps: number[];
  setSeconds: number[];
  setWeights: number[];
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function getWeekStartSunday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default async function ProgressRoutineDetailPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.routineId;
  const range = normalizeProgressRange(getParam(searchParams, "range"));
  const selectedExerciseId = getParam(searchParams, "exerciseId") ?? "";
  const performedAt = toPerformedAtFilter(range);

  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      kind: true,
      category: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const goals = await prisma.goal.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { type: true, targetValue: true },
  });

  const runWeeklyGoal = goals.find((g) => g.type === `${GOAL_TYPE.runWeeklyMileage}:${routineId}`)?.targetValue;
  const runLongestGoal = goals.find((g) => g.type === `${GOAL_TYPE.runLongest}:${routineId}`)?.targetValue;

  const exerciseWeightGoalMap = new Map<string, number>();
  const exerciseAvgRepsGoalMap = new Map<string, number>();
  const exerciseRepsAtWeightGoalMap = new Map<string, { weightLb: number; repsTarget: number }>();
  for (const goal of goals) {
    if (goal.type.startsWith(`${GOAL_TYPE.exerciseWeight}:`)) {
      const exerciseId = goal.type.split(":")[1];
      if (exerciseId && !exerciseWeightGoalMap.has(exerciseId)) exerciseWeightGoalMap.set(exerciseId, goal.targetValue);
    }
    if (goal.type.startsWith(`${GOAL_TYPE.exerciseAvgRepsPerSet}:`)) {
      const exerciseId = goal.type.split(":")[1];
      if (exerciseId && !exerciseAvgRepsGoalMap.has(exerciseId)) exerciseAvgRepsGoalMap.set(exerciseId, goal.targetValue);
    }
    const repsAtWeight = parseExerciseRepsAtWeightGoalType(goal.type);
    if (repsAtWeight && !exerciseRepsAtWeightGoalMap.has(repsAtWeight.exerciseId)) {
      exerciseRepsAtWeightGoalMap.set(repsAtWeight.exerciseId, {
        weightLb: repsAtWeight.weightLb,
        repsTarget: goal.targetValue,
      });
    }
  }

  if (routine.kind === "CARDIO") {
    const runs = await prisma.routineLog.findMany({
      where: {
        routineId,
        ...(performedAt ? { performedAt } : {}),
        distanceMi: { not: null },
        durationSec: { not: null },
      },
      orderBy: { performedAt: "asc" },
      select: { id: true, performedAt: true, distanceMi: true, durationSec: true, notes: true },
    });

    const weeklyMileage = new Map<string, number>();
    for (const run of runs) {
      const key = dateYmd(getWeekStartSunday(run.performedAt));
      weeklyMileage.set(key, (weeklyMileage.get(key) ?? 0) + (run.distanceMi ?? 0));
    }

    const mileageRows = Array.from(weeklyMileage.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const runLabels = runs.map((run) => dateYmd(run.performedAt));
    const distanceSeries = runs.map((run, idx) => ({ label: runLabels[idx], value: run.distanceMi ?? 0 }));
    const durationSeries = runs.map((run, idx) => ({ label: runLabels[idx], value: run.durationSec ?? 0 }));
    const paceSeries = runs
      .map((run) => {
        const distance = run.distanceMi ?? 0;
        const duration = run.durationSec ?? 0;
        return { label: dateYmd(run.performedAt), value: distance > 0 ? duration / distance : null };
      })
      .filter((entry): entry is { label: string; value: number } => entry.value !== null);
    const weeklyMileageSeries = mileageRows.map(([week, miles]) => ({ label: week, value: miles }));

    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{routine.name} Progress</h1>
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
              {routine.category} | CARDIO
            </div>
          </div>
          <Link href={`/progress?view=progression&range=${range}`} style={linkBtn}>
            Back
          </Link>
        </div>

        <section style={panel}>
          <div style={panelHeader}>CARDIO CHARTS</div>
          <div style={{ padding: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <MetricLineChart
              title="Distance per session"
              yLabel="Miles"
              xLabel="Session date"
              points={distanceSeries}
              valueLabel="Miles"
              unit="mi"
              decimals={2}
              targetValue={runLongestGoal}
              targetLabel="Longest cardio goal"
              targetUnit="mi"
              targetDecimals={2}
            />
            <MetricLineChart title="Duration per session" yLabel="Duration" xLabel="Session date" points={durationSeries} valueLabel="Duration" unit="sec" decimals={0} />
            <MetricLineChart title="Pace per session" yLabel="Pace" xLabel="Session date" points={paceSeries} valueLabel="Pace" unit="sec/mi" decimals={0} />
            <MetricLineChart
              title="Weekly mileage"
              yLabel="Miles"
              xLabel="Week start"
              points={weeklyMileageSeries}
              valueLabel="Miles"
              unit="mi"
              decimals={2}
              targetValue={runWeeklyGoal}
              targetLabel="Weekly mileage goal"
              targetUnit="mi"
              targetDecimals={2}
            />
          </div>
        </section>

        <section style={panel}>
          <div style={panelHeader}>CARDIO SESSIONS</div>
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            {runs.length === 0 && <div style={{ opacity: 0.75 }}>No cardio data in this range.</div>}
            {runs.map((run) => {
              const distance = run.distanceMi ?? 0;
              const duration = run.durationSec ?? 0;
              const pace = distance > 0 ? duration / distance : null;
              return (
                <div key={run.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{new Date(run.performedAt).toLocaleDateString()}</div>
                      <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                        {distance.toFixed(2)} mi | {formatDuration(duration)} | Pace {formatPace(pace)}
                      </div>
                    </div>
                  </div>
                  {run.notes ? <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{run.notes}</div> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  if (routine.kind === "COMPLETION") {
    const checks = await prisma.routineLog.findMany({
      where: {
        routineId,
        ...(performedAt ? { performedAt } : {}),
        distanceMi: null,
        durationSec: null,
        exercises: { none: {} },
      },
      orderBy: { performedAt: "desc" },
      select: { id: true, performedAt: true, notes: true },
    });

    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{routine.name} Completion History</h1>
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
              {routine.category} | COMPLETION
            </div>
          </div>
          <Link href={`/progress?view=progression&range=${range}`} style={linkBtn}>
            Back
          </Link>
        </div>

        <section style={panel}>
          <div style={panelHeader}>COMPLETIONS</div>
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            {checks.length === 0 && <div style={{ opacity: 0.75 }}>No completion history in this range.</div>}
            {checks.map((check) => (
              <div key={check.id} style={card}>
                <div style={{ fontWeight: 900 }}>{new Date(check.performedAt).toLocaleString()}</div>
                {check.notes ? <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>{check.notes}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (routine.kind === "GUIDED" || routine.kind === "SESSION") {
    const sessionLogs = await prisma.routineLog.findMany({
      where: {
        routineId,
        ...(performedAt ? { performedAt } : {}),
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        performedAt: true,
        durationSec: true,
        location: true,
        notes: true,
        metrics: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true, unit: true } },
      },
    });

    const durationSeries = sessionLogs
      .filter((log): log is typeof log & { durationSec: number } => Number.isFinite(log.durationSec))
      .map((log) => ({ label: dateYmd(log.performedAt), value: log.durationSec }));

    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{routine.name} Progress</h1>
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
              {routine.category} | {routine.kind}
            </div>
          </div>
          <Link href={`/progress?view=progression&range=${range}`} style={linkBtn}>
            Back
          </Link>
        </div>

        <section style={panel}>
          <div style={panelHeader}>SESSION HISTORY</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            <MetricLineChart title="Duration per log" yLabel="Duration" xLabel="Session date" points={durationSeries} valueLabel="Duration" unit="sec" decimals={0} />
            {sessionLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs in this range.</div>}
            {sessionLogs.map((log) => (
              <div key={log.id} style={card}>
                <div style={{ fontWeight: 900 }}>{new Date(log.performedAt).toLocaleString()}</div>
                <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                  {log.durationSec ? formatDuration(log.durationSec) : "No duration"}
                  {log.location ? ` | ${log.location}` : ""}
                </div>
                {log.metrics.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                    {log.metrics.map((metric) => `${metric.name}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`).join(" | ")}
                  </div>
                )}
                {log.notes ? <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>{log.notes}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const exerciseOptions = routine.exercises.map((re) => re.exercise);
  const activeExerciseId = selectedExerciseId || "";

  const routineLogs = await prisma.routineLog.findMany({
    where: {
      routineId,
      ...(performedAt ? { performedAt } : {}),
    },
    orderBy: { performedAt: "asc" },
    select: {
      id: true,
      performedAt: true,
      exercises: {
        select: {
          exerciseId: true,
          sets: {
            orderBy: { setNumber: "asc" },
            select: { setNumber: true, reps: true, seconds: true, weightLb: true },
          },
        },
      },
    },
  });

  const routineVolumePoints = routineLogs.map((log) => {
    let totalVolume = 0;
    for (const sessionEx of log.exercises) {
      for (const set of sessionEx.sets) {
        totalVolume += (set.reps ?? 0) * (set.weightLb ?? 0);
      }
    }
    return { label: dateYmd(log.performedAt), value: totalVolume };
  });

  const exerciseSeriesMap = new Map<string, WorkoutMetricRow[]>();
  for (const exercise of exerciseOptions) exerciseSeriesMap.set(exercise.id, []);

  for (const log of routineLogs) {
    const label = dateYmd(log.performedAt);
    for (const sessionEx of log.exercises) {
      const m = getWorkoutSessionMetrics(sessionEx.sets);
      const row: WorkoutMetricRow = {
        label,
        date: log.performedAt,
        topWeight: m.topWeight,
        totalReps: m.totalReps,
        totalSets: m.totalSets,
        totalVolume: m.totalVolume,
        maxTimeSeconds: m.maxTimeSeconds,
        setReps: sessionEx.sets.map((set) => set.reps ?? 0),
        setSeconds: sessionEx.sets
          .map((set) => set.seconds)
          .filter((seconds): seconds is number => Number.isFinite(seconds)),
        setWeights: sessionEx.sets
          .map((set) => set.weightLb)
          .filter((weight): weight is number => Number.isFinite(weight)),
      };
      if (!exerciseSeriesMap.has(sessionEx.exerciseId)) exerciseSeriesMap.set(sessionEx.exerciseId, []);
      exerciseSeriesMap.get(sessionEx.exerciseId)!.push(row);
    }
  }

  const selectedExercise = exerciseOptions.find((ex) => ex.id === activeExerciseId);
  const selectedRows = selectedExercise ? exerciseSeriesMap.get(selectedExercise.id) ?? [] : [];
  const selectedIsTimeAndWeight = Boolean(
    selectedExercise && selectedExercise.unit === "TIME" && selectedExercise.supportsWeight
  );

  const selectedPrimaryPoints = selectedRows.map((row) => ({
    label: row.label,
    value:
      selectedExercise?.unit === "TIME" && !selectedExercise?.supportsWeight
        ? row.maxTimeSeconds
        : row.topWeight,
    detailLines:
      selectedExercise?.unit === "TIME" && !selectedExercise?.supportsWeight
        ? undefined
        : row.setWeights.map((weight, index) => `S${index + 1}: ${weight.toFixed(1)} lb`),
  }));
  const selectedRepsPoints = selectedRows.map((row) => ({ label: row.label, value: row.totalReps }));
  const selectedAvgRepsPerSetPoints = selectedRows.map((row) => ({
    label: row.label,
    value: row.totalSets > 0 ? row.totalReps / row.totalSets : 0,
  }));
  const selectedAvgTimePerSetPoints = selectedRows.map((row) => ({
    label: row.label,
    value:
      row.setSeconds.length > 0
        ? row.setSeconds.reduce((sum, seconds) => sum + seconds, 0) / row.setSeconds.length
        : 0,
    detailLines: row.setSeconds.map((seconds, index) => `S${index + 1}: ${seconds.toFixed(1)} sec`),
  }));
  const selectedVolumePoints = selectedRows.map((row) => ({ label: row.label, value: row.totalVolume }));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{routine.name} Progress</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            {routine.category} | WORKOUT
          </div>
        </div>
        <Link href={`/progress?view=progression&range=${range}`} style={linkBtn}>
          Back
        </Link>
      </div>

      <section style={panel}>
        <div style={panelHeader}>EXERCISE SELECTOR (QUICK FIND)</div>
        <div style={{ padding: 12 }}>
          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="hidden" name="range" value={range} />
            <select name="exerciseId" defaultValue={activeExerciseId} style={{ minWidth: 280, background: "#111b2e", color: "rgba(255,255,255,0.92)" }}>
              <option value="">Select an exercise</option>
              {exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} ({exercise.unit}
                  {exercise.supportsWeight ? "+wt" : ""})
                </option>
              ))}
            </select>
            <button type="submit">Show Exercise Details</button>
          </form>
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>ROUTINE TOTAL VOLUME VS SESSIONS</div>
        <div style={{ padding: 12 }}>
          <MetricLineChart title="Routine total volume" yLabel="Volume" xLabel="Session" points={routineVolumePoints} valueLabel="Volume" decimals={1} />
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>MAIN EXERCISE METRICS (ALL EXERCISES)</div>
        <div style={{ padding: 12, display: "grid", gap: 12 }}>
          {exerciseOptions.length === 0 && <div style={{ opacity: 0.75 }}>No exercises are attached to this routine.</div>}
          {exerciseOptions.map((exercise) => {
            const rows = exerciseSeriesMap.get(exercise.id) ?? [];
            const isTimeAndWeight = exercise.unit === "TIME" && exercise.supportsWeight;
            const mainWeightPoints = rows.map((row) => ({
              label: row.label,
              value: exercise.unit === "TIME" && !exercise.supportsWeight ? row.maxTimeSeconds : row.topWeight,
              detailLines:
                exercise.unit === "TIME" && !exercise.supportsWeight
                  ? undefined
                  : row.setWeights.map((weight, index) => `S${index + 1}: ${weight.toFixed(1)} lb`),
            }));
            const mainRepsPerSetPoints = rows.map((row) => ({
              label: row.label,
              value: row.totalSets > 0 ? row.totalReps / row.totalSets : 0,
              detailLines: row.setReps.map((reps, index) => `S${index + 1}: ${reps} reps`),
            }));
            const mainAvgTimePerSetPoints = rows.map((row) => ({
              label: row.label,
              value:
                row.setSeconds.length > 0
                  ? row.setSeconds.reduce((sum, seconds) => sum + seconds, 0) / row.setSeconds.length
                  : 0,
              detailLines: row.setSeconds.map((seconds, index) => `S${index + 1}: ${seconds.toFixed(1)} sec`),
            }));
            const detailHref = `/progress/routine/${routine.id}?range=${range}&exerciseId=${exercise.id}#selected-exercise-detail`;
            const weightOrTimeGoal = exerciseWeightGoalMap.get(exercise.id);

            return (
              <Link key={exercise.id} href={detailHref} style={{ ...card, display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ marginBottom: 8, fontWeight: 900 }}>
                  {exercise.name} (click to open full exercise charts)
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <MetricLineChart
                    title={
                      exercise.unit === "TIME" && !exercise.supportsWeight
                        ? "Main metric: Time"
                        : "Main metric: Weight"
                    }
                    yLabel={exercise.unit === "TIME" && !exercise.supportsWeight ? "Time" : "Weight"}
                    xLabel="Session"
                    points={mainWeightPoints}
                    valueLabel={exercise.unit === "TIME" && !exercise.supportsWeight ? "Time" : "Weight"}
                    unit={exercise.unit === "TIME" && !exercise.supportsWeight ? "sec" : "lb"}
                    decimals={0}
                    targetValue={weightOrTimeGoal}
                    targetLabel={exercise.unit === "TIME" && !exercise.supportsWeight ? "Time target" : "Weight target"}
                    targetUnit={exercise.unit === "TIME" && !exercise.supportsWeight ? "sec" : "lb"}
                    targetDecimals={0}
                    compact={true}
                  />
                  {isTimeAndWeight ? (
                    <MetricLineChart
                      title="Main metric: Avg Time/Set"
                      yLabel="Time/Set"
                      xLabel="Session"
                      points={mainAvgTimePerSetPoints}
                      valueLabel="Avg Time/Set"
                      unit="sec"
                      decimals={1}
                      compact={true}
                    />
                  ) : (
                    <MetricLineChart
                      title="Main metric: Reps/Set"
                      yLabel="Reps/Set"
                      xLabel="Session"
                      points={mainRepsPerSetPoints}
                      valueLabel="Reps/Set"
                      decimals={0}
                      compact={true}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="selected-exercise-detail" style={panel}>
        <div style={panelHeader}>SELECTED EXERCISE FULL CHARTS</div>
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {!selectedExercise && <div style={{ opacity: 0.75 }}>No exercise selected.</div>}
          {selectedExercise && (
            <>
              <MetricLineChart
                title={`${selectedExercise.name}: ${
                  selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time" : "Weight"
                }`}
                yLabel={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time" : "Weight"}
                xLabel="Session date"
                points={selectedPrimaryPoints}
                valueLabel={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time" : "Weight"}
                unit={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "sec" : "lb"}
                decimals={0}
                targetValue={
                  exerciseWeightGoalMap.get(selectedExercise.id) ??
                  exerciseRepsAtWeightGoalMap.get(selectedExercise.id)?.weightLb
                }
                targetLabel={
                  selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight
                    ? "Time target"
                    : "Weight target"
                }
                targetUnit={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "sec" : "lb"}
                targetDecimals={0}
              />
              {selectedIsTimeAndWeight ? (
                <MetricLineChart
                  title={`${selectedExercise.name}: Avg Time per Set`}
                  yLabel="Avg Time/Set"
                  xLabel="Session date"
                  points={selectedAvgTimePerSetPoints}
                  valueLabel="Avg Time/Set"
                  unit="sec"
                  decimals={1}
                />
              ) : (
                <>
                  <MetricLineChart
                    title={`${selectedExercise.name}: Reps`}
                    yLabel="Reps"
                    xLabel="Session date"
                    points={selectedRepsPoints}
                    valueLabel="Reps"
                    decimals={0}
                  />
                  <MetricLineChart
                    title={`${selectedExercise.name}: Avg Reps per Set`}
                    yLabel="Avg Reps/Set"
                    xLabel="Session date"
                    points={selectedAvgRepsPerSetPoints}
                    valueLabel="Avg Reps/Set"
                    decimals={2}
                    targetValue={
                      exerciseRepsAtWeightGoalMap.get(selectedExercise.id)?.repsTarget ??
                      exerciseAvgRepsGoalMap.get(selectedExercise.id)
                    }
                    targetLabel={
                      exerciseRepsAtWeightGoalMap.get(selectedExercise.id)
                        ? "Reps target @ weight"
                        : "Avg reps/set target"
                    }
                    targetDecimals={2}
                  />
                </>
              )}
              <MetricLineChart
                title={`${selectedExercise.name}: Total Volume`}
                yLabel="Volume"
                xLabel="Session date"
                points={selectedVolumePoints}
                valueLabel="Volume"
                decimals={1}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  letterSpacing: 0.4,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};
