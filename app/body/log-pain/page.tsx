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

  const [zones, activeInjuries] = await Promise.all([
    prisma.bodyZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { slug: true, label: true },
    }),
    zoneParam
      ? Promise.resolve([])
      : prisma.activeInjury.findMany({
          where: { status: { in: ["ACTIVE", "FLARED"] } },
          include: { zones: { include: { zone: { select: { slug: true } } } } },
        }),
  ]);

  const injuryZoneSlugs = [...new Set(activeInjuries.flatMap((i) => i.zones.map((z) => z.zone.slug)))];
  const initialSelected = zoneParam ? [zoneParam] : injuryZoneSlugs;
  const autoSelected = !zoneParam && injuryZoneSlugs.length > 0;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" }}>Body</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 }}>Log Pain</h1>
        </div>
        <Link href="/" style={linkStyle}>Back</Link>
      </div>

      {autoSelected && (
        <div style={injuryNotice}>
          <span style={{ fontSize: 15 }}>⚠</span>
          <span>
            Active injury zones pre-selected — {activeInjuries.map((i) => i.name).join(", ")}.
            Tap zones on the map to adjust.
          </span>
        </div>
      )}

      <PainLogForm zones={zones} initialSelected={initialSelected} />
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 38,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const injuryNotice: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(251,191,36,0.3)",
  background: "rgba(251,191,36,0.07)",
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.85)",
  lineHeight: 1.45,
};
