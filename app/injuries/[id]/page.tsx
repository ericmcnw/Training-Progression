import Link from "next/link";
import { notFound } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import { getInjury, updateInjury } from "../actions";
import InjuryStatusButtons from "./InjuryStatusButtons";
import { prisma } from "@/lib/prisma";
import { formatAppDate, formatAppDateTime, toAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function InjuryDetailPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const injury = await getInjury(params.id);
  if (!injury) notFound();

  const [zones, painLogs] = await Promise.all([
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    prisma.painLog.findMany({
      where: {
        zoneId: { in: injury.zones.map((entry) => entry.zoneId) },
        loggedAt: { gte: injury.startedAt },
      },
      orderBy: { loggedAt: "desc" },
      take: 30,
      include: { zone: { select: { label: true, slug: true } } },
    }),
  ]);
  const zoneSlugs = injury.zones.map((entry) => entry.zone.slug);

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>Injury</div>
          <h1 style={h1}>{injury.name}</h1>
          <div style={muted}>
            {injury.status.toLowerCase()} · severity {injury.severity}/5 · started{" "}
            {formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <Link href="/injuries" style={linkStyle}>
          Back
        </Link>
      </div>

      <section style={panel}>
        <BodyMap
          zones={zoneSlugs.map((slug) => ({ slug, freshness: injury.status === "RESOLVED" ? "RECOVERING" : "INJURED" }))}
          selectedSlugs={zoneSlugs}
          size="md"
        />
        {injury.notes ? <div style={muted}>{injury.notes}</div> : null}
        <InjuryStatusButtons id={injury.id} />
      </section>

      <section style={panel}>
        <div style={sectionTitle}>Edit</div>
        <InjuryForm
          zones={zones}
          submitLabel="Save injury"
          action={updateInjury.bind(null, injury.id)}
          initial={{
            id: injury.id,
            name: injury.name,
            severity: injury.severity,
            status: injury.status,
            startedAt: toAppYmd(injury.startedAt),
            resolvedAt: injury.resolvedAt ? toAppYmd(injury.resolvedAt) : "",
            notes: injury.notes ?? "",
            zoneSlugs,
          }}
        />
      </section>

      <section style={panel}>
        <div style={sectionTitle}>Related pain logs</div>
        <div style={{ display: "grid", gap: 10 }}>
          {painLogs.length === 0 ? <div style={muted}>No pain logs since this injury started.</div> : null}
          {painLogs.map((log) => (
            <div key={log.id} style={row}>
              <div>
                <div style={{ fontWeight: 900 }}>{log.zone.label}</div>
                <div style={muted}>{formatAppDateTime(log.loggedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
              <div style={{ fontWeight: 900 }}>{log.level}/10</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" };
const h1: React.CSSProperties = { margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 };
const panel: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, background: "rgba(255,255,255,0.04)", padding: 14, display: "grid", gap: 14 };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" };
const muted: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.45 };
const row: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.03)" };
const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 38,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};
