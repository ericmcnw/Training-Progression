import Link from "next/link";
import PainLogForm from "./PainLogForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LogPainPage(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const zoneParam = getParam(searchParams, "zone");
  const zones = await prisma.bodyZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { slug: true, label: true },
  });

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55 }}>BODY</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 }}>Log Pain</h1>
        </div>
        <Link href="/" style={linkStyle}>
          Back
        </Link>
      </div>
      <PainLogForm zones={zones} initialSelected={zoneParam ? [zoneParam] : []} />
    </main>
  );
}

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
