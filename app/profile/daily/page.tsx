import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { addDaysYmd, formatAppDate, toAppYmd, todayAppYmd } from "@/lib/dates";
import {
  SLEEP_BAND_LABELS,
  averageOf,
  formatMiles,
  formatSleepDuration,
  formatSteps,
  sleepScoreBand,
  sleepScoreColor,
  sumOf,
} from "@/lib/daily-metrics";
import { deleteDailyMetric, saveDailyMetric } from "./actions";

export const dynamic = "force-dynamic";

export default async function DailyMetricsPage() {
  const session = await getAppSession();
  const rows = await prisma.dailyMetric.findMany({
    where: { profileKey: session.profileKey },
    orderBy: { day: "desc" },
    take: 120,
  });

  const today = todayAppYmd();
  const todayRow = rows.find((row) => toAppYmd(row.day) === today) ?? null;

  const weekCutoff = addDaysYmd(today, -6);
  const week = rows.filter((row) => toAppYmd(row.day) >= weekCutoff);
  const avgSleep = averageOf(week.map((row) => row.sleepMinutes));
  const avgScore = averageOf(week.map((row) => row.sleepScore));
  const avgSteps = averageOf(week.map((row) => row.steps));
  const totalMiles = sumOf(week.map((row) => row.distanceMi));

  const chartRows = rows.filter((row) => row.sleepMinutes != null).slice(0, 21).reverse();
  const peakHours = Math.max(9, ...chartRows.map((row) => row.sleepMinutes! / 60));

  return <main style={page}>
    <div style={topBar}><Link href="/profile" style={backLink}>Profile</Link></div>
    <header style={{ display: "grid", gap: 5 }}><h1 style={title}>Daily metrics</h1><p style={subtitle}>Sleep, steps, and distance from your band. Daily context for the training around it. One row per day, and re-saving a date corrects it.</p></header>

    <section style={summary}>
      <div><div style={summaryValue}>{formatSleepDuration(avgSleep) ?? "-"}</div><div style={rowMeta}>avg sleep · 7d</div></div>
      <div><div style={{ ...summaryValue, color: sleepScoreColor(avgScore) }}>{avgScore != null ? Math.round(avgScore) : "-"}</div><div style={rowMeta}>avg score · 7d</div></div>
      <div><div style={summaryValue}>{avgSteps != null ? formatSteps(avgSteps) : "-"}</div><div style={rowMeta}>avg steps · 7d</div></div>
      <div><div style={summaryValue}>{totalMiles != null ? totalMiles.toFixed(1) : "-"}</div><div style={rowMeta}>miles · 7d total</div></div>
    </section>

    {chartRows.length > 1 ? <section style={section}>
      <h2 style={sectionTitle}>Sleep trend</h2>
      <div style={chart}>{chartRows.map((row) => {
        const hours = row.sleepMinutes! / 60;
        return <div key={row.id} style={barSlot}><div style={{ ...bar, height: `${18 + (hours / peakHours) * 66}px`, background: row.sleepScore != null ? sleepScoreColor(row.sleepScore) : "rgba(255,255,255,0.28)" }} title={`${toAppYmd(row.day)} · ${formatSleepDuration(row.sleepMinutes)}${row.sleepScore != null ? ` · score ${row.sleepScore}` : ""}`} /></div>;
      })}</div>
      <div style={chartLabels}><span>Older</span><span>Height is hours, color is score band</span><span>Latest</span></div>
    </section> : null}

    <section style={section}>
      <h2 style={sectionTitle}>{todayRow ? "Edit today" : "Log a day"}</h2>
      <form action={saveDailyMetric} style={form}>
        <label style={{ ...field, gridColumn: "1 / -1" }}>Date<input name="date" type="date" defaultValue={today} max={today} required style={input} /></label>
        <div style={{ ...field, gridColumn: "1 / -1" }}>Sleep
          <div style={splitField}>
            <input name="sleepHours" type="number" min="0" max="24" step="1" inputMode="numeric" placeholder="hours" defaultValue={todayRow?.sleepMinutes != null ? Math.floor(todayRow.sleepMinutes / 60) : ""} style={input} aria-label="Sleep hours" />
            <input name="sleepMins" type="number" min="0" max="59" step="1" inputMode="numeric" placeholder="minutes" defaultValue={todayRow?.sleepMinutes != null ? todayRow.sleepMinutes % 60 : ""} style={input} aria-label="Sleep minutes" />
          </div>
        </div>
        <label style={field}>Sleep score<input name="sleepScore" type="number" min="0" max="100" step="1" inputMode="numeric" defaultValue={todayRow?.sleepScore ?? ""} style={input} /></label>
        <label style={field}>Steps<input name="steps" type="number" min="0" max="200000" step="1" inputMode="numeric" defaultValue={todayRow?.steps ?? ""} style={input} /></label>
        <label style={field}>Distance (mi)<input name="distanceMi" type="number" min="0" max="500" step="0.01" inputMode="decimal" defaultValue={todayRow?.distanceMi ?? ""} style={input} /></label>
        <label style={field}>Notes<input name="notes" maxLength={500} defaultValue={todayRow?.notes ?? ""} style={input} /></label>
        <button type="submit" style={saveButton}>Save day</button>
      </form>
    </section>

    <section style={section}>
      <h2 style={sectionTitle}>History</h2>
      {rows.length ? <div style={list}>{rows.map((row) => {
        const parts = [formatSteps(row.steps) ? `${formatSteps(row.steps)} steps` : null, formatMiles(row.distanceMi), row.notes].filter(Boolean);
        return <div key={row.id} style={historyRow}>
          <div style={{ minWidth: 0 }}>
            <div style={rowTitle}>{formatAppDate(row.day, { weekday: "short", month: "short", day: "numeric" })}{formatSleepDuration(row.sleepMinutes) ? ` · ${formatSleepDuration(row.sleepMinutes)}` : ""}</div>
            <div style={rowMeta}>{parts.length ? parts.join(" · ") : "No activity numbers"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {row.sleepScore != null ? <strong style={{ ...score, color: sleepScoreColor(row.sleepScore) }} title={SLEEP_BAND_LABELS[sleepScoreBand(row.sleepScore)]}>{row.sleepScore}</strong> : null}
            <form action={deleteDailyMetric}><input type="hidden" name="id" value={row.id} /><button type="submit" style={deleteButton} aria-label={`Delete metrics from ${toAppYmd(row.day)}`} title="Delete day">&times;</button></form>
          </div>
        </div>;
      })}</div> : <div style={empty}>No days logged yet.</div>}
    </section>
  </main>;
}

const page: React.CSSProperties = { maxWidth: "var(--app-width-form)", margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", display: "grid", gap: 16 };
const topBar: React.CSSProperties = { display: "flex" };
const backLink: React.CSSProperties = { color: "rgba(255,255,255,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const title: React.CSSProperties = { margin: 0, fontSize: 24, fontWeight: 900 };
const subtitle: React.CSSProperties = { margin: 0, color: "rgba(255,255,255,0.58)", fontSize: 13, lineHeight: 1.45 };
const summary: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.09)", borderBottom: "1px solid rgba(255,255,255,0.09)" };
const summaryValue: React.CSSProperties = { fontSize: 20, fontWeight: 900 };
const section: React.CSSProperties = { display: "grid", gap: 11, padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.025)" };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 14.5, fontWeight: 900 };
const form: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 };
const field: React.CSSProperties = { display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.62)" };
const splitField: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const input: React.CSSProperties = { minWidth: 0, width: "100%", minHeight: 42, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "#111827", color: "white", fontSize: 16 };
const saveButton: React.CSSProperties = { gridColumn: "1 / -1", minHeight: 44, borderRadius: 8, border: "1px solid rgba(51,255,122,0.38)", background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };
const chart: React.CSSProperties = { height: 96, display: "flex", alignItems: "end", gap: 3, overflow: "hidden" };
const barSlot: React.CSSProperties = { flex: 1, height: "100%", display: "flex", alignItems: "end" };
const bar: React.CSSProperties = { width: "100%", minWidth: 3, maxWidth: 22, margin: "0 auto", borderRadius: "3px 3px 0 0" };
const chartLabels: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 9.5, color: "rgba(255,255,255,0.4)" };
const list: React.CSSProperties = { display: "grid" };
const historyRow: React.CSSProperties = { minHeight: 50, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" };
const rowTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 850 };
const rowMeta: React.CSSProperties = { fontSize: 10.5, color: "rgba(255,255,255,0.48)", lineHeight: 1.4 };
const score: React.CSSProperties = { fontSize: 15, fontWeight: 900 };
const deleteButton: React.CSSProperties = { width: 40, height: 40, borderRadius: 8, border: "1px solid rgba(248,113,113,0.22)", background: "transparent", color: "rgba(248,113,113,0.72)", fontSize: 18, cursor: "pointer" };
const empty: React.CSSProperties = { padding: 11, border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 8, color: "rgba(255,255,255,0.46)", fontSize: 11.5 };
