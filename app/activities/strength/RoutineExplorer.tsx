"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import type {
  StrengthRoutineDetail,
  StrengthRoutineExerciseTrend,
  StrengthTrendUnit,
} from "@/app/progress/details/strength-world-loader";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function formatValue(value: number, unit: StrengthTrendUnit) {
  const rounded = Math.round(value * 10) / 10;
  if (unit === "lb") return `${rounded} lb`;
  if (unit === "sec") return `${rounded}s`;
  return `${rounded} reps`;
}

function formatVolume(n: number) {
  if (n >= 100000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export default function RoutineExplorer({ routines, accentRgb }: { routines: StrengthRoutineDetail[]; accentRgb: string }) {
  const [selectedId, setSelectedId] = useState(routines[0]?.routineId ?? "");
  const { openDrawer } = useLogDrawer();
  const routine = routines.find((r) => r.routineId === selectedId) ?? routines[0];
  if (!routine) return null;

  const accent = `rgba(${accentRgb},0.95)`;

  return (
    <section style={card} aria-label="Routine progress">
      <header style={head}>
        <h2 style={title}>By routine</h2>
        <span style={hint}>Pick a routine to see how each lift in it is moving.</span>
      </header>

      {routines.length > 1 ? (
        <div style={chipRow} role="tablist" aria-label="Routines">
          {routines.map((r) => {
            const active = r.routineId === routine.routineId;
            return (
              <button
                key={r.routineId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedId(r.routineId)}
                style={{
                  ...chip,
                  borderColor: active ? `rgba(${accentRgb},0.55)` : "rgba(255,255,255,0.14)",
                  background: active ? `rgba(${accentRgb},0.16)` : "rgba(255,255,255,0.04)",
                  color: active ? accent : "inherit",
                }}
              >
                {r.name}
                <span style={chipCount}>{r.totalSessions}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div style={summaryRow}>
        <div style={{ minWidth: 0 }}>
          <div style={routineName}>{routine.name}</div>
          <div style={routineMeta}>
            {routine.totalSessions} session{routine.totalSessions === 1 ? "" : "s"}
            {routine.lastDate ? ` · last ${DATE.format(routine.lastDate)}` : ""}
            {` · ${routine.sessionsLast4Weeks} in the last 4 weeks`}
            {routine.totalVolume > 0 ? ` · ${formatVolume(routine.totalVolume)} lb lifted` : ""}
          </div>
        </div>
        <div style={actions}>
          <button type="button" onClick={() => openDrawer(routine.routineId)} style={{ ...actionBtn, borderColor: `rgba(${accentRgb},0.5)`, background: `rgba(${accentRgb},0.14)`, color: accent }}>
            Log
          </button>
          <Link href={`/routines/${routine.routineId}`} style={actionBtn}>
            Open
          </Link>
        </div>
      </div>

      {routine.exercises.length === 0 ? (
        <div style={empty}>No sets logged in this routine yet.</div>
      ) : (
        <ul style={list}>
          {routine.exercises.map((exercise) => (
            <ExerciseRow key={exercise.exerciseId} exercise={exercise} accent={accent} accentRgb={accentRgb} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExerciseRow({ exercise, accent, accentRgb }: { exercise: StrengthRoutineExerciseTrend; accent: string; accentRgb: string }) {
  const first = exercise.points[0];
  const latest = exercise.points[exercise.points.length - 1];
  const change = exercise.points.length > 1 ? latest.value - first.value : null;
  const changeTone = change === null || change === 0 ? "rgba(255,255,255,0.55)" : change > 0 ? "rgba(134,239,172,0.95)" : "rgba(252,165,165,0.95)";

  return (
    <li>
      <Link href={`/exercises/${exercise.exerciseId}`} style={row}>
        <span style={{ minWidth: 0 }}>
          <span style={exName}>{exercise.name}</span>
          <span style={exMeta}>
            {exercise.sessions} session{exercise.sessions === 1 ? "" : "s"}
            {change !== null ? (
              <span style={{ color: changeTone, fontWeight: 800 }}>
                {` · ${change > 0 ? "+" : change < 0 ? "−" : "±"}${formatValue(Math.abs(change), exercise.unit)} since ${DATE.format(first.date)}`}
              </span>
            ) : null}
          </span>
        </span>
        <Spark points={exercise.points.map((p) => p.value)} accentRgb={accentRgb} />
        <span style={latestCell}>
          <span style={{ ...latestValue, color: accent }}>{formatValue(latest.value, exercise.unit)}</span>
          <span style={latestSub}>{exercise.unit === "lb" && latest.reps > 0 ? `× ${latest.reps}` : "latest"}</span>
        </span>
      </Link>
    </li>
  );
}

function Spark({ points, accentRgb }: { points: number[]; accentRgb: string }) {
  const w = 72;
  const h = 28;
  if (points.length < 2) return <span style={{ width: w, flexShrink: 0 }} aria-hidden />;
  const min = Math.min(...points);
  const range = Math.max(1, Math.max(...points) - min);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 3 - ((v - min) / range) * (h - 6);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", flexShrink: 0 }} aria-hidden="true">
      <path d={path} stroke={`rgba(${accentRgb},0.85)`} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r={2.6} fill={`rgba(${accentRgb},1)`} />
    </svg>
  );
}

const card: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  minWidth: 0,
};
const head: CSSProperties = { display: "grid", gap: 2 };
const title: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 900 };
const hint: CSSProperties = { fontSize: 12, opacity: 0.6 };
const chipRow: CSSProperties = { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" };
const chip: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 40,
  padding: "0 13px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const chipCount: CSSProperties = { fontSize: 11, fontWeight: 800, opacity: 0.6 };
const summaryRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const routineName: CSSProperties = { fontSize: 17, fontWeight: 900, lineHeight: 1.2 };
const routineMeta: CSSProperties = { marginTop: 3, fontSize: 12, opacity: 0.65, lineHeight: 1.45 };
const actions: CSSProperties = { display: "flex", gap: 6, flexShrink: 0 };
const actionBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};
const list: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid" };
const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  alignItems: "center",
  gap: 12,
  minHeight: 52,
  padding: "8px 0",
  borderTop: "1px solid rgba(255,255,255,0.07)",
  color: "inherit",
  textDecoration: "none",
};
const exName: CSSProperties = { display: "block", fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const exMeta: CSSProperties = { display: "block", marginTop: 2, fontSize: 12, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const latestCell: CSSProperties = { display: "grid", justifyItems: "end", minWidth: 62 };
const latestValue: CSSProperties = { fontSize: 15, fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap" };
const latestSub: CSSProperties = { fontSize: 11, opacity: 0.6, fontWeight: 700 };
const empty: CSSProperties = { fontSize: 13, opacity: 0.6, padding: "6px 0" };
