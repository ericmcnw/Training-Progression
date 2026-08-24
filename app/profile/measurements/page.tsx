import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { todayAppYmd } from "@/lib/dates";
import { addBodyMeasurement, deleteBodyMeasurement } from "./actions";

export const dynamic = "force-dynamic";

export default async function MeasurementsPage() {
  const session = await getAppSession();
  const rows = await prisma.bodyMeasurement.findMany({
    where: { profileKey: session.profileKey },
    orderBy: { measuredAt: "desc" },
    take: 120,
  });
  const withWeight = rows.filter((row) => row.weightKg != null);
  const latest = withWeight[0] ?? null;
  const previous = withWeight[1] ?? null;
  const changeLb = latest?.weightKg != null && previous?.weightKg != null ? (latest.weightKg - previous.weightKg) * 2.2046226218 : null;
  const chartRows = withWeight.slice(0, 24).reverse();
  const weights = chartRows.map((row) => row.weightKg! * 2.2046226218);
  const min = weights.length ? Math.min(...weights) : 0;
  const max = weights.length ? Math.max(...weights) : 0;
  const span = Math.max(1, max - min);

  return <main style={page}>
    <div style={topBar}><Link href="/profile" style={backLink}>Profile</Link></div>
    <header style={{ display: "grid", gap: 5 }}><h1 style={title}>Measurements</h1><p style={subtitle}>Bodyweight and optional composition measurements. Trends matter more than single readings.</p></header>

    {latest ? <section style={summary}>
      <div><div style={summaryValue}>{(latest.weightKg! * 2.2046226218).toFixed(1)} lb</div><div style={rowMeta}>latest weight</div></div>
      <div><div style={{ ...summaryChange, color: changeLb == null ? "rgba(255,255,255,0.55)" : Math.abs(changeLb) < 0.05 ? "#7ce8aa" : "#bfdbfe" }}>{changeLb == null ? "-" : `${changeLb > 0 ? "+" : ""}${changeLb.toFixed(1)} lb`}</div><div style={rowMeta}>from prior reading</div></div>
    </section> : null}

    {weights.length > 1 ? <section style={section}><h2 style={sectionTitle}>Weight trend</h2><div style={chart}>{weights.map((weight, index) => <div key={index} style={barSlot}><div style={{ ...bar, height: `${18 + ((weight - min) / span) * 66}px` }} title={`${weight.toFixed(1)} lb`} /></div>)}</div><div style={chartLabels}><span>Older</span><span>Latest</span></div></section> : null}

    <section style={section}>
      <h2 style={sectionTitle}>Add measurement</h2>
      <form action={addBodyMeasurement} style={form}>
        <label style={field}>Date<input name="date" type="date" defaultValue={todayAppYmd()} required style={input} /></label>
        <label style={field}>Weight (lb)<input name="weightLb" type="number" min="1" max="1500" step="0.1" inputMode="decimal" style={input} /></label>
        <label style={field}>Body fat (%)<input name="bodyFatPct" type="number" min="0" max="100" step="0.1" inputMode="decimal" style={input} /></label>
        <label style={field}>Waist (in)<input name="waistIn" type="number" min="1" max="150" step="0.1" inputMode="decimal" style={input} /></label>
        <label style={{ ...field, gridColumn: "1 / -1" }}>Notes<input name="notes" maxLength={500} style={input} /></label>
        <button type="submit" style={saveButton}>Save measurement</button>
      </form>
    </section>

    <section style={section}><h2 style={sectionTitle}>History</h2>{rows.length ? <div style={list}>{rows.map((row) => <div key={row.id} style={historyRow}><div><div style={rowTitle}>{row.weightKg != null ? `${(row.weightKg * 2.2046226218).toFixed(1)} lb` : "Measurement"}</div><div style={rowMeta}>{row.measuredAt.toISOString().slice(0, 10)}{row.bodyFatPct != null ? ` · ${row.bodyFatPct.toFixed(1)}% body fat` : ""}{row.waistCm != null ? ` · ${(row.waistCm / 2.54).toFixed(1)} in waist` : ""}{row.notes ? ` · ${row.notes}` : ""}</div></div><form action={deleteBodyMeasurement}><input type="hidden" name="id" value={row.id} /><button type="submit" style={deleteButton} aria-label={`Delete measurement from ${row.measuredAt.toISOString().slice(0, 10)}`} title="Delete measurement">×</button></form></div>)}</div> : <div style={empty}>No measurements yet.</div>}</section>
  </main>;
}

const page: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", display: "grid", gap: 16 };
const topBar: React.CSSProperties = { display: "flex" };
const backLink: React.CSSProperties = { color: "rgba(255,255,255,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const title: React.CSSProperties = { margin: 0, fontSize: 24, fontWeight: 900 };
const subtitle: React.CSSProperties = { margin: 0, color: "rgba(255,255,255,0.58)", fontSize: 13, lineHeight: 1.45 };
const summary: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.09)", borderBottom: "1px solid rgba(255,255,255,0.09)" };
const summaryValue: React.CSSProperties = { fontSize: 27, fontWeight: 900 };
const summaryChange: React.CSSProperties = { fontSize: 20, fontWeight: 900 };
const section: React.CSSProperties = { display: "grid", gap: 11, padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.025)" };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 14.5, fontWeight: 900 };
const form: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 };
const field: React.CSSProperties = { display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.62)" };
const input: React.CSSProperties = { minWidth: 0, width: "100%", minHeight: 42, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "#111827", color: "white", fontSize: 16 };
const saveButton: React.CSSProperties = { gridColumn: "1 / -1", minHeight: 44, borderRadius: 8, border: "1px solid rgba(51,255,122,0.38)", background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };
const chart: React.CSSProperties = { height: 96, display: "flex", alignItems: "end", gap: 3, overflow: "hidden" };
const barSlot: React.CSSProperties = { flex: 1, height: "100%", display: "flex", alignItems: "end" };
const bar: React.CSSProperties = { width: "100%", minWidth: 3, maxWidth: 22, margin: "0 auto", background: "#60a5fa", borderRadius: "3px 3px 0 0" };
const chartLabels: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "rgba(255,255,255,0.4)" };
const list: React.CSSProperties = { display: "grid" };
const historyRow: React.CSSProperties = { minHeight: 50, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" };
const rowTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 850 };
const rowMeta: React.CSSProperties = { fontSize: 10.5, color: "rgba(255,255,255,0.48)", lineHeight: 1.4 };
const deleteButton: React.CSSProperties = { width: 40, height: 40, borderRadius: 8, border: "1px solid rgba(248,113,113,0.22)", background: "transparent", color: "rgba(248,113,113,0.72)", fontSize: 18, cursor: "pointer" };
const empty: React.CSSProperties = { padding: 11, border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 8, color: "rgba(255,255,255,0.46)", fontSize: 11.5 };
