import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeInjuries } from "@/lib/home-injuries";
import { getAggravatingFactorSuggestions } from "@/app/injuries/actions";
import HomeInjuriesSection from "@/app/_home/HomeInjuriesSection";
import LogPainButton from "@/app/components/injuries/LogPainButton";
import { formatAppDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const [injuries, factorSuggestions, zones, recentPain] = await Promise.all([
    getHomeInjuries(),
    getAggravatingFactorSuggestions(),
    prisma.bodyZone.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, label: true } }),
    prisma.painLog.findMany({
      orderBy: { loggedAt: "desc" },
      take: 12,
      select: { id: true, level: true, loggedAt: true, notes: true, zone: { select: { label: true } } },
    }),
  ]);

  return <main style={page}>
    <div style={topBar}><Link href="/profile" style={backLink}>Profile</Link><LogPainButton zones={zones} injuries={injuries.map((injury) => ({ id: injury.id, name: injury.name, zones: injury.zones }))} factorSuggestions={factorSuggestions} /></div>
    <header style={{ display: "grid", gap: 5 }}><h1 style={title}>Health</h1><p style={subtitle}>Pain, active injuries, and recovery context. This is kept separate from training coverage.</p></header>

    <section style={section}>
      <div style={sectionHead}><h2 style={sectionTitle}>Active issues</h2><Link href="/injuries/new" style={sectionLink}>Add injury</Link></div>
      {injuries.length ? <HomeInjuriesSection injuries={injuries} factorSuggestions={factorSuggestions} zones={zones} embedded /> : <div style={empty}>No active injuries. Pain readings can still be logged without creating an injury.</div>}
    </section>

    <section style={section}>
      <div style={sectionHead}><h2 style={sectionTitle}>Recent pain readings</h2></div>
      {recentPain.length ? <div style={list}>{recentPain.map((reading) => <div key={reading.id} style={row}><div><div style={rowTitle}>{reading.zone.label}</div><div style={rowMeta}>{formatAppDate(reading.loggedAt, { month: "short", day: "numeric" })}{reading.notes ? ` · ${reading.notes}` : ""}</div></div><strong style={{ ...score, color: reading.level <= 2 ? "#7ce8aa" : reading.level <= 4 ? "#fcd34d" : "#fca5a5" }}>{reading.level}/10</strong></div>)}</div> : <div style={empty}>No pain readings yet.</div>}
    </section>

    <section style={secondaryBand}>
      <div><div style={rowTitle}>Body map and zone coverage</div><div style={rowMeta}>Optional detail view for regional training load and zone history.</div></div>
      <Link href="/body" style={secondaryLink}>Open map</Link>
    </section>
  </main>;
}

const page: React.CSSProperties = { maxWidth: "var(--app-width-content)", margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", display: "grid", gap: 16 };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const backLink: React.CSSProperties = { color: "rgba(255,255,255,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const title: React.CSSProperties = { margin: 0, fontSize: 24, fontWeight: 900 };
const subtitle: React.CSSProperties = { margin: 0, color: "rgba(255,255,255,0.58)", fontSize: 13, lineHeight: 1.45 };
const section: React.CSSProperties = { display: "grid", gap: 11, padding: 14, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, background: "rgba(255,255,255,0.025)" };
const sectionHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 14.5, fontWeight: 900 };
const sectionLink: React.CSSProperties = { color: "#7ce8aa", textDecoration: "none", fontSize: 11.5, fontWeight: 850, minHeight: 34, display: "inline-flex", alignItems: "center" };
const empty: React.CSSProperties = { padding: 11, border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 8, color: "rgba(255,255,255,0.46)", fontSize: 11.5 };
const list: React.CSSProperties = { display: "grid" };
const row: React.CSSProperties = { minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" };
const rowTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 850 };
const rowMeta: React.CSSProperties = { color: "rgba(255,255,255,0.46)", fontSize: 10.5, lineHeight: 1.4 };
const score: React.CSSProperties = { fontSize: 12, flexShrink: 0 };
const secondaryBand: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const secondaryLink: React.CSSProperties = { ...backLink, minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 10px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, flexShrink: 0 };
