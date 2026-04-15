import Link from "next/link";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import { createInjury } from "../actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewInjuryPage(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const zone = getParam(searchParams, "zone");
  const zones = await prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } });

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>Injuries</div>
          <h1 style={h1}>New Injury</h1>
        </div>
        <Link href="/injuries" style={linkStyle}>
          Back
        </Link>
      </div>
      <section style={panel}>
        <InjuryForm zones={zones} submitLabel="Create injury" action={createInjury} initial={zone ? { name: "", severity: 2, status: "ACTIVE", startedAt: new Date().toISOString().slice(0, 10), zoneSlugs: [zone] } : undefined} />
      </section>
    </main>
  );
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" };
const h1: React.CSSProperties = { margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 };
const panel: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, background: "rgba(255,255,255,0.04)", padding: 14 };
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
